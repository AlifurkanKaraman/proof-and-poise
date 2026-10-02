# Tailor tab confirmation fix: implementation plan

Bug (user, prod): "When I add skills and add description it gives me an error and then it updates the score."

## Root cause and evidence

What the logs show (read-only CloudWatch query, `proof-and-poise-prod-api` and `-dev-api`, last 24 h, route/status/latency only):

- The user's prod session (21:57–21:58 UTC, a demo session: `POST /sessions` then `GET …/analysis` 200 right away, no `POST …/analysis`) made exactly one `POST /sessions/{sessionId}/confirmations`, which returned 200 in 261 ms. No other request followed it.
- Neither stage logged a 4xx or 5xx on any confirmation or decision route in that window (the only rejection was an unrelated `GET …/report` 404).
- So the server saved the confirmation once, and the score change came from that 200 response (`useConfirmation.onSuccess` → `mergeConfirmation`). There was no failed request, no race between two requests, and no retry or double submit.

Hypotheses ruled out:

- H1 (response schema mismatch): ruled out. PR #34 changed no shared schema (`git show --stat f5bc48d`), and `onSuccess` only runs on a response that already passed `ConfirmationResponseSchema` in `client.ts`. If parsing had failed, the score couldn't have updated without a refetch, and none happened.
- H2 (model or grounding failure after a partial write): ruled out. Demo sessions never call the model (`decisionService.confirm`), no `confirm_rewrite_skipped` warning was logged, and the route returned 200.
- H3 (added skills leak into the request): ruled out. Skill additions are React state in `AnalysisWorkspace`. The confirmation body is only `{ competencyId, statement, attested }`.
- H4 (toast shows an error on success): ruled out. `scoreToast` always returns `tone: 'success'`, and `ToastProvider.show` can't throw.
- H5 (mock diverges from the API): confirmed. It's why tests never caught defects B and C below.

Defects reproduced locally. I used a scratch jsdom test with an MSW handler that copies `DecisionService.confirm` exactly (`applyConfirmation` with `rewrite: null`, the eligibility check, `VALIDATION {competencyId:'not_eligible'}`), plus a scratch Playwright run on `pnpm dev:mock`. Both scratch files are deleted.

A. After a successful confirmation, the Tailor tab says the keyword is still a gap. Steps: Tailor resume → Add REST APIs to Skills → Kubernetes → I have this experience → type a statement → Save.

- The toast says "Job match: 63 → 71 · You confirmed Kubernetes and containers experience."
- The Kubernetes row still sits under "Job keywords your resume doesn't show" with a ✕ icon and the text "Gap: prepare to discuss it".
- Confirming via On-call (competency c7) turns both the On-call and Monitoring rows into "Gap: prepare to discuss it".

This is the "error, then the score updates" the user saw: the panel contradicts the success the score shows.

Cause, in `packages/shared/src/tailoring/tailor.ts`: `competencyFor()` skips confirmed competencies and returns `null`. `TailorPanel` renders `null` as "Gap: prepare to discuss it". When another unconfirmed competency also mentions the term, the row is remapped to that competency instead. The row keeps its `key={g.term}`, so the same `ConfirmExperienceDialog` instance is reused for a different competency. That also invites reusing one statement for another competency.

B. Tailor offers "I have this experience" for competencies the API rejects. In the demo map, `CI/CD → c4 "CI/CD pipelines"` has strength `moderate`. `competencyFor()` never checks strength, which breaks design §7.6 ("a competency the candidate can confirm (Req 8)") and Req 8.1 (weak or none only).

- The real API returns 400 `VALIDATION` with `fields: { competencyId: 'not_eligible' }`.
- The dialog then shows "We couldn't save that · Some of the information is not valid. Check the highlighted fields and try again." No field is highlighted, and the Retry button can never succeed.
- Reproduced with the server-faithful handler.
- The same gap exists in `ConfirmAction` in `AnalysisWorkspace.tsx`. It's reached from Tailor and from missing-evidence recommendation cards without a strength check.

C. The mock hides both defects. `apps/web/src/mocks/db.ts` `confirm()`:

- never checks eligibility, so CI/CD returns 200 in the mock;
- has no stage lock (the server returns 409 once the interview starts);
- gives demo sessions a `confirmed_by_candidate` recommendation with Accept (`rec.proposedText = req.statement`). Prod demo sessions get no rewrite (`meta.mode === 'demo' ? null : …`), so the card stays `missing_evidence`;
- can't send `fields`, because `MockApiError` has none and `handlers.ts` calls `errorResponse(e.code, e.message)`.

