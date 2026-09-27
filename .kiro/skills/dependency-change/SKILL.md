---
name: dependency-change
description: Use before adding, removing, upgrading, or moving any npm dependency, or before anything that rewrites pnpm-lock.yaml, in this pnpm workspace (apps/web, packages/shared, services/api, infrastructure). Identifies the owning package, makes one pinned change with pnpm, and reviews the manifest and lockfile diff.
---

# Dependency change

1. Check state: `git status --short`. If `pnpm-lock.yaml` or any `package.json` already has uncommitted changes, say so; your diff review must separate them from yours.
2. Find ownership:
   - Which package imports it? Add it there only, not at the root. Root devDependencies are for repo-wide tooling (ESLint, Prettier, TypeScript).
   - Is it already present elsewhere? Match that exact version (the repo keeps versions aligned, e.g. `typescript 6.0.3`, `vitest 4.1.11`, `zod 4.6.5`).
   - Runtime vs dev: Lambda code gets AWS SDK v3 from the runtime (`externalModules: ['@aws-sdk/*']`); `packages/shared` must stay pure TS with `zod` as its only runtime dep.
   - Is it well known and maintained? Flag names that look like typosquats.
3. Announce before running: package (e.g. `@proof-and-poise/api`), exact version, dep vs devDep, and the expected diff (one line in that `package.json`, new entries in `pnpm-lock.yaml`, no other versions changing).
4. Run one command, for example:
   - `pnpm --filter @proof-and-poise/api add <name>@<exact-version>`
   - `pnpm --filter @proof-and-poise/web add -D <name>@<exact-version>`
   - `pnpm --filter @proof-and-poise/shared remove <name>`
   - internal: `pnpm --filter @proof-and-poise/web add @proof-and-poise/shared@workspace:*`
   `.npmrc` has `save-exact=true`; the result must be an exact version with no `^` or `~`.
   Don't run `pnpm update` without a package name, `pnpm up --latest`, or delete the lockfile or `node_modules` to "fix" resolution.
5. Review: `git diff -- <package>/package.json` and `git diff --stat -- pnpm-lock.yaml`, then skim the lockfile hunk for unrelated version changes. If unrelated packages moved, stop and report before continuing.
6. Verify: `pnpm install --frozen-lockfile` (proves the lockfile is consistent, as in CI), then the affected package's `typecheck` and `test`.
7. Report the exact manifest line(s) changed, lockfile impact, and check results.
