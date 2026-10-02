# Amplify Hosting (task 10)

The web app (`apps/web`, a static Vite SPA) is hosted by AWS Amplify Hosting from GitHub. Build settings live in [`amplify.yml`](../amplify.yml); when that file exists Amplify uses it instead of console build settings. Req 17.5, 17.7.

Connecting the repo is a console step that needs a GitHub authorization, so the repo owner does it. Nothing below is automated.

## 1. Look up the API URL (read-only)

```sh
aws cloudformation describe-stacks --region us-east-1 \
  --stack-name ProofAndPoise-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

Use the `ProofAndPoise-prod` stack for `main` once prod exists. Until then, both branches can point at dev.

## 2. Connect the repo (Amplify console, us-east-1)

1. Amplify console → **Create new app** → **GitHub** → authorize, pick this repository, branch `develop`.
2. Tick **My app is a monorepo** and set the root directory to `apps/web`. Amplify sets `AMPLIFY_MONOREPO_APP_ROOT=apps/web`, which must match `appRoot` in `amplify.yml`.
3. Build settings: Amplify detects `amplify.yml`; leave it as is. No service role or backend is needed.
4. **Advanced settings → Environment variables** (values are not secrets, but don't paste them into chat or docs):
   - `VITE_API_BASE_URL` = the `ApiUrl` output from step 1
   - `VITE_APP_ENV` = `dev`
5. **Save and deploy**.
6. App → **Branch settings** → **Add branch** → `main`. In **Hosting → Environment variables → Manage variables**, add per-branch overrides for `main`: `VITE_APP_ENV` = `prod` and `VITE_API_BASE_URL` = the prod `ApiUrl` (or dev until prod is deployed).

## 3. SPA rewrite (console only)

`amplify.yml` supports custom headers but not rewrites. In **Hosting → Rewrites and redirects → Manage redirects**, the editor takes JSON, so the backslash is escaped (`\\.`). Replace its contents with:

```json
[
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
    "status": "200",
    "target": "/index.html"
  }
]
```

Status `200` is a rewrite: deep links such as `/demo` or `/s/<id>/analysis` serve the app and keep the URL.

## 4. Allow the Amplify domains in CORS

Each branch gets `https://<branch>.<appId>.amplifyapp.com` (shown on the app's overview page). The API Gateway CORS preflight, the S3 upload bucket CORS rule, and the Lambda `ALLOWED_ORIGINS` env all come from one list (`infrastructure/lib/config.ts`). Remote origins must be exact `https://host` values; `*`, paths, and `http://` are rejected at synth. `http://localhost:5173` is always kept.

Either pass them per deploy:

```sh
pnpm --filter @proof-and-poise/infrastructure exec cdk diff --context stage=dev \
  --context allowedOrigins=https://main.<appId>.amplifyapp.com,https://develop.<appId>.amplifyapp.com
```

or commit them under `proof-and-poise:allowedOrigins.dev` in `infrastructure/cdk.json` so later deploys keep them (an `allowedOrigins` override replaces the cdk.json list).

Then redeploy. This changes live resources, so it needs explicit authorization:

```sh
pnpm --filter @proof-and-poise/infrastructure exec cdk deploy ProofAndPoise-dev --context stage=dev \
  --context allowedOrigins=https://main.<appId>.amplifyapp.com,https://develop.<appId>.amplifyapp.com
```

Expected diff: CORS on the HTTP API and the upload bucket, plus the `ALLOWED_ORIGINS` env on the Lambdas. No replacements.

## 5. Verify

Open the `develop` preview URL: the landing page loads, `/demo` survives a reload (rewrite works), and the browser console shows no CORS errors when starting a session.

## Troubleshooting

- `ERR_PNPM_UNSUPPORTED_ENGINE`: the build image isn't on Node 22; check the `nvm use 22` step in the build log.
- Module resolution errors during the build: AWS docs suggest `node-linker=hoisted` in the root `.npmrc` for pnpm monorepos. This repo builds a static SPA and doesn't set it; add it only if the Amplify build actually needs it, and check `pnpm install` locally afterward.
- Teardown: delete the Amplify app in the console (App settings → General → Delete app). It doesn't touch the CDK stack.