Not reproduced: the exact error text the user saw. The logs show one successful confirmation and no 400, which points to A. B is a real defect on the same screen and is fixed together. The API (`services/api`) is correct and well tested (`decisions.test.ts` already covers `not_eligible`, the quota, the per-competency limit and the stage lock), so it needs no change. No dependency, stack or deploy change.

## Decisions

- Eligibility gets one shared helper, `canConfirm(c)` in `packages/shared/src/scoring/decisions.ts` (weak or none and not yet confirmed, Req 8.1). Tailor and the web `ConfirmAction` use it. `applyConfirmation` keeps its inline checks so the API's error order (CONFLICT → QUOTA_EXCEEDED → VALIDATION) doesn't move.
- A `notShown` keyword that a confirmed competency mentions is marked `confirmed: true` and is never remapped to another competency. The row shows the existing `StatusBadge status="confirmed"` ("Confirmed by you", icon + text) and drops the ✕. It stays in the "doesn't show" list: the resume text still doesn't contain the term, and Req 7.9 forbids adding it to Skills. If the statement contains the term, `tailoringPlan` already moves it to `addToSkills` with `source: 'confirmation'`.
- The dialog treats `VALIDATION` with `fields.competencyId` and `CONFLICT` as not retryable. It shows a specific message and a Close action instead of a Retry that can't succeed (engineering.md: every error state offers a real recovery).
- The mock `confirm()` calls the shared `applyConfirmation`, the same function the API uses, with the API's pre-checks and order. It passes `rewrite: null` for demo sessions, like the API. For standard sessions it passes a stand-in rewrite that the real grounding check accepts or drops.

## Implementation plan

Branch: `feature/tailor-confirm-fix` from `develop` (HEAD `5f311b7`).

- [ ] 1. Shared: eligibility helper, and stop Tailor offering ineligible or already-confirmed competencies.
      - `packages/shared/src/scoring/decisions.ts`: export `canConfirm(c: Pick<Competency, 'strength' | 'confirmationState'>): boolean`, which returns `c.confirmationState !== 'confirmed' && (c.strength === 'weak' || c.strength === 'none')`, with a `// Req 8.1` comment. Don't change `applyConfirmation`.
      - `packages/shared/src/tailoring/tailor.ts`:
        - Add `confirmed: boolean` to `GapKeyword`, documented as "a competency that mentions the term is already confirmed by the candidate".
        - Replace `competencyFor` with a function that collects the competencies mentioning the term (same `containsTerm` over name, description and missingEvidence). It returns `{ confirmed: mentions.some(c => c.confirmationState === 'confirmed'), competencyId: confirmed ? null : (mentions.find(canConfirm)?.id ?? null) }`. Import `canConfirm` from `'../scoring/decisions'`.
        - Fill both fields in `notShown.push`.
        - Update the header comment and cite design §7.6 and Req 8.1.
      - `packages/shared/src/tailoring/tailor.test.ts`, new tests. The first two fail before the fix:
        - Demo map: `notShown` CI/CD has `competencyId: null` and `confirmed: false` (c4 is moderate). Kubernetes stays `c8`.
        - Run the shared `applyConfirmation({ map: DEMO_EVIDENCE_MAP, resumeText: DEMO_RESUME_TEXT, competencyId: 'c8', statement: 'I containerized three services with Docker and ran them on a k3s cluster.', rewrite: null, at })`. Then `tailoringPlan(result.map, …)` gives Kubernetes `{ confirmed: true, competencyId: null }`. Do the same with `c7` and check that both On-call and Monitoring have `confirmed: true`.
        - fast-check property: map `DEMO_EVIDENCE_MAP.competencies` with `fc.array(strengthArb)` (from `src/test/arbitraries.ts`) plus `fc.boolean()` for confirmationState. For every `notShown` entry, `competencyId === null || canConfirm(that competency)`, and `confirmed` implies `competencyId === null`.
        - Add a `canConfirm` unit test in `packages/shared/src/scoring/decisions.test.ts`: weak and none are true, moderate and strong are false, confirmed is false.
      Files: `packages/shared/src/scoring/decisions.ts`, `packages/shared/src/scoring/decisions.test.ts`, `packages/shared/src/tailoring/tailor.ts`, `packages/shared/src/tailoring/tailor.test.ts`
      Verify: `pnpm --filter @proof-and-poise/shared test` passes, and `pnpm --filter @proof-and-poise/shared typecheck` is clean.

