# 10. React Native plan (post-hackathon)

Not built. `apps/mobile/` holds only a README and isn't a workspace package (post-hackathon item P5).

## Why it's cheap to add

`packages/shared` is pure TypeScript with `zod` as its only runtime dependency, and no DOM, Node, AWS SDK, or React imports (`.kiro/steering/structure.md`). It's consumed as source, with no build step, so Expo's Metro bundler can import it the same way Vite does. A mobile app would reuse, unchanged:

- Route contracts and Zod schemas (`contracts/`, `schemas/`), so requests and responses are validated the same way.
- Scoring, grounding, and interview rules, so score explanations match the web app exactly.
- `LIMITS` for client-side validation.
- The demo fixture.

## What would be new

| Area          | Web today                       | Mobile plan                                                           |
| ------------- | ------------------------------- | --------------------------------------------------------------------- |
| App shell     | React + Vite + react-router     | Expo + Expo Router                                                    |
| Session token | `sessionStorage`                | `expo-secure-store`                                                   |
| Recording     | `MediaRecorder` (`useRecorder`) | `expo-audio`, feeding the same presigned upload and Transcribe routes |
| Resume input  | PDF dropzone or paste           | Document picker or paste, same presigned POST                         |
| UI components | Radix + Tailwind                | Native components using the same design tokens                        |

No API changes are needed: the API is plain HTTPS JSON with a bearer token. CORS doesn't apply to native clients, but per-IP rate limits and global caps still do.

## Prerequisites

- Accounts (Cognito, P1) before saved history on mobile.
- An audio format check: Transcribe and the upload conditions accept `audio/webm`, `audio/mp4`, and `audio/ogg` (`LIMITS.audioUpload`); the mobile recorder must produce one of them.
