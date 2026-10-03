# 09. Known limitations

Written against `develop` on 2026-10-02, after resume tailoring (PR #34), the UI redesign (PR #30), the accessibility pass (PR #36), and the Kiro setup (PR #38).

## Not finished

- **Recorded answers are out of scope for the MVP.** The full flow is built and tested (audio upload, Amazon Transcribe, editable transcript; task 16), but the hackathon AWS account isn't subscribed to Amazon Transcribe (`SubscriptionRequiredException`). The Record tab is shown as "Coming soon" and answers are typed. To enable it after the hackathon: enable Transcribe for the account, then set `FEATURES.recordedAnswers` to `true` in `apps/web/src/lib/features.ts`. The API routes and IAM permissions are already deployed.
- **Resume export is text-based.** The tailored resume downloads as DOCX or PDF built from its text in two styles, so it can't copy an uploaded PDF's design. Skills added on the Tailor tab are kept in memory, so a page reload clears them.
- **"Practice this in the interview"** on missing-evidence cards shows "Coming soon" (there's no contract route for it).
- **Report builds.** Each standard session allows 2 report builds (`LIMITS.quotas`), so a second "Practice again" answer can hit "Report limit reached".

## Verified on AWS

- Every API route is real on `dev` and `prod`; nothing in the deployed app is served by MSW.
- Verified on `prod` on 2026-10-02: health, demo session create, read, and delete, 401s without a valid token, CORS from the Amplify domain, the account owner's full typed journey with a real resume, and the Playwright smoke run on desktop Chrome and iPhone WebKit. gitleaks over the full history found no leaks.
- Prod CloudWatch log review (api and worker Lambdas, 2026-10-02): see [07-security-privacy.md](07-security-privacy.md#logging).
- The real Transcribe → S3 write (task 18) has never run, because the account isn't subscribed to Transcribe.

## Model quality

- Analysis quality varies between runs on Nova Lite; real performance evidence is sometimes missed. The evaluation uses a handful of fictional cases with code-enforced pass criteria; it measures pipeline behavior on those cases, not real-world accuracy. Live runs on 2026-09-30 and 2026-10-01 ranged from 1/4 to 5/5. Failures seen include recommendation kept-rates below 50% (the server drops padded rewordings) and an occasional `MODEL_OUTPUT_INVALID`. See [analysis-prompt-evaluation.md](analysis-prompt-evaluation.md).
- The grounding checks guarantee quotes come from the resume and recommendations add no new numbers or dictionary terms. They don't guarantee a quote is the best evidence for a competency.
- Answer evaluation is model-generated language mapped to a deterministic score. It's practice feedback, not a hiring prediction.
- Job Match, Keyword Coverage, and Evidence Coverage are this product's estimates, not an employer's ATS score.

## Product scope

- English only. Transcribe uses `en-US`; `en-GB` and `en-IN` are documented alternatives (`LIMITS.transcribe`).
- PDF text extraction only, up to 4 pages. Scanned PDFs fail and the UI offers pasting text (OCR is post-hackathon P8).
- No accounts or saved history; data lives 24 hours.
- Interview questions are text only (no voice playback).
- Quota and budget caps are code constants; changing one needs a redeploy.
- Accessibility: automated axe, keyboard, width, touch-target, and reduced-motion checks run in Playwright (78 passed, including the Tailor and Resume tabs), and the owner did a manual iOS Safari and VoiceOver pass on 2026-10-02 with no issues (`apps/web/ACCESSIBILITY.md`). Automated checks and one manual pass don't prove WCAG compliance.
- The shared demo fixtures are bundled into the main web chunk (about 418 kB), which slows the first load.
