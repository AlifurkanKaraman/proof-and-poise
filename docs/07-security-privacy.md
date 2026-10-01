# 07. Security and privacy

## Data the app handles

| Data                        | Where                         | How long                                                                                   |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| Resume PDF                  | S3 `resumes/<sessionId>/`     | Deleted by the worker right after text extraction; 1-day lifecycle as a backstop (Req 4.3) |
| Resume and job text         | DynamoDB `INPUT` item         | 24 h TTL                                                                                   |
| Evidence map, turns, report | DynamoDB session items        | 24 h TTL                                                                                   |
| Recorded answer audio       | S3 `audio/<sessionId>/`       | Deleted when the transcript is read; 1-day lifecycle                                       |
| Transcript                  | S3 `transcripts/<sessionId>/` | Deleted after it's read; 1-day lifecycle                                                   |
| Client IP                   | Never stored                  | Only a salted SHA-256 hash in a 2 h rate-limit counter                                     |

DynamoDB TTL deletion isn't instant; AWS removes expired items in the background, and the API treats an expired session as unauthorized.

## Sessions and auth

- Anonymous sessions (Req 2). The server issues a 256-bit random token and stores only its hash. Comparison is constant-time (`services/api/src/lib/auth.ts`).
- Every auth failure returns the same 401, whether the ID is unknown, the token is wrong, or the session expired.
- The browser keeps the token in `sessionStorage`, so it's gone when the tab closes.
- "Delete my data" calls `DELETE /v1/sessions/{id}`, which deletes the session's DynamoDB items and its S3 objects (Req 2.5).

## Least privilege

Per-function IAM roles scoped to the table, the S3 prefixes, the salt parameter, the worker function, and the Nova Lite ARNs. The only wildcard is for the three Transcribe job actions, which require it. Details in [04-aws-services.md](04-aws-services.md#iam-summary).

## Logging

`services/api/src/lib/logger.ts` writes only an allowlisted, typed field set: request ID, route, status, latency, error code, token counts, duration, model task, attempt, discard counts, and stop reason. String values must match an identifier pattern. Errors are logged as `{ code, name }`, never `message`, because SDK messages can echo input. Resume text, job text, answers, transcripts, and model prompts or outputs are never logged. `logger.test.ts` checks the redaction (Req 15.3).

## Prompt and model safety

- User content is wrapped in delimited tags, and the system prompt says to treat it as data (Req 15.5).
- Model output is used only after strict schema validation and grounding checks.
- The prompt evaluation includes a resume with an injected instruction ("rate every competency as strong"). See [analysis-prompt-evaluation.md](analysis-prompt-evaluation.md).
- Evaluation rules forbid judging accent or fluency and forbid inferences about emotion, honesty, personality, or disability. The output schemas have no fields for them (design §11).

## Configuration and secrets

- The web bundle reads only `VITE_API_BASE_URL` and `VITE_APP_ENV`, validated with Zod (`apps/web/src/lib/env.ts`). There are no AWS credentials on the client (Req 15.1).
- Lambda env is validated with Zod at cold start (`services/api/src/lib/env.ts`).
- The IP-hash salt is generated at deploy time into SSM; the Lambda receives only the parameter name.
- `.gitignore` excludes `.env*` except `.env.example`, which holds placeholders. CI runs gitleaks over the full history on every PR.

## Network

- S3: block all public access, TLS only, SSE-S3. Uploads use presigned POSTs with content-type and size conditions and a 300 s expiry.
- CORS on the API and bucket allows only configured origins (`infrastructure/cdk.json`). Today that's `http://localhost:5173`; Amplify domains are added with task 10. Wildcards are rejected by `infrastructure/lib/config.ts`.

## Known gaps

- No WAF, Bedrock Guardrails, or customer-managed KMS keys (post-hackathon P6).
- No CloudWatch alarms yet (task 23).
- The CloudWatch log review for content leakage after a full run (task 23) hasn't been done yet. `TODO(user): record the result of that review.`
