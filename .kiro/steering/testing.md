---
inclusion: auto
name: testing
description: Use when choosing which verification checks to run for a change (shared logic, schemas or contracts, API, web UI, CDK, dependencies, config or CI, docs, or Kiro steering, skills, and scripts), or when reporting what was and wasn't verified.
---

# Choosing checks

`engineering.md` (Testing) is the always-on summary. This table maps change types to the narrowest real commands. Run the narrow check first, then widen in CI order (`pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`). Never claim a check that didn't run in this session.

Single file: `pnpm --filter @proof-and-poise/<web|api|shared|infrastructure> exec vitest run <path>` (path relative to the package).

| Change | Checks |
| --- | --- |
| Shared scoring, grounding, keywords, tailoring | `pnpm --filter @proof-and-poise/shared typecheck` and `test`; `node .kiro/scripts/eval-regression.mjs --force`; the `evaluate-scoring-change` skill. Property tests in `properties.test.ts` must stay green. |
| Shared schemas or contracts | shared + api + web `typecheck` and `test` (consumers break silently otherwise); `apps/web/src/mocks/handlers.test.ts` keeps MSW in sync. |
| API routes or services | `pnpm --filter @proof-and-poise/api typecheck` and `test`, or a single file such as `src/routes/analysis.test.ts`. |
| Prompts (`services/api/src/ai/prompts/*`) | api `test` + offline evaluator (`src/eval/evaluate.test.ts`). Live eval only with explicit authorization (billable). |
| Logger or env | `src/lib/logger.test.ts`, `src/lib/env.test.ts` (api). |
| Web UI | web `typecheck` and `test` (single file as above); `pnpm e2e` for flows or layout (browsers must be installed); manual checks in `apps/web/ACCESSIBILITY.md` at 375/768/1280 px. Say which you did. |
| Infrastructure | the `cdk-change` skill: infra `typecheck`, `test`, `synth`. |
| Dependencies | the `dependency-change` skill; then `pnpm install --frozen-lockfile` and the full CI order. |
| Shared config or CI (`eslint.config.js`, `tsconfig*`, `.prettierrc`, workflows) | full `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`. |
| Docs only (`docs/`, `README.md`, `HANDOFF.md`, `CLAUDE.md`) | `pnpm exec prettier --check <files>`. |
| `.kiro/` steering, skills, specs | Not linted (`.kiro` is ignored). Read back: front matter is the first thing in the file, keys valid, skill `name` equals its folder. |
| `.kiro/scripts/*.mjs` | `node --check <file>`; `pnpm exec eslint --no-ignore <files>`; `pnpm exec prettier --check --ignore-path .gitignore <files>`; pipe sample hook JSON on STDIN. |

## Notes

- `pnpm build` runs `cdk synth`, which may read local AWS credentials to resolve the account. Skip it for docs-only or `.kiro/` changes and say so.
- Untracked tool-output folders that aren't in `.prettierignore` (for example `.agents/`) can fail `prettier --check .`. Exclude them for the local run (`pnpm exec prettier --check . '!.agents/**'`) and report it; don't format or delete them.
- A bug fix gets a regression test that fails before the fix (the `debug-root-cause` skill).
