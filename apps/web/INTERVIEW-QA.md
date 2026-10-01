# Interview room: manual browser QA (task 16)

Recorded answers go: record → presign (`presignAudio`) → POST to S3 → `startTranscription` → poll `getTranscription` → review/edit → `submitAnswer` with `source: 'transcribed'` (Req 10.2, 10.4). Unit tests cover this with a fake `MediaRecorder`; real microphones and codecs need a person.

Run against dev (`VITE_API_BASE_URL` = the dev API, served over HTTPS or `localhost`; the mic needs a secure context). Use a fresh session for each browser. Mock mode (`dev:mock`) works for UI checks; `?mockError=getTranscription:UPSTREAM_UNAVAILABLE` or `?mockError=startTranscription:QUOTA_EXCEEDED` simulates failures.

## Per browser: Chrome, Firefox, desktop Safari, iOS Safari

| #   | Step                                                                   | Expected                                                                                |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Record tab → Enable Microphone → allow                                 | Permission prompt, then Start Recording                                                 |
| 2   | Record ~10 s, Stop, Play                                               | Playback works; duration shown                                                          |
| 3   | Transcribe answer                                                      | Spinner "Transcribing your answer…", then an editable transcript (typically under 30 s) |
| 4   | DevTools Network: `uploads/audio` request body                         | `contentType` is `audio/webm` (Chrome, Firefox) or `audio/mp4` (Safari, iOS)            |
| 5   | Edit the transcript, Submit Answer                                     | Feedback card; next question loads                                                      |
| 6   | Re-record from the transcript view                                     | Transcript cleared, back to Start Recording                                             |
| 7   | Let a recording reach 120 s                                            | Stops automatically at 2:00                                                             |
| 8   | Keyboard only (Tab/Enter/Space) through steps 1–5                      | Every control reachable with a visible focus ring                                       |
| 9   | iOS only: lock the screen or switch apps mid-recording, then come back | No crash; Re-record or Type still works                                                 |

## Microphone denied / unavailable (at least Chrome and iOS Safari)

| #   | Step                                            | Expected                                              |
| --- | ----------------------------------------------- | ----------------------------------------------------- |
| 1   | Block mic for the site, then Enable Microphone  | "Microphone access denied" with a Type instead button |
| 2   | Type instead                                    | Type tab opens; a typed answer submits normally       |
| 3   | No input device, or plain `http://` on a LAN IP | "Microphone unavailable" with Type instead            |

## Failure paths (mock mode is fine)

- Transcription failed → alert with Try again and Type instead; Try again re-sends the same recording.
- `QUOTA_EXCEEDED` → recording-allowance message, no Try again, Type instead works.
- `CAPACITY_REACHED` → "at capacity" message with Try again.

Record each browser's result (pass/fail + notes) in the PR. Automated checks don't prove WCAG conformance; a screen-reader pass (VoiceOver on Safari/iOS) is still needed.
