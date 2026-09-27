import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveConfig } from '../lib/config';
import { ProofAndPoiseStack } from '../lib/proof-and-poise-stack';

let template: Template;

beforeAll(() => {
  // Skip esbuild bundling in unit tests; `cdk synth` exercises the real bundle.
  const app = new App({ context: { stage: 'dev', 'aws:cdk:bundling-stacks': [] } });
  const stack = new ProofAndPoiseStack(app, 'Test', {
    config: resolveConfig(app),
    env: { region: 'us-east-1' },
  });
  template = Template.fromStack(stack);
});

type Statement = { Action?: string | string[] };

function allIamActions(): string[] {
  const policies = template.findResources('AWS::IAM::Policy');
  const roles = template.findResources('AWS::IAM::Role');
  const statements: Statement[] = [];
  for (const p of Object.values(policies)) {
    statements.push(...(p.Properties.PolicyDocument.Statement as Statement[]));
  }
  for (const r of Object.values(roles)) {
    for (const inline of (r.Properties.Policies ?? []) as {
      PolicyDocument: { Statement: Statement[] };
    }[]) {
      statements.push(...inline.PolicyDocument.Statement);
    }
  }
  return statements.flatMap((s) =>
    Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : [],
  );
}

describe('ProofAndPoiseStack', () => {
  it('has no NAT gateway or VPC (Req 16.6)', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
    template.resourceCountIs('AWS::EC2::VPC', 0);
  });

  it('blocks all public access on the upload bucket, with SSE-S3 and TLS-only policy', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  it('expires resumes/, audio/, and transcripts/ after 1 day (Req 4.2)', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: Match.arrayWith(
          ['resumes/', 'audio/', 'transcripts/'].map((prefix) =>
            Match.objectLike({ Prefix: prefix, ExpirationInDays: 1, Status: 'Enabled' }),
          ),
        ),
      },
    });
  });

  it('restricts bucket CORS to POST from the allowlist', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: [
          Match.objectLike({ AllowedMethods: ['POST'], AllowedOrigins: ['http://localhost:5173'] }),
        ],
      },
    });
  });

  it('enables TTL on an on-demand table without PITR', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      BillingMode: 'PAY_PER_REQUEST',
      Replicas: [
        Match.objectLike({
          PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false },
        }),
      ],
    });
  });

  it('configures stage throttling at 10 rps / burst 20 (Req 16.1)', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
    });
  });

  it('exposes GET /v1/health and CORS only for allowed origins', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'GET /v1/health' });
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({ AllowOrigins: ['http://localhost:5173'] }),
    });
  });

  it('runs the api Lambda on arm64 nodejs22.x, 512 MB, 25 s, with 14-day logs', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'proof-and-poise-dev-api',
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      MemorySize: 512,
      Timeout: 25,
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/proof-and-poise-dev-api',
      RetentionInDays: 14,
    });
  });

  it('grants no bedrock:* or * wildcard actions', () => {
    const actions = allIamActions();
    expect(actions).not.toContain('bedrock:*');
    expect(actions).not.toContain('*');
    expect(actions.filter((a) => /^bedrock:.*\*/.test(a))).toEqual([]);
  });
});

describe('resolveConfig', () => {
  it('rejects unknown stages and wildcard origins', () => {
    expect(() => resolveConfig(new App({ context: { stage: 'qa' } }))).toThrow(/Invalid stage/);
    expect(() =>
      resolveConfig(
        new App({ context: { stage: 'dev', allowedOrigins: 'https://*.example.com' } }),
      ),
    ).toThrow(/Invalid CORS origin/);
  });
});
