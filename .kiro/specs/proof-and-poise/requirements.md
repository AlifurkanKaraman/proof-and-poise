# Proof & Poise — Requirements

> "Your experience is stronger when you can prove it."

## Introduction

Proof & Poise is an evidence-grounded job-readiness web application for international students, early-career candidates, and other job seekers. A candidate provides a resume and a job description. The system builds a competency map, links each competency to verbatim resume evidence, recommends truthful resume changes that the candidate approves one at a time, runs a five-question adaptive mock interview aimed at the weakest evidence, and produces an explainable readiness report.

The resume optimizer and interview simulator share one competency and evidence model, so every screen reads from the same map.

Target: AWS "Zero to Shipped" Shipathon. Submission deadline October 2, 2026. Two developers. Budget under $10 in AWS spend.

## Repository baseline (inspected 2026-09-27)

- Workspace `/Users/alifurkankaraman/Downloads/AWS-shiphaton` is empty. No files and no git repository.
- Local tooling: Node v25.3.0 (non-LTS), AWS CLI, git. pnpm and the AWS CDK CLI aren't installed.
- Consequence: everything is greenfield. Nothing existing needs to be preserved.

## Naming convention

- The product name is written **Proof & Poise** in the UI and in docs, always with the ampersand or spaced out. It is never written "ProofPoise", because that looks too similar to Proofpoint, an existing company.
- Code slugs use `proof-and-poise`: the repo name, the npm scope `@proof-and-poise/*`, and the CDK stack and resource prefixes.
- PascalCase identifiers use `ProofAndPoise` (for example, `ProofAndPoiseStack`).
- Before submission, run a trademark search (USPTO or EUIPO) and register the domain. As of 2026-09-27, `proofandpoise.com` and `proofandpoise.ai` showed as unregistered.

## Assumptions (confirm or correct)

- A1. Deployment region is `us-east-1`. It has Nova Lite, Transcribe, Polly, and Amplify Hosting.
- A2. The MVP has no user accounts. Sessions are anonymous and use a server-issued bearer token. Cognito comes after the hackathon.
- A3. The default model is Amazon Nova Lite (`amazon.nova-lite-v1:0`, invoked through the `us.` cross-region inference profile). The model ID is configurable, so Nova 2 Lite can be tried without code changes.
- A4. Developer A owns frontend and UX. Developer B owns backend, AI, and infrastructure. Both own shared contracts.
- A5. The deadline is end of day October 2, 2026. The internal code freeze is October 1 at 20:00 local time.
- A6. The team will create a GitHub repository and connect it to Amplify Hosting through the console.

## Glossary

- **Session**: an anonymous, time-limited workspace for one resume, job description, and interview. It is identified by `sessionId` and authorized by `sessionToken`.
- **Competency**: a capability the job requires. It is derived from the job description.
- **Importance**: `required` | `preferred` | `contextual`.
- **Evidence**: a verbatim quote from the resume (`resume`) or a candidate-written statement (`candidate_confirmation`) that supports a competency.
- **Evidence strength**: `strong` | `moderate` | `weak` | `none`.
- **Grounding check**: a deterministic server-side check that an evidence quote or recommendation appears in, or is supported by, the source text.
- **Trust label**: one of `verified_from_resume`, `confirmed_by_candidate`, `missing_evidence`, `rewording_only`.
- **Working resume**: the original resume text with all accepted recommendations applied.
- **Turn**: one interview question (primary or follow-up) together with its answer and evaluation.
- **Score event**: a recorded change to a metric, including the reason and the source.

---

## MVP requirements (must-have)

### Requirement 1: Landing page

**User story:** As a job seeker, I want to understand what Proof & Poise does and trust it with my data, so that I can decide to start.

1. THE landing page SHALL show a problem-focused hero, the primary CTA "Prepare for a job", a secondary CTA "Try the demo", a three-step explanation, an evidence-grounded trust statement, a privacy statement, and an ethical-AI statement.
2. THE landing page SHALL include an interactive preview that uses fictional data. WHEN a user activates a competency in the preview (by click, tap, or keyboard), THE preview SHALL highlight the linked resume evidence. The preview SHALL make no network requests.
3. THE navigation SHALL be responsive. At widths below 768px it SHALL collapse into an accessible menu that can be opened, closed, and escaped with the keyboard.
4. WHEN "Prepare for a job" is activated, THE system SHALL navigate to job setup. WHEN "Try the demo" is activated, THE system SHALL create a demo session and navigate to its analysis workspace.
5. THE landing page SHALL NOT make network calls before the user acts, except to fetch static assets.

