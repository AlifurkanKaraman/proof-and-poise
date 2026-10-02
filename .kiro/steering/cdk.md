---
inclusion: fileMatch
fileMatchPattern: "infrastructure/**"
---

# Infrastructure (AWS CDK)

- One stack, `ProofAndPoiseStack` (`lib/proof-and-poise-stack.ts`), instantiated in `bin/app.ts` as `ProofAndPoise-<stage>` in `us-east-1`. Stage, CORS origins, and model ID come from CDK context via `lib/config.ts` (`--context stage=dev|prod`, per-stage origins in `cdk.json`, `*` origins rejected).
- Cost rules (Req 16.6): no VPC, NAT, provisioned throughput, always-on compute, OpenSearch, RDS, ECS/EKS, paid WAF, or vector DB. Ephemeral data: `RemovalPolicy.DESTROY`, TTL on the table, 1-day S3 lifecycle, 14-day log retention.
- IAM (Req 15.2): least privilege with specific ARNs via `grant*` or scoped statements, added together with the route that needs them. No `bedrock:*` or `*` actions; any service-required wildcard gets a comment explaining why.
- Every stack change gets an assertion in `test/stack.test.ts`. Tests skip bundling with context `'aws:cdk:bundling-stacks': []`; `cdk synth` exercises the real esbuild bundle.
- Safe locally: `pnpm --filter @proof-and-poise/infrastructure test`, `... synth` (or root `pnpm build`), and `pnpm --filter @proof-and-poise/infrastructure run cdk diff --context stage=dev` (read-only, needs credentials).
- Run the CDK CLI through the package script (`pnpm --filter @proof-and-poise/infrastructure run cdk <cmd>`), not `pnpm ... exec cdk`: `NodejsFunction` bundles with `pnpm exec esbuild` from the repo root, and `esbuild` is only on PATH when CDK runs via `run`.
- Needs explicit authorization every time: `cdk bootstrap`, `cdk deploy`, `cdk destroy`, `cdk watch`/hotswap, and any mutating `aws` CLI call. `cdk.out/` is generated but is still not to be deleted without approval. Use the `cdk-change` skill.
