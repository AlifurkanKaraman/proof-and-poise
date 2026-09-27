/**
 * ProofAndPoiseStack: walking skeleton (task 4).
 * DynamoDB single table, private upload bucket, `api` Lambda, and an HTTP API with
 * stage throttling. No VPC, no NAT, no always-on compute (Req 16.6).
 */
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableEncryptionV2, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import type { StageConfig } from './config';

export interface ProofAndPoiseStackProps extends StackProps {
  config: StageConfig;
}

const repoPath = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));

export const API_THROTTLE = { rateLimit: 10, burstLimit: 20 } as const;
export const EPHEMERAL_PREFIXES = ['resumes/', 'audio/', 'transcripts/'] as const;

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
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: OutputFormat.CJS,
        target: 'node22',
        minify: true,
        sourceMap: true,
        // The Lambda runtime provides AWS SDK v3.
        externalModules: ['@aws-sdk/*'],
      },
    });
    // Least privilege: the skeleton only serves /v1/health, so no data-plane grants yet.
    // Table, bucket, Bedrock, and Transcribe grants are added with the routes that need them.

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
    httpApi.addRoutes({
      path: '/v1/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('ApiIntegration', apiFn),
    });

    new CfnOutput(this, 'ApiUrl', { value: stageResource.url });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
