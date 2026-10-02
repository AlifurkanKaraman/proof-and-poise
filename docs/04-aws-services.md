# 04. AWS services

Region: `us-east-1`. Everything except Amplify is created by `infrastructure/lib/proof-and-poise-stack.ts`.

| Service                             | What it does here                                                                                   | Key settings                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Amazon API Gateway (HTTP API)       | Public entry point for `/v1/*`                                                                      | Stage throttle 10 req/s, burst 20; CORS allowlist from `cdk.json` (today `http://localhost:5173` only)                                                 |
| AWS Lambda: `api`                   | All routes through an in-house router                                                               | `nodejs22.x`, arm64, 512 MB, 25 s; env validated with Zod at cold start                                                                                |
| AWS Lambda: `analysis-worker`       | PDF extraction, Bedrock analysis, grounding, scoring                                                | `nodejs22.x`, arm64, 1024 MB, 90 s; invoked asynchronously; retries off                                                                                |
| Amazon Bedrock                      | Language generation: analysis, confirmation rewrite, questions, answer evaluation, report narrative | Nova Lite via the `us.amazon.nova-lite-v1:0` inference profile; `Converse` with forced tool use; per-task `maxTokens` and temperature (`LIMITS.model`) |
| Amazon Transcribe                   | Batch transcription of recorded answers                                                             | `en-US`, language identification off; output written to `transcripts/<sessionId>/`; job deleted after read                                             |
| Amazon DynamoDB                     | Sessions, analysis, turns, report, quota and budget counters                                        | Single table, on-demand, AWS-owned encryption, TTL `ttl`, PITR off, `RemovalPolicy.DESTROY`                                                            |
| Amazon S3                           | Short-lived uploads (resumes, audio, transcripts)                                                   | Block all public access, TLS only, SSE-S3, bucket-owner-enforced, 1-day expiration per prefix, auto-delete on teardown                                 |
| AWS Systems Manager Parameter Store | IP-hash salt (`/proof-and-poise/<stage>/ip-hash-salt`)                                              | SecureString, Standard tier; generated at deploy by a custom resource; never in the template or repo                                                   |
| Amazon CloudWatch Logs              | Allowlisted structured logs                                                                         | 14-day retention on every log group                                                                                                                    |
| AWS Amplify Hosting                 | Builds and hosts `apps/web` from GitHub (`main` = production, `develop` = preview)                  | Planned (task 10). See [amplify-hosting.md](amplify-hosting.md) once that branch is merged                                                             |
| AWS Budgets                         | Spend alerts                                                                                        | Planned at $5 and $8 (task 23), not created yet. See [08-cost-controls.md](08-cost-controls.md)                                                        |

Not used, on purpose (Req 16.6): VPC, NAT gateway, provisioned throughput, always-on compute, RDS, OpenSearch, ECS/EKS, WAF, vector databases.

## IAM summary

Each Lambda has its own role scoped to resource ARNs (Req 15.2, design §11):

- `api`: listed DynamoDB actions on the table; S3 put/get/delete only on the `resumes/`, `audio/`, and `transcripts/` prefixes; `s3:ListBucket` with a prefix condition (for delete-my-data); `ssm:GetParameter` on the salt parameter; `lambda:InvokeFunction` on the worker; `bedrock:InvokeModel` on the Nova Lite inference profile and its foundation-model ARNs.
- `analysis-worker`: get/put/update on the table, get/delete on `resumes/*`, and the same Bedrock ARNs.
- The only wildcard resource is for the three Transcribe job actions, which don't support resource-level permissions.

`infrastructure/test/stack.test.ts` asserts these properties (no NAT, public access blocked, lifecycle, TTL, throttling, no `bedrock:*`).

## Not yet created

- CloudWatch alarms and the SNS email topic (task 23).
- The `prod` stage stack (task 23).

## Look up deployed values

Don't paste these into docs or screenshots.

```sh
aws cloudformation describe-stacks --stack-name ProofAndPoise-dev \
  --query "Stacks[0].Outputs" --output table
```
