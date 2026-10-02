/**
 * Product switches for features that are built but not offered in this release.
 *
 * `recordedAnswers`: the Record tab (audio upload → Amazon Transcribe) is complete and
 * tested, but the hackathon account isn't subscribed to Transcribe, so recorded answers
 * are out of scope for the MVP. Answers are typed. Flip to `true` once Transcribe is
 * enabled for the account; no backend change is needed.
 */
export const FEATURES = {
  recordedAnswers: false,
} as const;