### Requirement 2: Anonymous sessions

**User story:** As a judge or candidate, I want to start immediately without an account or email verification.

1. WHEN a session is created, THE API SHALL return a `sessionId` (UUID v4), a `sessionToken` (at least 256 bits of CSPRNG entropy), and an `expiresAt` timestamp.
2. THE API SHALL store only a SHA-256 hash of the session token. It SHALL reject any session-scoped request that lacks a matching `Authorization: Bearer <token>` header, returning HTTP 401 without revealing whether the session exists.
3. THE web app SHALL keep the token in `sessionStorage` only, never in `localStorage`, cookies, or URLs.
4. ALL session data SHALL expire through DynamoDB TTL no later than 24 hours after creation.
5. WHEN a user selects "Delete my data", THE API SHALL delete all session records and any related S3 objects. After that, requests using the token SHALL return 401.
6. WHEN the page is reloaded within the session lifetime, THE web app SHALL restore the user to the current stage (analysis, interview, or report).

### Requirement 3: Job setup and input validation

**User story:** As a candidate, I want a focused step-by-step setup, so that I provide the right inputs once.

1. THE setup flow SHALL have three steps: (1) Resume, (2) Target job, (3) Review and analyze. It SHALL show step progress, and moving back SHALL keep entered values.
2. THE resume step SHALL accept either a PDF upload or pasted text. It SHALL show the file requirements (PDF only, 5 MB maximum, 4 pages maximum, text-based rather than scanned) and a temporary-data notice.
3. WHEN a selected file isn't `application/pdf`, is over 5 MB, or has zero bytes, THE web app SHALL reject it before upload and show a specific inline error.
4. Pasted resume text SHALL be 200–12,000 characters. Job description SHALL be 200–8,000 characters. Company name is optional and up to 100 characters. Target role is required and up to 120 characters. Interview type is one of `behavioral_mixed` (default), `technical_mixed`, or `behavioral_only`.
5. Validation SHALL use the same Zod schemas on the client and the server. Field errors SHALL be announced to assistive technology and linked to their fields via `aria-describedby`.
6. WHEN the API receives input that fails the schema, THE API SHALL return HTTP 400 with field-level error codes and SHALL NOT call Bedrock.

### Requirement 4: Secure resume upload and text extraction

**User story:** As a candidate, I want my resume handled securely and briefly.

1. THE API SHALL issue presigned S3 POST policies that expire within 300 seconds. The policy SHALL enforce `content-length-range` 1–5,242,880 bytes, the `Content-Type` `application/pdf`, and a server-chosen object key scoped to the session.
2. THE upload bucket SHALL block all public access, enforce TLS, use SSE-S3 encryption, and expire objects under the `resumes/` and `audio/` prefixes after 1 day.
3. WHEN analysis starts from an uploaded key, THE worker SHALL confirm that the key belongs to the session, check the PDF magic bytes, extract text, and then delete the S3 object whether extraction succeeded or failed.
4. IF extraction yields fewer than 200 characters or the PDF has more than 4 pages, THE system SHALL fail with a recoverable error that suggests pasting the text instead.
5. Resume text SHALL be truncated to at most 12,000 characters before any model call. When truncation happens, THE system SHALL tell the user.

### Requirement 5: Competency and evidence analysis

**User story:** As a candidate, I want to see which job requirements my resume proves, partly proves, or doesn't prove.