- [ ] 2. Mock parity for `createConfirmation`, so the mock behaves like the API (depends on 1 only for the shared export barrel. `applyConfirmation` is already exported).
      - `apps/web/src/mocks/db.ts`:
        - `MockApiError` gets an optional third constructor parameter, `readonly fields?: Record<string, string>`. Keep it compatible with `exactOptionalPropertyTypes` by declaring `readonly fields: Record<string, string> | undefined`.
        - Rewrite `confirm(s, req)` to mirror `DecisionService.confirm` / `loadEditable` in order:
          1. `requireReady(s)`.
          2. `if (s.stage === 'interview' || s.stage === 'report') throw CONFLICT`.
          3. Competency not found → `NOT_FOUND`.
          4. Already confirmed → `CONFLICT`.
          5. `confirmedCount(s.map) >= LIMITS.confirmation.maxPerSession` → `QUOTA_EXCEEDED`.
          6. `!canConfirm` → `new MockApiError('VALIDATION', …, { competencyId: 'not_eligible' })`.
          7. Call the shared `applyConfirmation({ map: s.map, resumeText: s.resumeText, competencyId, statement, rewrite, at: iso() })`. Use `rewrite = s.mode === 'demo' ? null : standIn`, where `standIn` is `{ originalText, proposedText: req.statement, reason: 'Uses the experience you confirmed.' }` built from the competency's existing `missing_evidence` recommendation, or `null` when it has none. Comment it: `// Demo sessions get no rewrite, like the API (Req 13.2)`.
          8. On `ok: false`, map the errors exactly like the service.
          9. Set `s.map = result.map`. Sync `s.counters.events` and `s.counters.evidence` to at least the highest numeric suffix now in `s.map.scoreEvents` and in the evidence ids, so later `decide()` ids can't collide with the ones `applyConfirmation` made (`appendEvent` in `cache.ts` dedupes by id).
          10. `persist()`, then return `{ competency, ...(recommendation ? { recommendation } : {}), scores: s.map.scores, scoreEvent }`.
        - Remove the now-unused imports (`capStrength`, `maxStrength` and so on) only if nothing else in the file uses them.
      - `apps/web/src/mocks/handlers.ts`: in the resolver catch, `errorResponse(e.code, e.message, e.fields)`.
      - `apps/web/src/mocks/handlers.test.ts`:
        - The demo journey test now expects `confirmation.recommendation` to be `undefined` (prod demo behaviour). Keep the strength, confirmationState and score assertions.
        - New test: on a fresh demo session, `createConfirmation` for `c4` rejects with `ApiError` `code: 'VALIDATION'`, `fields.competencyId: 'not_eligible'`. After `startInterview`, `c8` rejects with `CONFLICT`. This fails before the fix, because the mock returns 200 for both.
      - `apps/web/src/features/analysis/AnalysisDecisions.test.tsx`, test "validates with ARIA-linked errors, then saves and updates the card": replace the final `Accept … toBeEnabled()` with prod demo behaviour. The Kubernetes card shows "Confirmed by you" and has no Accept button (Req 7.4: the rec stays `missing_evidence` in demo).
      Files: `apps/web/src/mocks/db.ts`, `apps/web/src/mocks/handlers.ts`, `apps/web/src/mocks/handlers.test.ts`, `apps/web/src/features/analysis/AnalysisDecisions.test.tsx`
      Verify: `pnpm --filter @proof-and-poise/web exec vitest run src/mocks src/features/analysis` passes.

