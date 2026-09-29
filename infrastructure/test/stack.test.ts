import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveConfig } from '../lib/config';
import { bedrockModelArns, ProofAndPoiseStack } from '../lib/proof-and-poise-stack';

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

type PolicyStatementJson = { Action: string | string[]; Resource: unknown; Condition?: unknown };

const actionsOf = (s: PolicyStatementJson) => (Array.isArray(s.Action) ? s.Action : [s.Action]);

/** Statements of the inline policy attached to the role of the function with this logical ID prefix. */
function policyStatements(fnLogicalId: string): PolicyStatementJson[] {
  const policy = Object.values(template.findResources('AWS::IAM::Policy')).find((p) =>
    JSON.stringify(p.Properties.Roles).includes(`${fnLogicalId}ServiceRole`),
  );
  expect(policy).toBeDefined();
  return policy!.Properties.PolicyDocument.Statement as PolicyStatementJson[];
}

describe('bedrockModelArns', () => {
  it('uses only the in-Region foundation model for a bare model ID', () => {
    const stack = new Stack(new App(), 'Bare', { env: { region: 'us-east-1' } });
    const arns = bedrockModelArns(stack, 'amazon.nova-lite-v1:0');
    expect(arns).toHaveLength(1);
    expect(arns[0]).toMatch(/:bedrock:us-east-1::foundation-model\/amazon\.nova-lite-v1:0$/);
  });

  it('adds the inference profile and its US Regions for a us. profile ID', () => {
    const stack = new Stack(new App(), 'Profile', { env: { region: 'us-east-1' } });
    const arns = bedrockModelArns(stack, 'us.amazon.nova-lite-v1:0');
    expect(arns).toHaveLength(4);
    expect(arns[0]).toMatch(/:inference-profile\/us\.amazon\.nova-lite-v1:0$/);
  });
});

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

  it('routes the session and resume-upload endpoints (task 8)', () => {
    for (const key of [
      'POST /v1/sessions',
      'GET /v1/sessions/{sessionId}',
      'DELETE /v1/sessions/{sessionId}',
      'POST /v1/sessions/{sessionId}/uploads/resume',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: key });
    }
  });

  it('passes the salt parameter name, not the salt, to the api Lambda (Req 16.3)', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'proof-and-poise-dev-api',
      Environment: {
        Variables: Match.objectLike({ IP_HASH_SALT_PARAM: '/proof-and-poise/dev/ip-hash-salt' }),
      },
    });
    template.hasResourceProperties('Custom::IpHashSalt', {
      ParameterName: '/proof-and-poise/dev/ip-hash-salt',
    });
    // No plaintext parameter in the template: the value is generated at deploy time.
    template.resourceCountIs('AWS::SSM::Parameter', 0);
  });

  it('scopes api data-plane grants to the table, session prefixes, and the salt', () => {
    const apiPolicy = Object.values(template.findResources('AWS::IAM::Policy')).find((p) =>
      JSON.stringify(p.Properties.Roles).includes('ApiFunction'),
    );
    expect(apiPolicy).toBeDefined();
    const statements = apiPolicy!.Properties.PolicyDocument.Statement as {
      Action: string | string[];
      Resource: unknown;
      Condition?: unknown;
    }[];
    const byAction = (a: string) =>
      statements.find((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]).includes(a));

    expect(byAction('dynamodb:BatchWriteItem')?.Action).toEqual([
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:Query',
      'dynamodb:DeleteItem',
      'dynamodb:BatchWriteItem',
    ]);
    expect(JSON.stringify(byAction('s3:PutObject')?.Resource)).toContain('/resumes/*');
    expect(JSON.stringify(byAction('s3:DeleteObject')?.Resource)).toMatch(
      /resumes\/\*.*audio\/\*.*transcripts\/\*/,
    );
    expect(byAction('s3:ListBucket')?.Condition).toEqual({
      StringLike: { 's3:prefix': ['resumes/*', 'audio/*', 'transcripts/*'] },
    });
    expect(JSON.stringify(byAction('ssm:GetParameter')?.Resource)).toContain(
      ':parameter/proof-and-poise/dev/ip-hash-salt',
    );
    expect(byAction('ssm:PutParameter')).toBeUndefined();
  });

  it('runs the analysis worker on arm64 nodejs22.x, 1024 MB, 90 s, no retries (task 9)', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'proof-and-poise-dev-analysis-worker',
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      MemorySize: 1024,
      Timeout: 90,
      Environment: {
        Variables: Match.objectLike({ MODEL_ID: 'us.amazon.nova-lite-v1:0', APP_STAGE: 'dev' }),
      },
    });
    template.hasResourceProperties('AWS::Lambda::EventInvokeConfig', {
      MaximumRetryAttempts: 0,
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/proof-and-poise-dev-analysis-worker',
      RetentionInDays: 14,
    });
    // No reserved concurrency while the account limit is 10 (product.md).
    const fns = Object.values(template.findResources('AWS::Lambda::Function'));
    expect(fns.some((f) => f.Properties.ReservedConcurrentExecutions !== undefined)).toBe(false);
  });

  it('routes POST and GET /analysis and tells the api which worker to invoke', () => {
    for (const key of [
      'POST /v1/sessions/{sessionId}/analysis',
      'GET /v1/sessions/{sessionId}/analysis',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: key });
    }
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'proof-and-poise-dev-api',
      Environment: {
        Variables: Match.objectLike({ WORKER_FUNCTION_NAME: Match.anyValue() }),
      },
    });
  });

  it('routes POST decision and confirmations (task 13)', () => {
    for (const key of [
      'POST /v1/sessions/{sessionId}/recommendations/{recId}/decision',
      'POST /v1/sessions/{sessionId}/confirmations',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: key });
    }
  });

  it('routes the interview start, read, and answer endpoints (task 17)', () => {
    for (const key of [
      'POST /v1/sessions/{sessionId}/interview',
      'GET /v1/sessions/{sessionId}/interview',
      'POST /v1/sessions/{sessionId}/turns/{turnId}/answer',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: key });
    }
  });

  it('routes the report and practice endpoints (task 21)', () => {
    for (const key of [
      'POST /v1/sessions/{sessionId}/report',
      'GET /v1/sessions/{sessionId}/report',
      'POST /v1/sessions/{sessionId}/practice',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: key });
    }
  });

  it('lets the api invoke only the worker and call only the configured model (confirmRewrite)', () => {
    const statements = policyStatements('ApiFunction');
    const invoke = statements.filter((s) => actionsOf(s).includes('lambda:InvokeFunction'));
    expect(invoke).toHaveLength(1);
    expect(JSON.stringify(invoke[0]?.Resource)).toContain('AnalysisWorkerFunction');

    const bedrockActions = statements.flatMap(actionsOf).filter((a) => a.startsWith('bedrock:'));
    expect(bedrockActions).toEqual(['bedrock:InvokeModel']);
    const bedrock = statements.find((s) => actionsOf(s).includes('bedrock:InvokeModel'))!;
    const resources = JSON.stringify(bedrock.Resource);
    expect(resources).toContain(':inference-profile/us.amazon.nova-lite-v1:0');
    expect(resources).not.toMatch(/foundation-model\/\*|inference-profile\/\*/);
  });

  it('scopes worker grants to the table, resumes/*, and the Nova Lite ARNs (design §11)', () => {
    const statements = policyStatements('AnalysisWorkerFunction');
    const byAction = (a: string) => statements.find((s) => actionsOf(s).includes(a));
    expect(actionsOf(byAction('dynamodb:GetItem')!)).toEqual([
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
    ]);
    const s3 = byAction('s3:GetObject')!;
    expect(actionsOf(s3)).toEqual(['s3:GetObject', 's3:DeleteObject']);
    expect(JSON.stringify(s3.Resource)).toContain('/resumes/*');
    expect(JSON.stringify(s3.Resource)).not.toMatch(/audio|transcripts/);

    const bedrock = byAction('bedrock:InvokeModel')!;
    expect(actionsOf(bedrock)).toEqual(['bedrock:InvokeModel']);
    const resources = JSON.stringify(bedrock.Resource);
    expect(resources).toContain(':inference-profile/us.amazon.nova-lite-v1:0');
    for (const region of ['us-east-1', 'us-east-2', 'us-west-2']) {
      expect(resources).toContain(`:bedrock:${region}::foundation-model/amazon.nova-lite-v1:0`);
    }
    expect(resources).not.toMatch(/foundation-model\/\*|inference-profile\/\*/);
    const actions = statements.flatMap(actionsOf);
    expect(actions).not.toContain('s3:PutObject');
    expect(actions).not.toContain('lambda:InvokeFunction');
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
