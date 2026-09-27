/** AWS SDK v3 clients, created once per cold start and shared across requests. */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface AwsClients {
  ddb: DynamoDBDocumentClient;
  s3: S3Client;
  ssm: SSMClient;
}

export function createAwsClients(): AwsClients {
  // Region comes from AWS_REGION, which Lambda always sets.
  return {
    ddb: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
    s3: new S3Client({}),
    ssm: new SSMClient({}),
  };
}
