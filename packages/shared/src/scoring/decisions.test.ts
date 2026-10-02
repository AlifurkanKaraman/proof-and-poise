import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEMO_EVIDENCE_MAP, DEMO_RESUME_TEXT } from '../fixtures/demo';
import { LIMITS } from '../limits';
import { EvidenceMapSchema } from '../schemas/evidenceMap';
import { applyConfirmation, applyDecision, confirmedCount, nextId } from './decisions';
import { STRENGTH_ORDER } from './weights';

const AT = '2026-09-29T10:00:00.000Z';
const map = DEMO_EVIDENCE_MAP;
const eligible = map.competencies.filter((c) => c.strength === 'weak' || c.strength === 'none');
const acceptable = map.recommendations.filter(
  (r) => r.trustLabel !== 'missing_evidence' && r.proposedText,
);
const statementArb = fc
  .string({ minLength: 30, maxLength: 200 })
  .filter((s) => s.trim().length >= 30);
const STATEMENT = 'I did this work in a real team project last year.';

describe('nextId', () => {
  it('returns an id not in the list and ignores other prefixes', () => {
    expect(nextId('ev', [])).toBe('ev1');
    expect(nextId('ev', ['ev1', 'ev7', 'k9', 'evx'])).toBe('ev8');
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 50 }), { maxLength: 20 }), (ns) => {
        const ids = ns.map((n) => `k${n}`);
        expect(ids).not.toContain(nextId('k', ids));
      }),
    );
  });
});

describe('applyDecision', () => {
  it('has fixture recommendations to exercise', () => {
    expect(acceptable.length).toBeGreaterThan(0);
  });

  it('never mutates its input and yields a valid map', () => {
    const snapshot = JSON.stringify(map);
    for (const decision of ['accept', 'reject', 'reset'] as const) {
      const r = applyDecision({
        map,
        resumeText: DEMO_RESUME_TEXT,
        recId: acceptable[0]!.id,
        decision,
        at: AT,
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(EvidenceMapSchema.safeParse(r.map).success).toBe(true);
    }
    expect(JSON.stringify(map)).toBe(snapshot);
  });

  it('rejects accepting a missing_evidence recommendation (Req 7.4) and unknown ids', () => {
    const missing = map.recommendations.find((r) => r.trustLabel === 'missing_evidence');
    expect(missing).toBeDefined();
    expect(
      applyDecision({
        map,
        resumeText: DEMO_RESUME_TEXT,
        recId: missing!.id,
        decision: 'accept',
        at: AT,
      }),
    ).toEqual({ ok: false, error: 'accept_not_allowed' });
    expect(
      applyDecision({
        map,
        resumeText: DEMO_RESUME_TEXT,
        recId: 'nope',
        decision: 'reject',
        at: AT,
      }),
    ).toEqual({ ok: false, error: 'not_found' });
  });

  it('property: decisions keep Job Match and Evidence Coverage fixed; resetting all restores scores (design §6.3)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            idx: fc.nat({ max: acceptable.length - 1 }),
            decision: fc.constantFrom('accept', 'reject', 'reset'),
          }),
          { maxLength: 8 },
        ),
        (steps) => {
          let current = map;
          for (const s of steps) {
            const r = applyDecision({
              map: current,
              resumeText: DEMO_RESUME_TEXT,
              recId: acceptable[s.idx]!.id,
              decision: s.decision,
              at: AT,
            });
            expect(r.ok).toBe(true);
            if (!r.ok) return;
            current = r.map;
            expect(current.scores.jobMatch).toBe(map.scores.jobMatch);
            expect(current.scores.evidenceCoverage).toBe(map.scores.evidenceCoverage);
          }
          const ids = current.scoreEvents.map((e) => e.id);
          expect(new Set(ids).size).toBe(ids.length);
          for (const rec of acceptable) {
            const r = applyDecision({
              map: current,
              resumeText: DEMO_RESUME_TEXT,
              recId: rec.id,
              decision: 'reset',
              at: AT,
            });
            if (r.ok) current = r.map;
          }
          expect(current.scores).toEqual(map.scores);
        },
      ),
    );
  });
});

