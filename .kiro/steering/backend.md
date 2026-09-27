---
inclusion: fileMatch
fileMatchPattern: "services/**"
---

# Backend (services/api)

- Request flow: `handlers/api.ts` (validates env with `loadEnv` at cold start) → `createRouter()` in `app.ts` → `Router` in `lib/router.ts` matches a shared `RouteContract` → thin handler in `routes/`. The router owns JSON serialization, security headers, error mapping, and the per-request log line.
- Route handlers return `{ status?, body? }` typed from the shared response schema (`z.infer<typeof XResponseSchema>`) and throw `ApiError` for expected failures. Keep business logic out of `routes/`; put it in `services/` (planned).
- Logging: only `logger.info|warn|error(event, fields)` from `lib/logger.ts`. Fields are allowlisted (`requestId`, `route`, `status`, `latencyMs`, `errorCode`, `inputTokens`, `outputTokens`, `durationMs`); errors are reduced to `{ code, name }`. Never log request bodies, resume or job text, answers, transcripts, prompts, or model output. If you need a new field, extend the allowlist and `logger.test.ts`.
- Env: add new variables to `EnvSchema` in `lib/env.ts` and to the Lambda `environment` in the stack together. `EnvError` reports key names only, never values.
- Model calls (planned, design §7): user content in delimited tags treated as data; output validated by schema and grounding checks before use; per-call token caps and temperatures from Req 16.5.
- Session-scoped routes require the bearer token, and errors must not reveal whether a session exists.
- AWS SDK v3 is provided by the Lambda runtime (`externalModules: ['@aws-sdk/*']`). Adding an SDK client for local types/tests is still a dependency change.