1. WHEN analysis is requested, THE API SHALL respond 202 with status `queued` and SHALL process the analysis asynchronously. THE web app SHALL poll status with backoff and show staged progress: Reading resume → Mapping competencies → Checking evidence → Drafting recommendations.
2. THE analysis SHALL produce 6–12 competencies. Each SHALL have an `id`, `name`, `importance`, `description`, `evidence[]`, `strength`, `missingEvidence` (text), `suggestedInterviewTopic`, and `confirmationState` (`none` | `confirmed`). It SHALL also produce 8–30 job keywords, each marked as required or preferred.
3. THE system SHALL obtain all model output through Bedrock Converse tool use with a JSON schema and SHALL validate it with Zod. On a validation failure it SHALL retry once with the validation errors included. If the retry also fails, the analysis status SHALL be `failed` with a recoverable error code, and no partial model output SHALL be stored.
4. THE grounding check SHALL discard any evidence quote of type `resume` that isn't a whitespace- and case-normalized substring of the resume text. IF a competency is left with no evidence, its strength SHALL be set to `none`.
5. THE analysis SHALL finish within 60 seconds for maximum-length inputs, or else report `failed` with a retry option.
6. THE web app SHALL present results with progressive disclosure: an Overview (scores and the top 3 strengths and gaps), then Competencies (a matrix filterable by strength and importance, where each competency expands to show its evidence), then Recommendations.
7. Each evidence quote SHALL be shown with its source label ("From your resume" or "Confirmed by you").

### Requirement 6: Explainable scores

**User story:** As a candidate, I want to know exactly why I got a score and what changed it.

1. THE system SHALL compute these scores deterministically in `packages/shared`, using the formulas in design.md §6: Job Match Score, Evidence Coverage, Keyword Coverage, Resume Parseability, and Interview Readiness. Scores SHALL NOT be produced by the model.
2. THE UI SHALL NOT use the term "ATS score". Resume Parseability SHALL show the disclaimer: "Heuristic readability check, not a prediction of any specific applicant tracking system."
3. EVERY score SHALL have an accessible "How is this calculated?" disclosure that shows the formula and the actual inputs, for example "4 of 5 required competencies have verified evidence."
4. WHEN a score changes, THE system SHALL record a score event (`metric`, `before`, `after`, `reason`, `sourceRef`). THE UI SHALL show the latest change inline, such as "+6 Job Match: you confirmed Kubernetes experience."
5. All scores SHALL be integers from 0 to 100. A pure function of identical inputs SHALL always produce identical scores.

### Requirement 7: Truthful resume recommendations

**User story:** As a candidate, I want resume improvements that never invent anything, and I want to approve each one.

