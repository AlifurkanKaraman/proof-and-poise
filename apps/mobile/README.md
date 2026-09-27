# Proof & Poise mobile (future plan)

Not part of the hackathon MVP and not a workspace package. Nothing here is built or deployed.

Post-hackathon plan (P5):

- Expo (React Native) app that reuses `packages/shared` as TypeScript source through Metro, the same way Vite consumes it today. `packages/shared` stays free of DOM and Node APIs to keep this possible.
- Same API contracts, Zod schemas, scoring, and grounding logic as the web app.
- Native audio recording (`expo-audio`) feeding the existing presigned upload and Transcribe flow.
- Session token stored in secure storage (`expo-secure-store`) instead of `sessionStorage`.
- Accounts (Cognito, P1) are a prerequisite for saved history on mobile.
