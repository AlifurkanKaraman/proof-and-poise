/**
 * Single source of truth for every input, output, and quota limit.
 * Client validation, server validation, prompts, and infrastructure read from here.
 */
export const LIMITS = {
  session: {
    ttlHours: 24,
    /** 32 bytes = 256 bits of CSPRNG entropy (Req 2.1). */
    tokenBytes: 32,
  },
  resumeText: { min: 200, max: 12_000 },
  jobText: { min: 200, max: 8_000 },
  company: { max: 100 },
  role: { min: 1, max: 120 },
  resumeUpload: {
    contentType: 'application/pdf',
    minBytes: 1,
    maxBytes: 5_242_880,
    maxPages: 4,
    presignExpiresSec: 300,
  },
  audioUpload: {
    contentTypes: ['audio/webm', 'audio/mp4', 'audio/ogg'],
    minBytes: 1,
    maxBytes: 10 * 1024 * 1024,
    presignExpiresSec: 300,
  },
  recording: { maxSeconds: 120 },
  /**
   * Amazon Transcribe batch settings (Req 10.4). `IdentifyLanguage` is off: identification
   * adds latency and can pick the wrong language for short clips. Jobs use `languageCode`;
   * `en-GB` and `en-IN` are the supported alternatives if a demo needs them.
   */
  transcribe: {
    languageCode: 'en-US',
    alternativeLanguageCodes: ['en-GB', 'en-IN'],
  },
  answer: { min: 20, max: 3_000 },
  /** `rewriteTimeoutSec` bounds the confirmRewrite model call inside the 25 s API Lambda. */
  confirmation: { min: 30, max: 500, maxPerSession: 3, rewriteTimeoutSec: 15 },
  analysis: {
    competencies: { min: 6, max: 12 },
    keywords: { min: 8, max: 30 },
    recommendations: { max: 10 },
    evidencePerCompetency: { max: 5 },
    /** Each competency cites the job phrase it comes from (design §7.4). */
    jobQuote: { maxChars: 200 },
    /** A `rewording_only` card must change at least this many words to be worth showing. */
    minRewordingChangedWords: 3,
    /** Above this share of keywords that just repeat competency names, ask for a repair. */
    maxCompetencyNameKeywordShare: 0.5,
    /** Minimum extracted characters before extraction counts as successful (Req 4.4). */
    minExtractedChars: 200,
    /** Target end-to-end time budget (Req 5.5). */
    timeoutSec: 60,
    /**
     * A queued or running analysis older than this is reported as failed (lost async
     * invoke or a worker that hit its Lambda timeout), so the client can retry (Req 5.5).
     */
    staleAfterSec: 120,
  },
  grounding: {
    /** Quotes shorter than this never count as grounded (design §7.4). */
    minQuoteChars: 12,
  },
  interview: {
    primaryQuestions: 5,
    candidateQuestions: { behavioral: 3, roleSpecific: 3 },
    selectedQuestions: { behavioral: 2, roleSpecific: 2 },
    /** Position (1-based) of the forced evidence-gap question in the plan. */
    gapPosition: 3,
    minFollowUps: 1,
    maxFollowUps: 2,
    followUpMaxChars: 300,
    questionMaxChars: 400,
    prepTimerSec: 30,
    /** Bonus added to a competency's plan priority when the candidate flagged or confirmed it. */
    priorityBonus: 0.5,
    /** Bounds each interview model call inside the 25 s API Lambda. */
    modelTimeoutSec: 20,
  },
  quotas: {
    analyses: 2,
    confirmations: 3,
    evaluations: 10,
    primaryEvaluations: 5,
    followUpEvaluations: 2,
    practiceEvaluations: 3,
    reports: 2,
    transcriptions: 8,
  },
  /** Session creation per salted IP hash per hour; the counter item lives 2 h (design §5). */
  rateLimit: { sessionsPerIpPerHour: 10, ttlHours: 2 },
  /** Global daily circuit breaker (Req 16.4); the counter item lives 3 days (design §5). */
  globalBudget: {
    bedrockCallsPerDay: 1_500,
    transcribeSecondsPerDay: 60 * 60,
    ttlDays: 3,
  },
  model: {
    // Nova Lite's output maximum. 3,000 truncated the tool call on long resumes, which
    // Bedrock reports as ModelErrorException (Req 16.5).
    analyze: { maxTokens: 5_000, temperature: 0.2 },
    confirmRewrite: { maxTokens: 400, temperature: 0.2 },
    generateQuestions: { maxTokens: 1_000, temperature: 0.5 },
    evaluateAnswer: { maxTokens: 800, temperature: 0.2 },
    reportNarrative: { maxTokens: 1_200, temperature: 0.3 },
  },
  report: {
    summarySentences: { min: 2, max: 4 },
    starOutlines: { min: 2, max: 3 },
    actions: 3,
  },
} as const;

export type ModelTask = keyof typeof LIMITS.model;
export type AudioContentType = (typeof LIMITS.audioUpload.contentTypes)[number];