- [ ] 3. Web: Tailor rows show the confirmed state, and confirm actions only appear for eligible competencies (depends on 1).
      - `apps/web/src/features/analysis/TailorPanel.tsx`, in the `notShown` row:
        - When `g.confirmed`, render `<StatusBadge status="confirmed" />` in place of the action and omit the ✕ icon. Keep the sr-only "Not shown in your resume.".
        - Else, when `g.competencyId !== null`, call `renderConfirm`.
        - Else show the existing "Gap: prepare to discuss it".
        - Import `StatusBadge` from `../../components/ui/StatusBadge`.
      - `apps/web/src/features/analysis/AnalysisWorkspace.tsx`:
        - In `renderConfirm`, render `<ConfirmAction key={competency.id} competency={competency} />`, so a dialog is never reused across competencies.
        - In `ConfirmAction`, after the confirmed branch, `if (!canConfirm(competency)) return null;` (import `canConfirm` from `@proof-and-poise/shared`, `// Req 8.1`).
        - `CompetencyCard` can keep its existing weak/none gate.
      - `apps/web/src/features/analysis/ConfirmExperienceDialog.tsx`:
        - Compute `notEligible = isApiError(submitError) && submitError.code === 'VALIDATION' && submitError.fields?.['competencyId'] !== undefined` and `conflict = isApiError(submitError) && submitError.code === 'CONFLICT'`.
        - For these, the ErrorState title is "We couldn't save that". The message is "Your resume already shows evidence for this, so there's nothing to confirm." for not eligible. For conflict it's "This was already confirmed, or the interview has started. Refresh to see the latest state."
        - The action is the same `DialogClose` Close button the quota branch uses, with no Retry.
        - Disable "Save confirmation" for these, as with `quotaReached`.
        - Leave the other branches unchanged.
      - Regression tests in `apps/web/src/features/analysis/AnalysisDecisions.test.tsx`, a new `describe('Tailor tab confirmation (design §7.6, Req 8.1)')` that reuses the MSW setup. Open a demo session, then click the `Tailor resume` tab:
        1. "confirms once, without an error, and shows the keyword as confirmed": count `POST …/confirmations` via `server.events.on('request:start', …)` filtered on method and path. Steps:
           - Click "Add REST APIs to Skills".
           - In the "Job keywords your resume doesn't show" section, in the Kubernetes row, click "I have this experience".
           - Type `'I containerized three services with Docker and ran them on a k3s cluster.'`, tick the checkbox and click Save confirmation.
           - Expect the dialog to close, with no `role="alert"` in the document.
           - Expect exactly one toast text "You confirmed Kubernetes and containers experience." and exactly one confirmation request.
           - The Kubernetes row shows "Confirmed by you" and contains neither "Gap: prepare to discuss it" nor an "I have this experience" button.
           - The Job match `dd` shows "now" greater than "at analysis".
           - "Remove REST APIs from Skills" is still pressed, so the added skill survived.
           This fails before the fix, because the row reads "Gap: prepare to discuss it".
        2. "doesn't offer a confirmation the API would reject": the CI/CD row has no "I have this experience" button and shows "Gap: prepare to discuss it". Fails before the fix.
        3. "a not-eligible rejection offers Close, not Retry": `server.use(http.post(mswPath(contractRoutes.createConfirmation.path), () => errorResponse('VALIDATION', 'x', { competencyId: 'not_eligible' }), { once: true }))`. Open Kubernetes from the Competencies tab and submit a valid statement. The alert shows the not-eligible message and a Close button, and has no Retry button. Clicking Close closes the dialog. Fails before the fix, because Retry is shown.
      - `apps/web/src/features/analysis/TailorPanel.test.tsx`: no change is needed beyond keeping it green. The existing "lists missing keywords as gaps…" test still finds Kubernetes and at least one confirm button.
      Files: `apps/web/src/features/analysis/TailorPanel.tsx`, `apps/web/src/features/analysis/AnalysisWorkspace.tsx`, `apps/web/src/features/analysis/ConfirmExperienceDialog.tsx`, `apps/web/src/features/analysis/AnalysisDecisions.test.tsx`
      Verify: `pnpm --filter @proof-and-poise/web test` passes. Run the three new tests against the pre-fix code first (stash only the step 3 source edits, never the user's work), or note that they were written to the reproduced failure.

- [ ] 4. Playwright regression in the running mock app (depends on 2 and 3).
      - `apps/web/e2e/demo-journey.spec.ts`: add `test('tailor: add a skill, confirm a missing keyword, no error and one score update')`:
        1. `page.goto('/')`, then main → "Try the demo".
        2. Wait for the heading /your analysis/i.
        3. Click tab "Tailor resume", then button "Add REST APIs to Skills".
        4. `const row = page.getByRole('listitem').filter({ hasText: 'Kubernetes' }).filter({ hasText: 'Not shown' })`, then `row.getByRole('button', { name: /i have this experience/i }).click()`.
        5. In the dialog, fill the textbox with the step-3 statement, check the checkbox and click "Save confirmation".
        6. Expect the dialog to be hidden and `page.getByRole('alert')` to have count 0.
        7. Expect `page.getByText('You confirmed Kubernetes and containers experience.')` to have count 1.
        8. Expect `row.getByText('Confirmed by you')` to be visible and `row.getByText('Gap: prepare to discuss it')` to have count 0.
        9. Count `page.on('request')` hits for `POST …/confirmations` (MSW in the browser still issues the fetch): exactly 1.
        10. Run `expectNoAxeViolations(page)` on the Tailor tab.
      Files: `apps/web/e2e/demo-journey.spec.ts`
      Verify: `pnpm --filter @proof-and-poise/web exec playwright test e2e/demo-journey.spec.ts --project=chromium-desktop --project=webkit-mobile --reporter=list` passes. Playwright starts `pnpm dev:mock` on 5173, so the port must be free. Delete any `apps/web/test-results/` this run creates, but only if it didn't exist before.

- [ ] 5. Spec note and full verification (depends on 1–4).
      - `.kiro/specs/proof-and-poise/design.md` §7.6, first bullet: append "only a competency that can still be confirmed (weak or none, not yet confirmed; Req 8.1). Once a competency that mentions it is confirmed, the keyword shows as confirmed and isn't offered again."
      - Format only the changed files: `pnpm exec prettier --write <changed files>`.
      - Run in CI order, one at a time: `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`. All must pass. `pnpm build` runs `cdk synth` locally and changes no cloud resources.
      - Commit on `feature/tailor-confirm-fix`: `fix(web): tailor confirmations match the API (design 7.6, Req 8.1)`, staging by path only. Push to the feature branch (standing authorization). Don't open a PR or merge; give the `gh pr create --base develop …` command instead.
      Files: `.kiro/specs/proof-and-poise/design.md`
      Verify: all four root commands exit 0, and `git diff --cached --stat` lists only the files above.

## Out of scope and notes

- No change to `services/api`, `infrastructure`, dependencies or the lockfile. The prod fix reaches users only after the develop → main release PR and the Amplify build, both of which need the user's go-ahead.
- Don't call Bedrock or the deployed APIs during verification. Everything runs against MSW.
- If the user can share the exact error text or a screenshot, compare it with the A and B messages above. The plan fixes both either way.

## Verification (2026-10-02, branch `feature/tailor-confirm-error-fix`)

The fix is commit `018079a`. The e2e toast assertion fix and this note are in a follow-up commit. Branch name: `feature/tailor-confirm-error-fix`, not `feature/tailor-confirm-fix`.

- Red/green, run against the pre-fix code: a temporary worktree at `develop` (`5f311b7`) with only the 4 test files copied in. `pnpm install --frozen-lockfile` left the lockfile unchanged.
  - Web: `vitest run src/features/analysis/AnalysisDecisions.test.tsx src/mocks/handlers.test.ts` → 7 failed, 13 passed. All 7 are assertion failures:
    - Kubernetes row has no "Confirmed by you".
    - CI/CD offers "I have this experience".
    - Not-eligible shows Retry, not the specific message.
    - Demo card still has Accept.
    - Mock returns 200 for `c4` and after the interview starts.
    - Demo confirmation returns a recommendation.
    - Route coverage, a knock-on effect of the journey test failing early.
  - Shared: `vitest run src/tailoring/tailor.test.ts src/scoring/decisions.test.ts` → 5 failed, 21 passed. Three are `canConfirm is not a function`, which comes from the missing fix. Two are assertions: CI/CD maps to `c4`, and Kubernetes isn't marked `confirmed` after confirming `c8`.
  - The worktree was removed with `git worktree remove --force` + `git worktree prune`.
- With the fix, from the repo root and in CI order: `pnpm typecheck` ✓ and `pnpm lint` ✓ (ESLint + Prettier).
  - `pnpm test` ✓: shared 157, api 180 (5 skipped), web 153, infra 34.
  - `pnpm build` ✓: Vite plus a local `cdk synth`.
  - `pnpm --filter @proof-and-poise/web e2e` ✓: 90 passed, 50 skipped. The new tailor test passes on all 4 projects.
- After the toast assertion fix (`exact: true`; the Radix toast's aria-live announcer repeats the text): `playwright test e2e/demo-journey.spec.ts` ✓, 28 passed.
  - It ran on port 5174 through a scratch config with `reuseExistingServer: false`, because a separate mock server was already using 5173. The scratch config is deleted. Only the e2e spec changed, so the rest wasn't re-run.
- Manual check, done with a scratch Playwright script against `vite --mode mock --port 5174` started from the fix worktree, then stopped:
  - Steps: Tailor resume → Add REST APIs to Skills → Kubernetes "I have this experience" → statement + checkbox → Save.
  - Results: 1 `POST …/confirmations` (200) and 0 `role="alert"`. 1 toast. Job match `63 → 71`.
  - Kubernetes row reads "Confirmed by you" with no "Gap", and REST APIs is still added.
  - Before confirming, CI/CD showed "Gap: prepare to discuss it" with no confirm action, which confirms the fix's code was served.
  - The same script run earlier against the pre-fix code reproduced the bug: the score rose, but Kubernetes still read "Gap: prepare to discuss it".
- No Bedrock, deployed API, or AWS write calls. No dependency, lockfile, `services/api` or `infrastructure` changes. Temp files are deleted.
