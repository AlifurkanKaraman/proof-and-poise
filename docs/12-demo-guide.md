# 12. Demo guide

The public demo uses a fictional candidate, "Amara Okonkwo (fictional)", applying for "Cloud Software Engineer I" at "Northwind Cloud (fictional company)" (design §15, `packages/shared/src/fixtures/demo/`). No real resume is needed.

## Where to run it

- Hosted: https://main.d1tn5k7jq2sjsu.amplifyapp.com
- Local, no AWS: `pnpm install --frozen-lockfile`, then `pnpm --filter @proof-and-poise/web dev:mock` and open `http://localhost:5173`. MSW answers every request from the fixture, and every analysis returns the demo map regardless of input.
- Local against a deployed API: see [11-deploy-and-teardown.md](11-deploy-and-teardown.md#run-the-web-app).

## Walkthrough (about 5 minutes)

1. **Landing (`/`).** Hover or tab through the evidence-thread preview: each job requirement links to the resume line that proves it. Read the trust, privacy, and ethics sections. Click **Try the demo**.
2. **Analysis (`/s/<id>/analysis`).** The demo session starts with the precomputed map.
   - **Overview:** four score rings (Job Match, Evidence Coverage, Keyword Coverage, Parseability), each with "How is this calculated?".
   - **Competencies:** the designed spread: strong (Python and TypeScript, REST APIs, AWS Lambda), moderate (CI/CD, testing), weak (infrastructure as code listed only in Skills, on-call and monitoring), and missing (Kubernetes). Point out "Weak: listed in Skills only, not shown in experience or projects."
   - **Recommendations:** one rewording-only, one verified-from-resume, and one missing-evidence card, each with its trust label.
   - **Keywords:** matched vs. required job keywords.
   - **Tailor resume (the main flow):** on Overview, click **Tailor my resume** (step 1). Add REST APIs, Unit tests, and Integration tests to Skills: the resume already shows them, but its Skills section doesn't list them. Kubernetes appears under "keywords your resume doesn't show" and is never added for you; **I have this experience** opens the confirmation dialog. On **Recommendations**, accept the rewording and the verified change, then confirm an experience: the before → after scores on the Tailor tab update. Open **Resume** to see changed lines marked and click **Copy as text** or **Download .txt**.
3. **Interview (`/s/<id>/interview`).** Click **Start Interview**. Five questions in the order behavioral, role-specific, evidence gap, behavioral, role-specific. The third targets the weakest required competency. Type answers. Demo sessions never call the model: they use the labeled sample plan and feedback from `packages/shared/src/fixtures/demo/interview.ts`, where the question 1 sample is deliberately vague and triggers a follow-up ("1a"). After each answer, show the feedback: strength, improvement, dimension chips.
4. **Report (`/s/<id>/report`).** Readiness ring with both terms of the formula, competency status list, per-question feedback with nested follow-ups, STAR outlines, and three prioritized actions. Show **Practice again** on a weaker question, the print view, and **Delete my data**.

## Talking points

- The model writes language only. Scores, caps, follow-up decisions, and quotas are deterministic code with property tests ([02-originality.md](02-originality.md)).
- Rewording never raises Job Match; only evidence does. Listing proven keywords in Skills doesn't raise Keyword Coverage either, because it already counts them anywhere in the resume; the scores are this product's estimate, not an employer's ATS score.
- The demo uses labeled sample feedback and makes no Bedrock calls, so it keeps working when the daily capacity cap is reached (Req 13.4).
- A standard session (Prepare for a job) runs the real pipeline: PDF or pasted text, Bedrock analysis, grounding, and live answer evaluation.

## Pending for the final demo

- Answers are typed. The Record tab shows "Coming soon": recorded answers are out of scope for the MVP (see `09-limitations.md`).
- `TODO(user): add the demo video link, if one is submitted.`
