# 09. Known limitations

Written against `develop` at the merge of PR #16 (2026-10-01). Integration branches were in progress at the time. `TODO(user): re-check each item below after tasks 10, 14, 16, 20, 23, and 24 merge, and delete the ones that no longer apply.`

## Not finished on `develop`

- **Recommendation decisions and confirmations in the UI.** The API routes exist and are unit-tested (task 13), and the web client has the hooks, but the Recommendations tab doesn't call them yet (task 14).
- **Recorded answers.** The Record tab captures audio and shows an editable placeholder transcript. It isn't wired to the upload and Transcribe routes yet (task 16). Typed answers work.
- **Report and practice integration.** The report screen creates and reads the report, and "Practice again" starts a practice turn, through the API client. End-to-end verification against the deployed API is task 20.
- **Hosting.** Amplify Hosting isn't connected yet (task 10), so CORS allows only `http://localhost:5173`.
- **Production.** The `prod` stack, CloudWatch alarms, SNS email, and AWS Budgets aren't created yet (task 23). Production verification (task 24) is pending.

## Verified vs. unit-tested only

- `ProofAndPoise-dev` was deployed and checked on real AWS for health, sessions, auth, and resume upload (task 8, per `HANDOFF.md`).
- Live Bedrock calls ran for the analysis prompt evaluation.
- The interview, report, decisions, and transcription routes are covered by unit tests with mocked AWS SDK clients. The real Transcribe → S3 write (task 18) hasn't been checked with a real recording.
- `TODO(user): list which of these routes were verified on the deployed dev stack, and when.`

## Model quality

- Analysis quality varies between runs. The evaluation uses a handful of fictional cases with code-enforced pass criteria; it measures pipeline behavior on those cases, not real-world accuracy. Failures seen include recommendation kept-rates below 50% (the server drops padded rewordings) and an occasional `MODEL_OUTPUT_INVALID`. See [analysis-prompt-evaluation.md](analysis-prompt-evaluation.md). `TODO(user): the copy of that file on develop still says the live run is pending; confirm the branch with the live results (feature/analysis-eval-results or feature/analysis-quality) is merged before submission.`
- The grounding checks guarantee quotes come from the resume and recommendations add no new numbers or dictionary terms. They don't guarantee a quote is the best evidence for a competency.
- Answer evaluation is model-generated language mapped to a deterministic score. It's practice feedback, not a hiring prediction.

## Product scope

- English only. Transcribe uses `en-US`; `en-GB` and `en-IN` are documented alternatives (`LIMITS.transcribe`).
- PDF text extraction only, up to 4 pages. Scanned PDFs fail and the UI offers pasting text (OCR is post-hackathon P8).
- No accounts or saved history; data lives 24 hours.
- Interview questions are text only (no voice playback).
- Quota and budget caps are code constants; changing one needs a redeploy.
- Accessibility: automated axe, keyboard, touch-target, and reduced-motion checks run in Playwright. The manual audit in `apps/web/ACCESSIBILITY.md`, iOS Safari, and the microphone-denied path are still open (task 22). Automated checks don't prove WCAG compliance.
- The shared demo fixtures are bundled into the main web chunk (about 418 kB), which slows the first load.
