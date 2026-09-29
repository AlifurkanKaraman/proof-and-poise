/** AWS SDK v3 clients, created once per cold start and shared across requests. */
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface AwsClients {
  ddb: DynamoDBDocumentClient;
  s3: S3Client;
  ssm: SSMClient;
  lambda: LambdaClient;
  /** Only `POST /confirmations` calls the model from the API (design §7, confirmRewrite). */
  bedrock: BedrockRuntimeClient;
  transcribe: TranscribeClient;
}

export interface WorkerClients {
  ddb: DynamoDBDocumentClient;
  s3: S3Client;
  bedrock: BedrockRuntimeClient;
}

// Region comes from AWS_REGION, which Lambda always sets.
const createDdb = () =>
  DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

export function createAwsClients(): AwsClients {
  return {
    ddb: createDdb(),
    s3: new S3Client({}),
    ssm: new SSMClient({}),
    lambda: new LambdaClient({}),
    bedrock: new BedrockRuntimeClient({ maxAttempts: 2 }),
    transcribe: new TranscribeClient({}),
  };
}

/** The analysis worker needs only DynamoDB, S3, and Bedrock (design §11). */
export function createWorkerClients(): WorkerClients {
  return {
    ddb: createDdb(),
    s3: new S3Client({}),
    // One SDK-level retry for throttling; the schema repair retry is separate (design §7.1).
    bedrock: new BedrockRuntimeClient({ maxAttempts: 2 }),
  };
}
