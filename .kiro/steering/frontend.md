---
inclusion: fileMatch
fileMatchPattern: "apps/web/**"
---

# Frontend (apps/web)

- Colors, type, spacing, radius, shadow, and motion come from `src/design/tokens.ts` via the Tailwind preset. Hex literals anywhere else fail lint (`no-restricted-syntax` in `eslint.config.js`).
- Build UI from `components/ui` primitives (Radix under the hood, variants with `cva`, classes merged with `cn`). Example: `Button` supports `variant`, `size`, `loading` (sets `aria-busy`), and `asChild`, defaults `type="button"`, and keeps `min-h-11`.
- Pages are default exports in `features/<area>/`, lazy-loaded through `page()` and wrapped with `withBoundary()` in `app/routes.tsx`. Dev-only routes go in `devRoutes` behind `import.meta.env.DEV`.
- Icons only from `lucide-react`. Fonts only from `@fontsource-variable/*` (no third-party font requests).
- Every visible button does something real or is disabled and labeled "Coming soon".
- Only `VITE_API_BASE_URL` and `VITE_APP_ENV` may be read from the environment. No AWS SDK or credentials in the web bundle.
- Tests use Testing Library + jsdom (`vite.config.ts` `test` block, `src/test/setup.ts`). Query by role/text, and assert accessibility attributes where they matter (see `StatusBadge.test.tsx`).
- Data: call the API only through `src/lib/api/` (typed client + TanStack Query hooks); session token only via `src/lib/session.ts`. The MSW mock API lives in `src/mocks/` (`pnpm dev:mock`); keep a handler for every contract route.
- E2E: Playwright + axe are installed. Specs in `e2e/`, run against MSW by `playwright.config.ts` (`pnpm e2e`) and against a deployed site by `playwright.smoke.config.ts`. The CI `e2e` job runs them.
- Verify layouts at 375, 768, and 1280 px when changing layout; say so if you couldn't.
