/**
 * `POST/GET /report` (Req 6.2, 12.1–12.3, 12.5; design §6.2, §7.2, §8). All numbers come from
 * the shared deterministic functions. The model writes only the narrative, which is checked
 * against the evidence map (`checkNarrative`) before it is stored. Demo sessions never call
 * the model: they use the labeled fixture narrative (Req 13.4).
 */
import {
  buildReport,
  checkNarrative,
  DEMO_REPORT_NARRATIVE,
  evaluatedTurnCount,
  LIMITS,
  ReportSchema,
  type EvidenceMap,
  type InterviewState,
  type Report,
  type ReportNarrativeModelOutput,
} from '@proof-and-poise/shared';
import { invokeStructured, type ModelDeps } from '../ai/invokeStructured';
import { reportNarrativeRequest } from '../ai/prompts/reportNarrative';
import type { AnalysisRepository } from '../data/analysisRepository';
import type { InterviewRepository } from '../data/interviewRepository';
import type { QuotaCounters } from '../data/quotas';
import type { ReportRepository } from '../data/reportRepository';
import type { SessionMeta, SessionRepository } from '../data/sessionRepository';
import { ApiError } from '../lib/errors';
import type { Logger } from '../lib/logger';

export interface ReportServiceDeps {
  reports: Pick<ReportRepository, 'get' | 'put'>;
  interviews: Pick<InterviewRepository, 'get'>;
  analyses: Pick<AnalysisRepository, 'getReady' | 'getAnalysis' | 'getInput'>;
  sessions: Pick<SessionRepository, 'setStage'>;
  quotas: Pick<QuotaCounters, 'consumeSession'>;
  model: ModelDeps;
  log: Logger;
  now: () => number;
}

export class ReportService {
  constructor(private readonly deps: ReportServiceDeps) {}

  /**
   * Idempotent: returns the stored report while it still matches the interview. A practice
   * answer changes the interview, so the next call rebuilds it (and counts against the quota).
   */
  async create(meta: SessionMeta): Promise<Report> {
    const interview = await this.deps.interviews.get(meta.sessionId);
    if (!interview) throw new ApiError('NOT_FOUND');
    if (interview.state.status !== 'complete') throw new ApiError('CONFLICT');

    const evaluatedTurns = evaluatedTurnCount(interview.state);
    const stored = await this.deps.reports.get(meta.sessionId);
    if (stored && stored.evaluatedTurns === evaluatedTurns) {
      await this.enterReportStage(meta);
      return stored.report;
    }

    const ready = await this.deps.analyses.getReady(meta.sessionId);
    if (!ready) {
      throw new ApiError(
        (await this.deps.analyses.getAnalysis(meta.sessionId)) ? 'CONFLICT' : 'NOT_FOUND',
      );
    }
    const { evidenceMap, resumeText } = ready.ready;

    const narrative =
      meta.mode === 'demo'
        ? DEMO_REPORT_NARRATIVE
        : await this.narrate(meta, interview.state, evidenceMap, resumeText);

    const report = buildReport({
      map: evidenceMap,
      state: interview.state,
      narrative,
      generatedAt: new Date(this.deps.now()).toISOString(),
    });
    const parsed = ReportSchema.safeParse(report);
    if (!parsed.success) throw new ApiError('INTERNAL');

    // Taken once the report is certain to be stored, so a failed model call costs nothing.
    if (meta.mode !== 'demo') await this.deps.quotas.consumeSession(meta.sessionId, 'reports');
    await this.deps.reports.put(meta.sessionId, meta.ttl, {
      report: parsed.data,
      evaluatedTurns,
    });
    await this.enterReportStage(meta);
    return parsed.data;
  }

  /** A stale report reads as "not created" so the client asks for a fresh one after practice. */
  async get(meta: SessionMeta): Promise<Report> {
    const interview = await this.deps.interviews.get(meta.sessionId);
    const stored = await this.deps.reports.get(meta.sessionId);
    if (!interview || !stored) throw new ApiError('NOT_FOUND');
    if (stored.evaluatedTurns !== evaluatedTurnCount(interview.state)) {
      throw new ApiError('NOT_FOUND');
    }
    return stored.report;
  }

  private async narrate(
    meta: SessionMeta,
    state: InterviewState,
    map: EvidenceMap,
    resumeText: string,
  ): Promise<ReportNarrativeModelOutput> {
    const { model, now } = this.deps;
    const input = await this.deps.analyses.getInput(meta.sessionId);
    const answered = state.turns.flatMap((t) =>
      t.answer && t.evaluation
        ? [
            {
              label: t.label,
              question: t.question,
              answer: t.answer.text,
              score: t.evaluation.weightedScore,
            },
          ]
        : [],
    );
    const out = await invokeStructured(
      model,
      reportNarrativeRequest(
        {
          role: input?.job.role ?? 'the target role',
          competencies: map.competencies,
          answers: answered,
          resumeText,
        },
        now() + LIMITS.interview.modelTimeoutSec * 1000,
      ),
    );

    // Outlines may use the resume, confirmed statements, evidence, and the candidate's answers.
    const sources = [
      resumeText,
      ...map.competencies.flatMap((c) => c.evidence.map((e) => e.quote)),
      ...answered.map((a) => a.answer),
    ];
    const checked = checkNarrative(out, map, sources);
    if (!checked.ok) {
      this.deps.log.warn('report_narrative_rejected', { errorCode: 'MODEL_OUTPUT_INVALID' });
      throw new ApiError('MODEL_OUTPUT_INVALID');
    }
    return checked.narrative;
  }

  private async enterReportStage(meta: SessionMeta): Promise<void> {
    if (meta.stage !== 'report') await this.deps.sessions.setStage(meta.sessionId, 'report');
  }
}
