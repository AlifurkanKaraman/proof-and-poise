---
inclusion: always
---

# Tech stack and commands

Versions below are pinned in the manifests (`.npmrc` has `save-exact=true` and `engine-strict=true`). Check the manifest before relying on a version.

- Package manager: pnpm `10.34.5` (root `packageManager`). Workspaces: `apps/web`, `packages/*`, `services/*`, `infrastructure` (`pnpm-workspace.yaml`). Never use npm or yarn here.
- Node: `.nvmrc` = 22, `engines.node >=22`. Lambda runtime is `nodejs22.x` on arm64.
- Language: TypeScript `6.0.3`, ESM (`"type": "module"`) everywhere, strict `tsconfig.base.json` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noEmit`.
- Validation: Zod `4.6.5` (shared schemas, API env).
- Web (`@proof-and-poise/web`): React 19, react-router 8 (lazy route objects), Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), `radix-ui`, `class-variance-authority`, `framer-motion`, `lucide-react`, self-hosted `@fontsource-variable` fonts.
- API (`@proof-and-poise/api`): plain Lambda handler + small in-house router; bundled by CDK `NodejsFunction` (esbuild). No build step of its own.
- Shared (`@proof-and-poise/shared`): consumed as TypeScript source via `exports`; no build step.
- Infra (`@proof-and-poise/infrastructure`): `aws-cdk-lib` `2.271.0`, local CDK CLI `aws-cdk` `2.1143.0` (run through `pnpm`, not a global install), `tsx` runs `bin/app.ts`. Region `us-east-1`.
- Tests: Vitest `4.1.11` in every package; `fast-check` for property tests in shared; Testing Library + jsdom for web; `aws-cdk-lib/assertions` for infra.
- Lint/format: ESLint 10 flat config (`eslint.config.js`) + Prettier 3 (`.prettierrc`: single quotes, trailing commas, width 100).

## Commands (root)

| Command | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install exactly what the lockfile says (what CI runs). |
| `pnpm typecheck` | `tsc` in every package. |
| `pnpm lint` | `eslint .` then `prettier --check .` (read-only). |
| `pnpm test` | `vitest run` in every package. |
| `pnpm build` | Vite build for web and `cdk synth --quiet --context stage=dev` for infra (writes `infrastructure/cdk.out/`, runs esbuild; may read local AWS credentials to resolve the account, but doesn't change cloud resources). |
| `pnpm format` | `prettier --write .` over the whole repo. Don't run it routinely; format only the files you changed (`pnpm exec prettier --write <files>`). |

Single package: `pnpm --filter @proof-and-poise/<web|api|shared|infrastructure> <script>`. Web dev server: `pnpm --filter @proof-and-poise/web dev` (port 5173, `strictPort`).

## CI

`.github/workflows/ci.yml` runs on PRs and pushes to `develop` and `main`: frozen install → typecheck → lint → test → build, plus a gitleaks scan (`.gitleaks.toml`). Keep local verification in the same order.

## Not yet present

Playwright, axe, MSW, TanStack Query, `amplify.yml`, and `docs/` are planned in design.md but not installed or created. Don't assume they exist.
