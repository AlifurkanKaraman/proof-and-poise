# 11. Deploy and teardown

Every `cdk bootstrap`, `cdk deploy`, and `cdk destroy` changes or deletes cloud resources and needs explicit authorization from the account owner (`.kiro/steering/safety.md`). Run them one at a time.

## Prerequisites

- Node 22 (`.nvmrc`) and pnpm 10.34.5 (`packageManager` in `package.json`).
- AWS CLI with a profile that can deploy CloudFormation stacks in `us-east-1`.
- Bedrock model access to Amazon Nova Lite in `us-east-1`.

```sh
pnpm install --frozen-lockfile
export AWS_PROFILE=<your-profile> AWS_REGION=us-east-1
```

## Verify locally first

Same order as CI:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build   # Vite build + cdk synth for dev; no cloud changes
```

## Deploy the backend

One-time per account and region (creates the `CDKToolkit` stack):

```sh
pnpm --filter @proof-and-poise/infrastructure run cdk bootstrap
```

Review, then deploy a stage (`dev` or `prod`):

```sh
pnpm --filter @proof-and-poise/infrastructure run cdk diff --context stage=dev
pnpm --filter @proof-and-poise/infrastructure run cdk deploy --context stage=dev
```

This creates the `ProofAndPoise-<stage>` stack: the DynamoDB table, the upload bucket, the `api` and `analysis-worker` Lambdas, the salt generator and its custom resource, the HTTP API, log groups, and the SSM salt parameter.

CORS origins come from `proof-and-poise:allowedOrigins` in `infrastructure/cdk.json`, per stage. Override for one deploy with `--context allowedOrigins=https://<origin-a>,https://<origin-b>`. `http://localhost:5173` is always included; `*` is rejected.

Get the API URL (don't commit it):

```sh
aws cloudformation describe-stacks --stack-name ProofAndPoise-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

Smoke check: `curl <ApiUrl>v1/health` should return 200.

## Run the web app

Against the deployed API: create `apps/web/.env.local` from the root `.env.example` and set `VITE_API_BASE_URL` to the ApiUrl, then:

```sh
pnpm --filter @proof-and-poise/web dev        # http://localhost:5173
```

Without AWS, everything mocked by MSW:

```sh
pnpm --filter @proof-and-poise/web dev:mock
```

## Hosting (Amplify)

Amplify Hosting builds `apps/web` from GitHub: `main` for production, `develop` as a preview. Set `VITE_API_BASE_URL` (the stage's ApiUrl) and `VITE_APP_ENV` in the Amplify branch environment variables, then add the Amplify domains to the CORS allowlist and redeploy the stack. Setup details: [amplify-hosting.md](amplify-hosting.md) (added on the task 10 branch).

`TODO(user): add the Amplify production and preview URLs once connected, or say where to look them up.`

## Teardown

Destroying a stack deletes all its data: the table, the bucket and its objects (auto-delete), log groups, and the SSM salt. It can't be undone. Get explicit authorization first.

```sh
pnpm --filter @proof-and-poise/infrastructure run cdk destroy --context stage=<stage>
```

Then:

1. Delete the Amplify app in the Amplify console (App settings → General → Delete app). This also removes its branch deployments.
2. Optional: delete the `CDKToolkit` stack in CloudFormation if nothing else in the account uses CDK. Empty its staging bucket first.
3. Optional: delete the AWS Budgets if they're no longer needed.
4. Check CloudFormation shows no `ProofAndPoise-*` stacks:

```sh
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?starts_with(StackName,'ProofAndPoise')].StackName"
```