describe('applyConfirmation', () => {
  it('has eligible competencies in the fixture', () => {
    expect(eligible.length).toBeGreaterThan(0);
  });

  it('property: strength rises to moderate at most, Job Match never drops, evidence is stored (Req 8.2)', () => {
    fc.assert(
      fc.property(fc.nat({ max: eligible.length - 1 }), statementArb, (idx, statement) => {
        const c = eligible[idx]!;
        const r = applyConfirmation({
          map,
          resumeText: DEMO_RESUME_TEXT,
          competencyId: c.id,
          statement,
          rewrite: null,
          at: AT,
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const rank = (s: string) => STRENGTH_ORDER.indexOf(s as (typeof STRENGTH_ORDER)[number]);
        expect(rank(r.competency.strength)).toBeLessThanOrEqual(rank('moderate'));
        expect(rank(r.competency.strength)).toBeGreaterThanOrEqual(rank(c.strength));
        expect(r.map.scores.jobMatch).toBeGreaterThanOrEqual(map.scores.jobMatch);
        expect(r.competency.interviewPriority).toBe(true);
        expect(r.competency.evidence.at(-1)).toMatchObject({
          source: 'candidate_confirmation',
          quote: statement,
        });
        expect(EvidenceMapSchema.safeParse(r.map).success).toBe(true);
      }),
    );
  });

  it('enforces the per-session limit and one confirmation per competency (Req 8.4)', () => {
    let current = map;
    let done = 0;
    for (const c of eligible) {
      const args = {
        resumeText: DEMO_RESUME_TEXT,
        competencyId: c.id,
        statement: STATEMENT,
        rewrite: null,
        at: AT,
      };
      const r = applyConfirmation({ map: current, ...args });
      if (done >= LIMITS.confirmation.maxPerSession) {
        expect(r).toEqual({ ok: false, error: 'limit_reached' });
        continue;
      }
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      current = r.map;
      done++;
      expect(applyConfirmation({ map: current, ...args })).toEqual({
        ok: false,
        error: 'already_confirmed',
      });
    }
    expect(confirmedCount(current)).toBeLessThanOrEqual(LIMITS.confirmation.maxPerSession);
  });

  it('rejects strong competencies and unknown ids', () => {
    const strong = map.competencies.find((c) => c.strength === 'strong')!;
    const args = {
      map,
      resumeText: DEMO_RESUME_TEXT,
      statement: STATEMENT,
      rewrite: null,
      at: AT,
    };
    expect(applyConfirmation({ ...args, competencyId: strong.id })).toEqual({
      ok: false,
      error: 'not_eligible',
    });
    expect(applyConfirmation({ ...args, competencyId: 'zz' })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('drops an ungrounded or number-adding rewrite but still confirms (Req 8.3)', () => {
    const c = eligible[0]!;
    const original = DEMO_RESUME_TEXT.split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 20)!;
    const base = {
      map,
      resumeText: DEMO_RESUME_TEXT,
      competencyId: c.id,
      statement: STATEMENT,
      at: AT,
    };

    const notInResume = applyConfirmation({
      ...base,
      rewrite: { originalText: 'not in the resume at all', proposedText: 'made up', reason: 'r' },
    });
    expect(notInResume.ok && notInResume.recommendation).toBeUndefined();
    expect(notInResume.ok && notInResume.competency.confirmationState).toBe('confirmed');

    const withNumber = applyConfirmation({
      ...base,
      rewrite: {
        originalText: original,
        proposedText: `${original} Cut costs by 40%.`,
        reason: 'r',
      },
    });
    expect(withNumber.ok && withNumber.recommendation).toBeUndefined();
    expect(withNumber.ok && withNumber.competency.confirmationState).toBe('confirmed');
  });
});
