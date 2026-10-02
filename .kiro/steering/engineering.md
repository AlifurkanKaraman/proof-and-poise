---
inclusion: always
---

# Engineering conventions

Detailed area guidance loads automatically: `frontend.md` (apps/web), `backend.md` (services/api), `cdk.md` (infrastructure), `evaluation.md` (scoring, grounding, keywords, tailoring, evaluator files). `testing.md` (choosing checks) and `safe-changes.md` (before consequential actions) load when relevant.

## Code

- Follow the spec. Cite the requirement or design section in a short comment when code enforces a rule (existing style: `// Req 14.6`, `(design §8)`).
- Use `import type` for type-only imports (ESLint `consistent-type-imports`). Prefix intentionally unused vars/args with `_`.
- No `console.*`; the API uses `services/api/src/lib/logger.ts` (the only sanctioned console call).
- Validate every external input with the shared Zod schemas, on client and server. Don't redefine a schema locally.
- Put numbers that are limits, caps, or quotas in `packages/shared/src/limits.ts`.
- Keep changes small and match the surrounding file's style. Don't add abstractions or options the task doesn't need.

## Testing

- Vitest, colocated `*.test.ts(x)`. Add or update tests with every behavior change.
- Deterministic logic in `packages/shared` (scoring, grounding, follow-up rule, schemas) gets property tests with `fast-check`; reuse `src/test/arbitraries.ts`.
- Verify in CI order: `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`. For a narrow change, run the affected package first (`pnpm --filter <pkg> test`) and state what you skipped.

## Errors

- API errors use `ApiError` / `toApiError` (`services/api/src/lib/errors.ts`): body `{ error: { code, message, fields? } }`, codes and statuses from `ERROR_STATUS` in shared contracts. Unknown errors become `INTERNAL` with no detail.
- UI errors: every screen has loading, skeleton, empty, success, and recoverable error states, and every error state offers a recovery action (`components/states/ErrorState`).

## Accessibility (Req 14)

- Keyboard reachable, visible focus (`focusRing` in `lib/cn.ts`), touch targets ≥ 44px (`min-h-11`).
- Status never by color alone: icon + text (see `StatusBadge`). Decorative `lucide-react` icons get `aria-hidden`.
- Respect `prefers-reduced-motion` via `design/useReducedMotion.ts` and `design/motion.ts`.
- Automated checks don't prove WCAG compliance; say what was and wasn't checked manually.

## Review and Git

- Branches: `feature/*` → PR into `develop`; release PR `develop` → `main`. Conventional Commit titles. No force-pushes or history rewrites.
- Use `.github/pull_request_template.md`; its security checklist is the review bar (no secrets, allowlisted logging, least-privilege IAM, cost rules, pinned deps, fictional fixtures).
- Commit and push finished, verified work to its `feature/*` branch per `git-workflow.md`; anything else (develop/main, PRs, merges) only when asked.