1. Each recommendation SHALL show the original text, proposed text, reason, supported competency, source evidence, trust label, and actions appropriate to that label.
2. `originalText` SHALL be a normalized substring of the resume. Otherwise THE server SHALL discard the recommendation.
3. THE server SHALL discard any recommendation whose proposed text adds (a) a number, percentage, or currency amount, or (b) a job keyword or known technology term that is absent from both the resume and the candidate's confirmations.
4. Recommendations labeled `missing_evidence` SHALL NOT offer "Accept". They SHALL offer "I have this experience" (opens the confirmation flow) and "Practice this in the interview" (marks the topic as an interview priority).
5. WHEN the user accepts or rejects a recommendation, THE decision SHALL be saved and reflected immediately (with optimistic UI and rollback on error). The decision SHALL be reversible until the interview starts.
6. THE system SHALL NOT rewrite the whole resume and SHALL NOT apply any change without an explicit accept action.
7. THE workspace SHALL let the user view the working resume with accepted changes highlighted, and SHALL let them download it as DOCX or PDF (Req 7.10).
8. The analysis SHALL produce at most 10 recommendations.
9. THE workspace SHALL offer a Tailor step that lets the user list, with one click each, job keywords their resume or confirmations already show but their Skills section doesn't, SHALL never add a keyword the resume doesn't show, SHALL show scores at analysis time next to current scores, and SHALL let the user download the tailored resume as DOCX or PDF (Req 7.10, design §7.6–7.7).
10. THE workspace SHALL let the user download the tailored resume (the same text the Resume tab shows) as DOCX and as PDF in two styles: "Your original order" (the candidate's sections, order and wording in a clean single column) and a "Jake's Resume"-style layout (centered header; Education, Experience, Projects, Technical Skills, then other sections). Files SHALL be generated in the browser with no model call, upload or added cost. Every content line SHALL appear exactly once in its original wording (only whitespace and bullet markers normalized, and a trailing date moved to the right), the only added text SHALL be section headings from a fixed list, Unicode letters such as ş, ğ and ı SHALL render, and the PDF SHALL contain selectable text (design §7.7).

### Requirement 8: Candidate confirmation of missing or weak evidence

**User story:** As a candidate who has real experience my resume doesn't show, I want to confirm it truthfully.

1. For a competency with `weak` or `none` strength, THE user SHALL be able to submit a confirmation statement of 30–500 characters. The dialog SHALL include this attestation checkbox: "This describes my real experience."
2. THE system SHALL store the statement as `candidate_confirmation` evidence. Its strength SHALL be capped at `moderate` until matching text exists in the working resume.
3. THE system SHALL generate at most one recommendation per confirmation, labeled `confirmed_by_candidate`, and SHALL apply the same grounding check against the resume plus the statement.
4. A session SHALL allow at most 3 confirmations.
5. Confirmed competencies SHALL be prioritized as interview topics, so the candidate can practice defending them.

### Requirement 9: Adaptive mock interview

**User story:** As a candidate, I want a short interview that probes my weakest areas and responds to what I actually say.

1. WHEN the interview starts, THE system SHALL generate exactly 5 primary questions: 2 behavioral, 2 role-specific, and 1 evidence-gap question. The evidence-gap question SHALL target the highest-importance competency with the weakest evidence. Inputs are the job description, the working resume, the competencies, the seniority inferred from the job description, and the priorities set in 7.4.
2. Each question SHALL reference one or more competency IDs, and its type SHALL be visible to the user (e.g., "Behavioral · Collaboration").
3. After each primary answer, THE system SHALL evaluate the answer and decide whether to ask a follow-up using the rule in design.md §7.3. There SHALL be at most 2 follow-ups and at least 1.
4. A follow-up SHALL quote or paraphrase something specific from the candidate's answer and SHALL be labeled "Follow-up".
5. THE interview room SHALL show progress (e.g., "Question 3 of 5", with follow-ups marked as sub-steps), the current question, an optional 30-second preparation timer, and answer controls.
6. Timers SHALL be informational only. Answers SHALL never be auto-submitted. Timers SHALL be pausable and can be hidden (WCAG 2.2.1).
7. THE user SHALL be able to leave the interview and resume it at the same turn within the session lifetime.

### Requirement 10: Recorded and typed answers

**User story:** As a candidate, I want to speak my answers like a real interview, or type them when I can't.

1. THE web app SHALL support record, stop, replay, re-record, and submit using `MediaRecorder`. Recordings SHALL be limited to 120 seconds, with a visible elapsed and remaining time.
2. THE web app SHALL show a distinct, accessible state for each microphone condition: not yet requested, requesting, granted, denied (with steps to re-enable in the browser), unavailable (no device or insecure context), and unsupported format. Every state SHALL offer the typed-answer fallback.
3. Typed answers SHALL be 20–3,000 characters.
4. Audio SHALL be uploaded through a presigned POST (maximum 10 MB, content types `audio/webm`, `audio/mp4`, or `audio/ogg`) and transcribed with an Amazon Transcribe batch job. The web app SHALL poll status and show "Transcribing…" with a skeleton.
5. WHEN the transcript is ready, THE user SHALL be able to review and edit it before submitting. Edits correct transcription errors. Evaluation SHALL use the reviewed text.
6. THE system SHALL delete the audio object, the transcript object, and the Transcribe job right after the transcript is retrieved, or within 1 day at the latest.
7. IF transcription fails, or the global daily transcription budget is used up, THE system SHALL keep the user on the question and offer the typed answer, with a clear message.

### Requirement 11: Answer evaluation

**User story:** As a candidate, I want specific, fair feedback on each answer.

1. Each answer SHALL be scored 1–4 on relevance, specificity, evidence, STAR structure (behavioral questions only), clarity, ownership/individual contribution, and connection to the target role. Each dimension SHALL include a one-sentence rationale that cites the answer.
2. Evaluation output SHALL be schema-validated. An invalid output SHALL be retried once, and a second failure SHALL produce a recoverable error with "Try again". The user's answer SHALL be kept.
3. THE prompts and rubric SHALL tell the model to judge only the content of the text. They SHALL NOT allow judgment of accent, grammar that doesn't affect meaning, fluency, or perceived non-native phrasing.
4. THE system SHALL NOT output, and the UI SHALL NOT display, any inference about emotion, honesty, personality, disability, or employability.
5. The feedback for each answer SHALL include one strength, one improvement, and a "stronger answer outline" built only from facts in the resume, confirmations, or the answer itself.

### Requirement 12: Readiness report

**User story:** As a candidate, I want a clear summary of how ready I am and what to do next.

1. THE report SHALL include the Interview Readiness score with its explanation, a readiness summary (2–4 sentences), a per-competency status (`ready` | `developing` | `needs_practice` | `not_assessed`), feedback for each question including follow-ups, the strongest evidence, the weakest areas, 2–3 suggested STAR story outlines drawn only from existing evidence, and exactly three prioritized actions.
2. Each prioritized action SHALL reference a competency and a concrete next step.
3. THE user SHALL be able to choose "Practice again" on any question scored below "Proficient". Practice answers are evaluated the same way. The report SHALL show the before/after comparison and record a score event. Readiness uses the best attempt.
4. THE report SHALL be printable through the browser's print stylesheet. This is not a PDF export.
5. Narrative text in the report SHALL be schema-validated model output. All numbers SHALL come from the deterministic scoring functions.

### Requirement 13: Public demo scenario

**User story:** As a judge, I want to experience the full journey in minutes without personal data.

1. THE demo SHALL use a fictional international graduate software engineer applying to a fictional Cloud Software Engineer I role. The labels "Fictional demo profile" and "Fictional company" SHALL be visible on every demo screen.
2. Demo analysis SHALL load instantly from a precomputed fixture that passes the production Zod schemas. The UI SHALL label it "Precomputed sample analysis".
3. Demo interview answers SHALL be evaluated live by Bedrock. Each question SHALL offer "Insert sample answer" (labeled as fictional) so judges can move through quickly.
4. IF Bedrock is unavailable during a demo session, THE system SHALL offer precomputed sample feedback labeled "Sample feedback (live AI unavailable)". It SHALL NOT present that feedback as live.
5. The demo journey from landing to report SHALL take 5 minutes or less when using sample answers.

### Requirement 14: Design system and UX quality

**User story:** As a user, I want a calm, premium, trustworthy interface.

1. THE web app SHALL use the tokens in design.md §9 (color, type, spacing, radius, shadow, motion) through Tailwind theme configuration. Hard-coded hex values outside the token file SHALL fail lint review.
2. Each primary screen SHALL implement loading, skeleton, empty, success, and recoverable error states. Each error state SHALL include a recovery action (Retry, Go back, or Use text instead).
3. Text contrast SHALL be at least 4.5:1, and large text and UI components at least 3:1. Status SHALL never rely on color alone; every status badge includes an icon and text.
4. Every interactive element SHALL be reachable and operable by keyboard and SHALL have a visible focus indicator with at least 3:1 contrast.
5. WHEN `prefers-reduced-motion: reduce` is set, non-essential animation SHALL be disabled.
6. Layouts SHALL be verified at 375px, 768px, and 1280px widths with no horizontal scrolling and touch targets of at least 44×44px on mobile.
7. Icons SHALL come only from `lucide-react`. Decorative icons SHALL be `aria-hidden`.
8. Fonts SHALL be self-hosted (`@fontsource`) so no third-party font request exposes user IP addresses.
9. Every visible button SHALL perform a real action or be visibly labeled "Coming soon" and disabled.

### Requirement 15: Security and privacy

1. Bedrock, Transcribe, and S3 SHALL be called only from Lambda. The frontend bundle SHALL contain no AWS credentials or secrets, only `VITE_API_BASE_URL` and a non-secret `VITE_APP_ENV`.
2. Each Lambda SHALL have a least-privilege IAM role scoped to specific resource ARNs. The only wildcard allowed is where the service requires one (e.g., `transcribe:StartTranscriptionJob`), and each such case SHALL be documented.
3. Application logs SHALL use an allowlisted structured logger (request ID, route, status, latency, error code, token counts, duration). Request bodies, resume text, job text, answers, transcripts, and model prompts or outputs SHALL never be logged. A unit test SHALL assert that redaction works.
4. Environment variables SHALL be validated with Zod at Lambda cold start and at web build time. An invalid configuration fails fast.
5. Model prompts SHALL wrap user content in delimited tags and SHALL tell the model to treat that content as data, not instructions. Output is used only after schema validation and grounding checks.
6. CORS SHALL allow only the Amplify production domain, the Amplify branch domains, and `http://localhost:5173`.
7. `.gitignore` SHALL exist before any environment file is created. `.env.example` SHALL contain only placeholders. CI SHALL run secret scanning (gitleaks) on every PR.
8. The privacy page SHALL state what is stored, where, for how long, and how to delete it.

### Requirement 16: Abuse protection and cost controls

1. API Gateway stage throttling SHALL be set to a rate of 10 req/s with a burst of 20.
2. Per-session quotas SHALL be enforced with DynamoDB conditional updates: 2 analyses, 3 confirmations, 10 answer evaluations (5 primary, 2 follow-up, 3 practice), 2 report generations, and 8 transcriptions.
3. Session creation SHALL be limited to 10 per hashed client IP per hour. The hash is a salted SHA-256 and the raw IP is never stored.
4. A global daily circuit breaker SHALL cap Bedrock calls at 1,500/day and Transcribe audio at 60 minutes/day. When a cap is reached, THE API SHALL return 503 with code `CAPACITY_REACHED`. The UI SHALL explain the situation and point to the demo fixture and the typed fallback.
5. Model output tokens SHALL be capped per call type: analysis 5,000 (the Nova Lite maximum); question generation 1,000; evaluation (with a candidate follow-up) 800; confirmation rewrite 400; report 1,200. Temperature SHALL be 0.2 for analysis and evaluation, and 0.5 for question generation.
6. There SHALL be no provisioned throughput, NAT gateway, VPC, always-on compute, OpenSearch, RDS, ECS/EKS, paid WAF, or vector database.
7. The docs SHALL include AWS Budget alert setup at $5 and $8, with an $10 action notice.

### Requirement 17: Quality gates and deployment

1. Unit tests (Vitest) SHALL cover the scoring functions, grounding checks, schemas, the follow-up decision rule, the logger redaction, and the key UI components.
2. A Playwright test SHALL run the full demo journey (landing → demo → accept and reject a recommendation → 5 questions, including at least one follow-up, with typed answers → report → practice again) against mocked API responses in CI. A smoke variant SHALL run against the deployed URL.
3. Automated axe checks SHALL find no serious or critical violations on the landing, setup, analysis, interview, and report screens.
4. CI (GitHub Actions) SHALL run typecheck, lint, unit tests, build, and gitleaks on every PR into `develop` and `main`.
5. Infrastructure SHALL be defined entirely in AWS CDK (TypeScript), except the Amplify–GitHub connection, which is documented as a console step. The repository SHALL include deploy and teardown instructions.
6. CloudWatch alarms SHALL notify on Lambda errors ≥ 1 in 5 minutes and API 5xx ≥ 5 in 5 minutes, sent to an SNS email topic.
7. The public URL SHALL complete the demo journey in a fresh incognito window with no credentials.

### Requirement 18: Hackathon documentation

1. `docs/` SHALL contain: problem and users, originality, architecture (with diagram), AWS services, Kiro and Agent Toolkit for AWS usage, timeline, security and privacy, cost controls, known limitations, the future React Native plan, deployment and teardown, demo instructions, a screenshots checklist (Kiro connected to AWS), and the submission story.
2. The docs SHALL map features explicitly to the four judging areas: Technical Innovation and Originality, Implementation Quality, Community or Market Impact, and Creativity and Storytelling.
3. Screenshots SHALL be reviewed for credentials, account IDs, and personal data before they're committed.

### Requirement 19: Collaboration and repository hygiene

1. Branches: `main` (production and Amplify production), `develop` (integration and Amplify preview), and `feature/*`. PRs go into `develop`, and a release PR goes from `develop` into `main`.
2. Commits SHALL follow Conventional Commits where practical. No force-pushes and no history rewrites.
3. Generated secrets, user files, audio, `cdk.out`, `dist`, `node_modules`, and `.env*` files (except `.env.example`) SHALL be ignored by git.

---

## Post-hackathon (explicitly out of MVP scope)

- P1. Cognito accounts, saved history, and multiple jobs per user.
- P2. PDF/DOCX export of the working resume. Delivered in the MVP as Req 7.10.
- P3. Amazon Polly interviewer voice. This is a stretch goal only if the whole core journey is deployed and verified by October 1 at 12:00. It should use pre-synthesized audio and a play button, never autoplay.
- P4. Real-time streaming transcription and conversational turn-taking.
- P5. Expo React Native app reusing `packages/shared`.
- P6. Bedrock Guardrails, KMS CMKs, and AWS WAF.
- P7. Multi-language UI and interview practice in other languages.
- P8. Scanned-PDF OCR (Textract).
- P9. Company-specific question banks and seniority calibration datasets.
