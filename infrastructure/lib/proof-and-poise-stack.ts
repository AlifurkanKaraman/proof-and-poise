/**
 * ProofAndPoiseStack: DynamoDB single table, private upload bucket, the `api` Lambda, the
 * async `analysis-worker` Lambda (task 9), and an HTTP API with stage throttling.
 * No VPC, no NAT, no always-on compute (Req 16.6).
 */
import { fileURLToPath } from 'node:url';
import {
  ArnFormat,
  CfnOutput,
  CustomResource,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableEncryptionV2, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import { Provider } from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';
import type { StageConfig } from './config';

export interface ProofAndPoiseStackProps extends StackProps {
  config: StageConfig;
}

const repoPath = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));

export const API_THROTTLE = { rateLimit: 10, burstLimit: 20 } as const;
export const EPHEMERAL_PREFIXES = ['resumes/', 'audio/', 'transcripts/'] as const;

/** Regions each cross-Region inference profile prefix can route to (us-east-1 stacks). */
const PROFILE_REGIONS: Record<string, readonly string[]> = {
  us: ['us-east-1', 'us-east-2', 'us-west-2'],
};

/**
 * IAM resources for Converse on `modelId` (Req 15.2). A profile ID like
 * `us.amazon.nova-lite-v1:0` needs the inference-profile ARN and the underlying
 * foundation-model ARN in every Region the profile routes to; a bare model ID needs only
 * the foundation model in this Region.
 */
export function bedrockModelArns(stack: Stack, modelId: string): string[] {
  const geo = /^([a-z]+)\.(.+)$/.exec(modelId);
  const profileRegions = geo ? PROFILE_REGIONS[geo[1] ?? ''] : undefined;
  const foundationModel = geo?.[2];
  if (!profileRegions || !foundationModel) {
    return [`arn:${stack.partition}:bedrock:${stack.region}::foundation-model/${modelId}`];
  }
  return [
    `arn:${stack.partition}:bedrock:${stack.region}:${stack.account}:inference-profile/${modelId}`,
    ...profileRegions.map(
      (r) => `arn:${stack.partition}:bedrock:${r}::foundation-model/${foundationModel}`,
    ),
  ];
}

/** SSM parameter holding the IP-hash salt (Req 16.3, design §11). */
export const saltParameterName = (stage: string) => `/proof-and-poise/${stage}/ip-hash-salt`;

/**
 * Deploy-time salt generator. CloudFormation can't create SecureString parameters or
 * random values, so this custom resource writes 32 CSPRNG bytes to SSM on create (keeping
 * an existing value), and removes the parameter on stack delete. The value never appears
 * in the template, the repo, or logs.
 */
const SALT_HANDLER = `
const { SSMClient, PutParameterCommand, DeleteParameterCommand } = require('@aws-sdk/client-ssm');
const { randomBytes } = require('node:crypto');
const ssm = new SSMClient({});
exports.handler = async (event) => {
  const name = event.ResourceProperties.ParameterName;
  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    try {
      await ssm.send(new PutParameterCommand({
        Name: name, Type: 'SecureString', Tier: 'Standard', Overwrite: false,
        Value: randomBytes(32).toString('hex'),
      }));
    } catch (err) {
      if (err.name !== 'ParameterAlreadyExists') throw err;
    }
  } else if (event.RequestType === 'Delete') {
    try {
      await ssm.send(new DeleteParameterCommand({ Name: name }));
    } catch (err) {
      if (err.name !== 'ParameterNotFound') throw err;
    }
  }
  return { PhysicalResourceId: name };
};
`;

