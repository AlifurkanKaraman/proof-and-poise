# Proof & Poise

Evidence-grounded job readiness. A candidate gives a resume and a job description. Proof & Poise maps the job's competencies to verbatim resume evidence and helps the candidate tailor the resume to the job truthfully: supported changes approved one at a time, proven job keywords listed in Skills, confirmations for real experience, and a downloadable tailored resume. Step 2 is a five-question adaptive mock interview aimed at the weakest evidence, with an explainable readiness report.

The tailored resume downloads as `.txt`, `.docx` or `.pdf`, in "Your original order" or a one-column "Jake's Resume" style. Files are built in the browser from the same text the Resume tab shows, with no model call; a property-tested check ensures every line appears once in the candidate's own wording and the only added text is a section heading. Layout inspired by [Jake's Resume](https://github.com/jakegut/resume) (MIT). PDF font: Crimson Text (SIL OFL 1.1, `apps/web/src/assets/fonts/crimson-text/OFL.txt`).

The model writes language only. Scores, grounding checks, strength caps, follow-up decisions, and quotas are deterministic TypeScript in `packages/shared`.

Built for the AWS "Zero to Shipped" Shipathon.

- Hosted app: https://main.d1tn5k7jq2sjsu.amplifyapp.com (try `/demo` for the fictional journey).
- Try it locally without AWS: `pnpm install --frozen-lockfile && pnpm --filter @proof-and-poise/web dev:mock`, then open `http://localhost:5173/demo`.

## Stack

React 19, Vite, Tailwind CSS 4, and Radix UI on the web. An API Lambda and an analysis-worker Lambda (Node.js 22, arm64) behind an API Gateway HTTP API. DynamoDB (on-demand, TTL), S3 (private, 1-day lifecycle), Amazon Bedrock (Nova Lite), Amazon Transcribe (deployed, off in the MVP: answers are typed), SSM Parameter Store, and CloudWatch Logs, all defined with AWS CDK in `us-east-1`. Hosting on AWS Amplify is planned.

## Repository

| Path              | Contents                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| `apps/web`        | React SPA, MSW mocks, Playwright e2e                                                  |
| `packages/shared` | Zod schemas, API contracts, scoring, grounding, interview rules, limits, demo fixture |
| `services/api`    | Lambda handlers, routes, services, Bedrock client                                     |
| `infrastructure`  | CDK app (`ProofAndPoise-<stage>`) and assertion tests                                 |
| `.kiro`           | Spec (requirements, design, tasks), steering, skills                                  |
| `docs`            | Documentation set below                                                               |

## Documentation

1. [Problem and users](docs/01-problem-and-users.md)
2. [Originality](docs/02-originality.md)
3. [Architecture](docs/03-architecture.md) (Mermaid diagram)
4. [AWS services](docs/04-aws-services.md)
5. [Kiro and the Agent Toolkit for AWS](docs/05-kiro-and-agent-toolkit.md)
6. [Timeline](docs/06-timeline.md)
7. [Security and privacy](docs/07-security-privacy.md)
8. [Cost controls](docs/08-cost-controls.md) (including AWS Budgets setup)
9. [Known limitations](docs/09-limitations.md)
10. [React Native plan](docs/10-react-native-plan.md)
11. [Deploy and teardown](docs/11-deploy-and-teardown.md)
12. [Demo guide](docs/12-demo-guide.md)
13. [Judging map](docs/13-judging-map.md)
14. [Submission story](docs/14-submission-story.md)

Also: [analysis prompt evaluation](docs/analysis-prompt-evaluation.md), [Amplify hosting](docs/amplify-hosting.md) (task 10 branch), [screenshots checklist](docs/screenshots/README.md), and [HANDOFF.md](HANDOFF.md).

## Develop

Requires Node 22 (`.nvmrc`) and pnpm 10.34.5. Don't use npm or yarn.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Web dev server: `pnpm --filter @proof-and-poise/web dev` (real API through `VITE_API_BASE_URL` in `apps/web/.env.local`) or `dev:mock` (MSW). E2E: `pnpm --filter @proof-and-poise/web e2e`.

## Deploy

Deploys change AWS resources and need the account owner's explicit authorization. Full steps: [docs/11-deploy-and-teardown.md](docs/11-deploy-and-teardown.md).

```sh
export AWS_PROFILE=<your-profile> AWS_REGION=us-east-1
pnpm --filter @proof-and-poise/infrastructure run cdk bootstrap            # once per account/region
pnpm --filter @proof-and-poise/infrastructure run cdk diff --context stage=dev
pnpm --filter @proof-and-poise/infrastructure run cdk deploy --context stage=dev
aws cloudformation describe-stacks --stack-name ProofAndPoise-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

Set that URL as `VITE_API_BASE_URL` for the web app (locally in `apps/web/.env.local`, or in the Amplify branch environment), and add the web origin to `proof-and-poise:allowedOrigins` in `infrastructure/cdk.json`.

## Teardown

Deletes the stage's table, bucket, objects, logs, and salt parameter. It can't be undone; get explicit authorization first.

```sh
pnpm --filter @proof-and-poise/infrastructure run cdk destroy --context stage=<stage>
```

Then delete the Amplify app in the Amplify console. Details: [docs/11-deploy-and-teardown.md](docs/11-deploy-and-teardown.md#teardown).

## License

See [LICENSE](LICENSE).
