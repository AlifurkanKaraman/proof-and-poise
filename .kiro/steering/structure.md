---
inclusion: always
---

# Repository structure

Target layout is design.md §3. What exists today:

```
apps/web/src/
  app/                 routes.tsx (lazy route objects + per-route error boundary), RootLayout, providers
  design/              tokens.ts (only place for hex colors), tailwind-preset.ts, motion.ts, useReducedMotion
  components/ui/       Radix/cva primitives (Button, Dialog, Field, StatusBadge, ...) + index.ts barrel
  components/states/   EmptyState, ErrorState, LoadingStage, Skeleton, SuccessState
  features/<area>/     one folder per screen: landing, setup, analysis, interview, report, demo, dev
  lib/cn.ts            class merging + focusRing
  test/setup.ts        jest-dom setup
packages/shared/src/
  schemas/ contracts/ scoring/ grounding/ interview/ keywords/   each with index.ts barrel
  limits.ts            single source of truth for input, output, and quota limits
  test/arbitraries.ts  fast-check arbitraries
services/api/src/
  handlers/api.ts      Lambda entry (env validated at cold start)
  app.ts               createRouter(): registers contracts → route handlers
  routes/              one thin file per route (e.g. routes/health.ts)
  lib/                 env.ts, logger.ts, errors.ts, router.ts
infrastructure/
  bin/app.ts           creates `ProofAndPoise-<stage>`
  lib/config.ts        stage + CORS + model ID from CDK context
  lib/proof-and-poise-stack.ts
  test/stack.test.ts   CDK assertions
apps/mobile/README.md  future plan only; not a workspace package
```

## Where new code goes

- New API route: add the contract in `packages/shared/src/contracts/routes.ts` (with Zod schemas in `schemas/`), a handler in `services/api/src/routes/<name>.ts`, register it in `services/api/src/app.ts`, and add the HTTP API route and IAM grants in the stack.
- Planned API folders (create when first needed, per design.md §3): `services/`, `ai/`, `data/`, `pdf/`, `handlers/analysisWorker.ts`.
- New screen: `apps/web/src/features/<area>/<Name>Page.tsx` (default export), wired through `page()` + `withBoundary()` in `app/routes.tsx`.
- Reusable UI: `components/ui/` or `components/states/`, exported from that folder's `index.ts`.
- Limits and quotas: `packages/shared/src/limits.ts` only.

## Naming

- Components and pages: PascalCase files (`ScoreRing.tsx`, `LandingPage.tsx`). Hooks: `useX.ts`. Other modules: camelCase (`novelTerms.ts`, `recompute.ts`).
- Tests are colocated: `<name>.test.ts(x)` next to the code.
- AWS resource names: `proof-and-poise-<stage>[-suffix]`; stack id `ProofAndPoise-<stage>`; stages are `dev` and `prod`.

## Dependency boundaries

- `packages/shared` is pure TypeScript: no DOM, Node, AWS SDK, or React imports (it must stay React Native compatible). Its only runtime dependency is `zod`.
- `services/api` depends on `@proof-and-poise/shared` (`workspace:*`). `apps/web` doesn't declare it yet; add it the same way (see the `dependency-change` skill) when the web app first needs contracts. Web and API never import each other.
- `infrastructure` references `services/api` only by file path (NodejsFunction `entry`), not by import.
- The web bundle never talks to AWS directly and gets only `VITE_API_BASE_URL` and `VITE_APP_ENV`.