export class ProofAndPoiseStack extends Stack {
  constructor(scope: Construct, id: string, props: ProofAndPoiseStackProps) {
    super(scope, id, props);
    const { stage, allowedOrigins, modelId } = props.config;
    const prefix = `proof-and-poise-${stage}`;
    Tags.of(this).add('app', 'proof-and-poise');
    Tags.of(this).add('stage', stage);

    // --- Data: single table, on-demand, TTL, ephemeral (design §5) -------------------
    const table = new TableV2(this, 'Table', {
      tableName: prefix,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      encryption: TableEncryptionV2.dynamoOwnedKey(),
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- Uploads: private, TLS-only, SSE-S3, 1-day lifecycle (Req 4.2) ---------------
    const bucket = new Bucket(this, 'Uploads', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: BucketEncryption.S3_MANAGED,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: false,
      cors: [
        {
          allowedMethods: [HttpMethods.POST],
          allowedOrigins,
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: EPHEMERAL_PREFIXES.map((p) => ({
        id: `expire-${p.replace('/', '')}`,
        prefix: p,
        expiration: Duration.days(1),
        abortIncompleteMultipartUploadAfter: Duration.days(1),
      })),
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- IP-hash salt in SSM Parameter Store Standard (free), generated at deploy ------
    const saltName = saltParameterName(stage);
    const saltParamArn = this.formatArn({
      service: 'ssm',
      resource: 'parameter',
      resourceName: saltName.slice(1),
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    });
    const saltFn = new LambdaFunction(this, 'SaltGeneratorFunction', {
      functionName: `${prefix}-salt-generator`,
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: 'index.handler',
      code: Code.fromInline(SALT_HANDLER),
      timeout: Duration.seconds(30),
      logGroup: new LogGroup(this, 'SaltGeneratorLogs', {
        logGroupName: `/aws/lambda/${prefix}-salt-generator`,
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    saltFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
        resources: [saltParamArn],
      }),
    );
    const saltProvider = new Provider(this, 'SaltProvider', {
      onEventHandler: saltFn,
      logGroup: new LogGroup(this, 'SaltProviderLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    const salt = new CustomResource(this, 'IpHashSalt', {
      serviceToken: saltProvider.serviceToken,
      resourceType: 'Custom::IpHashSalt',
      properties: { ParameterName: saltName },
    });

    // --- api Lambda ------------------------------------------------------------------
    const apiLogGroup = new LogGroup(this, 'ApiLogs', {
      logGroupName: `/aws/lambda/${prefix}-api`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const apiFn = new NodejsFunction(this, 'ApiFunction', {
      functionName: `${prefix}-api`,
      entry: repoPath('services/api/src/handlers/api.ts'),
      handler: 'handler',
      projectRoot: repoPath(''),
      depsLockFilePath: repoPath('pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(25),
      logGroup: apiLogGroup,
      environment: {
        APP_STAGE: stage,
        TABLE_NAME: table.tableName,
        BUCKET_NAME: bucket.bucketName,
        MODEL_ID: modelId,
        ALLOWED_ORIGINS: allowedOrigins.join(','),
        IP_HASH_SALT_PARAM: saltName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: OutputFormat.CJS,
        target: 'node22',
        minify: true,
        sourceMap: true,
        // Bundle the pinned AWS SDK v3 packages instead of relying on the runtime copy:
        // lib-dynamodb and s3-presigned-post aren't guaranteed to ship with the runtime, and
        // mixing bundled helpers with runtime clients risks version skew.
        externalModules: [],
      },
    });
    // The salt must exist before the api reads it at cold start.
    apiFn.node.addDependency(salt);

    // --- analysis worker Lambda (design §2): invoked asynchronously by POST /analysis ----
    const workerFn = new NodejsFunction(this, 'AnalysisWorkerFunction', {
      functionName: `${prefix}-analysis-worker`,
      entry: repoPath('services/api/src/handlers/analysisWorker.ts'),
      handler: 'handler',
      projectRoot: repoPath(''),
      depsLockFilePath: repoPath('pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(90),
      // The worker records `failed` itself and ignores non-queued analyses, so Lambda's
      // async retries would only add cost. A lost run shows as failed after 120 s (Req 5.5).
      retryAttempts: 0,
      logGroup: new LogGroup(this, 'AnalysisWorkerLogs', {
        logGroupName: `/aws/lambda/${prefix}-analysis-worker`,
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        APP_STAGE: stage,
        TABLE_NAME: table.tableName,
        BUCKET_NAME: bucket.bucketName,
        MODEL_ID: modelId,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: OutputFormat.CJS,
        target: 'node22',
        minify: true,
        sourceMap: true,
        externalModules: [],
      },
    });
    apiFn.addEnvironment('WORKER_FUNCTION_NAME', workerFn.functionName);

    // Least privilege (Req 15.2, design §11). Grants arrive with the routes that need them;
    // api-side Bedrock is for confirmRewrite and the interview (tasks 13, 17); Transcribe for task 18.
    // Sessions, auth, quotas, rate limit, and global budget (task 8).
    table.grant(
      apiFn,
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:Query',
      'dynamodb:DeleteItem',
      'dynamodb:BatchWriteItem',
    );
    // Presigned resume POSTs are signed with this role, so it needs PutObject on resumes/*.
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [bucket.arnForObjects('resumes/*')],
      }),
    );
    // Audio answers (task 18, Req 10.4, 10.6). The role signs the presigned audio POST
    // (PutObject on audio/*), reads the finished transcript, and Transcribe reads the audio and
    // writes the transcript with these same caller permissions (no separate data-access
    // role; the write to transcripts/* is what the dev verification in task 18 confirms).
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [bucket.arnForObjects('audio/*'), bucket.arnForObjects('transcripts/*')],
      }),
    );
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [bucket.arnForObjects('audio/*'), bucket.arnForObjects('transcripts/*')],
      }),
    );
    // Transcribe job APIs don't support resource-level permissions, so `*` is required
    // (design §11). Only these three actions; no ListTranscriptionJobs or vocabulary APIs.
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'transcribe:StartTranscriptionJob',
          'transcribe:GetTranscriptionJob',
          'transcribe:DeleteTranscriptionJob',
        ],
        resources: ['*'],
      }),
    );
    // DELETE /sessions/{id}: list and delete the session's objects (Req 2.5).
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:DeleteObject'],
        resources: EPHEMERAL_PREFIXES.map((p) => bucket.arnForObjects(`${p}*`)),
      }),
    );
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [bucket.bucketArn],
        conditions: { StringLike: { 's3:prefix': EPHEMERAL_PREFIXES.map((p) => `${p}*`) } },
      }),
    );
    // SecureString under the AWS-managed aws/ssm key: no explicit kms:Decrypt grant needed.
    apiFn.addToRolePolicy(
      new PolicyStatement({ actions: ['ssm:GetParameter'], resources: [saltParamArn] }),
    );
    // POST /analysis invokes the worker asynchronously (task 9). Only this function.
    workerFn.grantInvoke(apiFn);
    // POST /confirmations calls confirmRewrite on the configured model only (task 13):
    // same Region-scoped ARNs as the worker, nothing broader.
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: bedrockModelArns(this, modelId),
      }),
    );

    // Worker: its own session items and the global budget counter (task 9).
    table.grant(workerFn, 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem');
    // Read the uploaded resume, then delete it (Req 4.3).
    workerFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:DeleteObject'],
        resources: [bucket.arnForObjects('resumes/*')],
      }),
    );
    // Converse on the configured model only: the cross-Region inference profile plus the
    // foundation model in each Region the profile routes to (design §11).
    workerFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: bedrockModelArns(this, modelId),
      }),
    );

    // --- HTTP API with stage throttling (Req 16.1) and CORS allowlist (Req 15.6) ------
    const httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `${prefix}-api`,
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: allowedOrigins,
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.DELETE],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
    });
    const stageResource = new HttpStage(this, 'DefaultStage', {
      httpApi,
      stageName: '$default',
      autoDeploy: true,
      throttle: API_THROTTLE,
    });
    const integration = new HttpLambdaIntegration('ApiIntegration', apiFn);
    const apiRoutes: [string, HttpMethod[]][] = [
      ['/v1/health', [HttpMethod.GET]],
      ['/v1/sessions', [HttpMethod.POST]],
      ['/v1/sessions/{sessionId}', [HttpMethod.GET, HttpMethod.DELETE]],
      ['/v1/sessions/{sessionId}/uploads/resume', [HttpMethod.POST]],
      ['/v1/sessions/{sessionId}/analysis', [HttpMethod.GET, HttpMethod.POST]],
      ['/v1/sessions/{sessionId}/recommendations/{recId}/decision', [HttpMethod.POST]],
      ['/v1/sessions/{sessionId}/confirmations', [HttpMethod.POST]],
      ['/v1/sessions/{sessionId}/interview', [HttpMethod.GET, HttpMethod.POST]],
      ['/v1/sessions/{sessionId}/turns/{turnId}/answer', [HttpMethod.POST]],
      ['/v1/sessions/{sessionId}/turns/{turnId}/uploads/audio', [HttpMethod.POST]],
      ['/v1/sessions/{sessionId}/turns/{turnId}/transcription', [HttpMethod.GET, HttpMethod.POST]],
    ];
    for (const [path, methods] of apiRoutes) httpApi.addRoutes({ path, methods, integration });

    new CfnOutput(this, 'ApiUrl', { value: stageResource.url });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
