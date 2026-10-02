---
name: cdk-change
description: Use when changing infrastructure/ (ProofAndPoiseStack, config.ts, cdk.json), IAM grants, Lambda settings, or anything that would change AWS resources, and before any cdk synth, diff, bootstrap, deploy, or destroy. Tests and synthesizes locally, reviews the diff, and never deploys or destroys without explicit authorization.
---

# CDK change

1. Inspect: `git status --short`; read `infrastructure/lib/proof-and-poise-stack.ts`, `lib/config.ts`, `cdk.json`, `test/stack.test.ts`, and the relevant requirement (cost rules Req 16.6, IAM Req 15.2, CORS Req 15.6).
2. Edit the stack narrowly. Keep IAM scoped to specific resources, and add a matching assertion to `test/stack.test.ts`. If a Lambda env var changes, update `services/api/src/lib/env.ts` in the same change.
3. Verify locally, one command at a time:
   - `pnpm --filter @proof-and-poise/infrastructure typecheck`
   - `pnpm --filter @proof-and-poise/infrastructure test`
   - `pnpm --filter @proof-and-poise/infrastructure synth` (writes `cdk.out/`; don't delete it)
4. Review the proposed change. With credentials available and the user's go-ahead to read the account, run `pnpm --filter @proof-and-poise/infrastructure run cdk diff --context stage=<stage>` (read-only). Summarize added, modified, and replaced resources, IAM and security-group changes, and anything with `RemovalPolicy.DESTROY` that would be replaced. Redact account IDs.
5. Stop and ask before any of these, stating the stage, account (redacted), region, and exact resource changes:
   - `cdk bootstrap` (creates the CDKToolkit stack, an assets bucket, an ECR repo, and IAM roles)
   - `cdk deploy`, `cdk watch`, `--hotswap`
   - `cdk destroy` or deleting any stack or resource
   - any mutating `aws` CLI call, or a billable call such as Bedrock `Converse`
   Authorization covers only the specific command and stage the user approved.
6. After an authorized deploy, report the stack outputs (URL, table, bucket names) and a read-only smoke check such as `GET /v1/health`.
7. Report files changed, checks with results, and whether anything was deployed (default: nothing).
