/**
 * ProofAndPoiseStack: walking skeleton (task 4).
 * DynamoDB single table, private upload bucket, `api` Lambda, and an HTTP API with
 * stage throttling. No VPC, no NAT, no always-on compute (Req 16.6).
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

    // Least privilege (Req 15.2, design §11). Grants arrive with the routes that need them;
    // Bedrock, Transcribe, and worker invoke come in later tasks.
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
    ];
    for (const [path, methods] of apiRoutes) httpApi.addRoutes({ path, methods, integration });

    new CfnOutput(this, 'ApiUrl', { value: stageResource.url });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
