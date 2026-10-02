/**
 * User-visible labels for the public demo (Req 13.1–13.4). The UI must show these
 * wherever demo content appears, so fixture content is never mistaken for real or live data.
 */
export const DEMO_LABELS = {
  /** Req 13.1: visible on every demo screen. */
  profile: 'Fictional demo profile',
  company: 'Fictional company',
  /** Req 13.2 */
  analysis: 'Precomputed sample analysis',
  /** Req 13.3 */
  insertSampleAnswer: 'Insert sample answer',
  sampleAnswer: 'Sample answer (fictional)',
  /** Req 13.4: offline fallback; never presented as live feedback. */
  sampleFeedback: 'Sample feedback (live AI unavailable)',
} as const;
