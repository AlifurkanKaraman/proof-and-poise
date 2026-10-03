# Kiro hook helper scripts

Both scripts are read-only: they never write, format, or delete repo files, so they can't retrigger a file-save hook. Node 22 ESM, `node:` built-ins only. They run from the repo root (resolved from the script location), whatever the caller's working directory.

## lint-changed-file.mjs

Lints one changed source file with the repo's own config, without fixing anything.

- Input: file paths as arguments, `--changed` (all changed and untracked files), or hook event JSON on STDIN. The STDIN field that holds the path isn't documented, so it checks `file_path`, `filePath`, `path`, `paths`, `file`, `files` (top level and under `tool_input`), then scans string values for repo source paths.
- Checks only existing `.ts/.tsx/.js/.mjs/.cjs` files under `apps/`, `packages/`, `services/`, `infrastructure/` (not `node_modules`, `dist`, `build`, `cdk.out`, `coverage`, generated output).
- Runs `pnpm exec eslint --no-warn-ignored <files>` and `pnpm exec prettier --check <files>`, 60 s timeout each.
- Exit 0: nothing to check, passed, malformed or empty input, or tooling unavailable (prints SKIPPED). Exit 1: ESLint or Prettier found problems.

Manual alternative:

```sh
pnpm exec eslint --no-warn-ignored <file>
pnpm exec prettier --check <file>
node .kiro/scripts/lint-changed-file.mjs --changed
```

## eval-regression.mjs

Runs the offline evaluator regression suites when evaluation code changed.

- Default: looks at uncommitted changes (`git diff --name-only HEAD`), untracked files, and files committed on this branch since develop (`git diff --name-only develop...HEAD`, falling back to `origin/develop`; if neither resolves, only uncommitted and untracked files count). The branch range means the check still runs after the agent commits per `git-workflow.md`. If none match the evaluation code paths (`.kiro/steering/evaluation.md` globs, minus docs and specs), prints `eval-regression: no evaluator files changed; skipped.` and exits 0. `--force` runs regardless.
- Runs only these files, not the full suite:
  - `pnpm --filter @proof-and-poise/shared exec vitest run src/scoring src/grounding src/keywords src/tailoring src/properties.test.ts src/fixtures src/schemas`
  - `pnpm --filter @proof-and-poise/api exec vitest run src/eval/evaluate.test.ts src/services/evidenceMapBuilder.test.ts src/ai/prompts/analyze.test.ts`
- Removes `RUN_BEDROCK_EVAL` from the child environment, so the billable live evaluation never runs. Vitest may update its cache under `node_modules/.vite`, as `pnpm test` does.
- Exit status: 0 when skipped or passing, otherwise the first failing suite's status.

Manual alternative: `node .kiro/scripts/eval-regression.mjs --force`, or the two commands above.

## Intended hook wiring

The hook files in `.kiro/hooks/` are created separately (not by these scripts):

- Lint: after the agent writes or saves `apps/web/src/**/*.{ts,tsx}`, `packages/shared/src/**/*.ts`, `services/api/src/**/*.ts`, or `infrastructure/{bin,lib,test}/**/*.ts`, run `node .kiro/scripts/lint-changed-file.mjs`.
- Evaluator: when an agent task completes, run `node .kiro/scripts/eval-regression.mjs`.

## Linting these scripts

`.kiro/**` is ignored by `eslint.config.js` and `.prettierignore`, so `pnpm lint` doesn't check them. Check them directly:

```sh
node --check .kiro/scripts/lint-changed-file.mjs
pnpm exec eslint --no-ignore .kiro/scripts/*.mjs
pnpm exec prettier --check --ignore-path .gitignore .kiro/scripts/*.mjs
```
