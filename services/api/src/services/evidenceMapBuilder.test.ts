import { describe, expect, it } from 'vitest';
import {
  AnalysisModelOutputSchema,
  DEMO_EVIDENCE_MAP,
  DEMO_JOB,
  DEMO_RESUME_TEXT,
  EvidenceMapSchema,
  type AnalysisModelOutput,
} from '@proof-and-poise/shared';
import { demoModelOutput } from '../test/fixtures';
import { buildEvidenceMap, changedWordCount, isHeadingLine } from './evidenceMapBuilder';

const build = (output: AnalysisModelOutput) =>
  buildEvidenceMap({ output, resumeText: DEMO_RESUME_TEXT, job: DEMO_JOB, inputKind: 'text' });

describe('buildEvidenceMap (design §6–§7.4)', () => {
  it('reproduces the precomputed demo map from equivalent model output', () => {
    const output = demoModelOutput();
    expect(AnalysisModelOutputSchema.safeParse(output).success).toBe(true);
    const { evidenceMap, stats } = build(output);
    expect(stats).toEqual({
      discardedQuotes: 0,
      discardedRecommendations: 0,
      discardedCompetencies: 0,
      discardedKeywords: 0,
    });
    expect(EvidenceMapSchema.safeParse(evidenceMap).success).toBe(true);
    expect(evidenceMap.scores).toEqual(DEMO_EVIDENCE_MAP.scores);
    expect(evidenceMap.competencies.map((c) => [c.id, c.strength])).toEqual(
      DEMO_EVIDENCE_MAP.competencies.map((c) => [c.id, c.strength]),
    );
    expect(evidenceMap.recommendations.map((r) => [r.id, r.trustLabel])).toEqual([
      ['r1', 'rewording_only'],
      ['r2', 'verified_from_resume'],
      ['r3', 'missing_evidence'],
    ]);
    // r2 cites the Stack line; its ID resolves to the builder's evidence ID.
    const stack = evidenceMap.competencies
      .flatMap((c) => c.evidence)
      .find((e) => e.quote.startsWith('Stack:'));
    expect(evidenceMap.recommendations[1]?.sourceEvidenceIds).toEqual([stack?.id]);
    expect(evidenceMap.competencies.find((c) => c.id === 'c8')?.recommendationIds).toEqual(['r3']);
  });

  it('discards ungrounded quotes and sets strength none when nothing is left (Req 5.4)', () => {
    const output = demoModelOutput();
    const c1 = output.competencies[0]!;
    c1.evidence = [
      { quote: 'Led a team of twelve engineers at a large bank', section: 'experience' },
    ];
    c1.proposedStrength = 'strong';
    const { evidenceMap, stats } = build(output);
    expect(stats.discardedQuotes).toBe(1);
    const built = evidenceMap.competencies[0]!;
    expect(built.evidence).toEqual([]);
    expect(built.strength).toBe('none');
    expect(evidenceMap.scores.jobMatch).toBeLessThan(DEMO_EVIDENCE_MAP.scores.jobMatch);
  });

  it('accepts whitespace- and case-different quotes, and caps Skills-only evidence at weak', () => {
    const output = demoModelOutput();
    const c6 = output.competencies.find((c) => c.id === 'c6')!;
    c6.evidence = [
      {
        quote: 'infrastructure   as code:  AWS CDK (coursework),\nTerraform (basics)',
        section: 'skills',
      },
    ];
    c6.proposedStrength = 'strong';
    const built = build(output).evidenceMap.competencies.find((c) => c.id === 'c6')!;
    expect(built.evidence).toHaveLength(1);
    expect(built.strength).toBe('weak');
  });

  it('discards recommendations that add numbers or unsupported terms (Req 7.2–7.3)', () => {
    const output = demoModelOutput();
    output.recommendations = [
      {
        competencyId: 'c2',
        originalText:
          'Designed and documented three REST API endpoints in API Gateway for the internal shipment tracking dashboard.',
        proposedText:
          'Designed three REST API endpoints in API Gateway serving 10,000 requests per day.',
        reason: 'Adds scale.',
        trustLabel: 'rewording_only',
        sourceQuotes: [],
      },
      {
        competencyId: 'c8',
        originalText: 'Tools: Git, GitHub Actions, Docker, Postman, Linux',
        proposedText: 'Tools: Git, GitHub Actions, Docker, Kubernetes, Postman, Linux',
        reason: 'Adds Kubernetes.',
        trustLabel: 'verified_from_resume',
        sourceQuotes: ['Tools: Git, GitHub Actions, Docker, Postman, Linux'],
      },
      {
        competencyId: 'c2',
        originalText: 'This sentence is not in the resume at all, anywhere.',
        proposedText: 'This sentence is not in the resume.',
        reason: 'Invented original.',
        trustLabel: 'rewording_only',
        sourceQuotes: [],
      },
      {
        competencyId: 'c2',
        originalText:
          'Was responsible for writing REST API endpoints in TypeScript for the room search and booking features.',
        proposedText:
          'Was responsible for writing REST API endpoints in TypeScript for the room search and booking features.',
        reason: 'No change.',
        trustLabel: 'rewording_only',
        sourceQuotes: [],
      },
    ];
    const { evidenceMap, stats } = build(output);
    expect(evidenceMap.recommendations).toEqual([]);
    expect(stats.discardedRecommendations).toBe(4);
    expect(evidenceMap.competencies.every((c) => c.recommendationIds.length === 0)).toBe(true);
  });

  it('dedupes keywords by canonical term and computes matches deterministically', () => {
    const output = demoModelOutput();
    output.keywords.push({ term: 'k8s', required: true }, { term: 'python', required: false });
    const { evidenceMap } = build(output);
    expect(evidenceMap.keywords.map((k) => k.term)).toEqual(
      DEMO_EVIDENCE_MAP.keywords.map((k) => k.term),
    );
    expect(evidenceMap.keywords.find((k) => k.term === 'Kubernetes')?.matched).toBe(false);
    expect(evidenceMap.keywords.find((k) => k.term === 'Python')?.matched).toBe(true);
  });

  it('records the input kind in parseability', () => {
    const { evidenceMap } = buildEvidenceMap({
      output: demoModelOutput(),
      resumeText: DEMO_RESUME_TEXT,
      job: DEMO_JOB,
      inputKind: 'pdf',
    });
    expect(evidenceMap.parseability.inputKind).toBe('pdf');
  });
  it('drops competencies whose jobQuote is not in the job, with their recommendations (design §7.4)', () => {
    const output = demoModelOutput();
    output.competencies[7]!.jobQuote = 'Strong project management and stakeholder skills';
    const { evidenceMap, stats } = build(output);
    expect(stats.discardedCompetencies).toBe(1);
    expect(evidenceMap.competencies.map((c) => c.id)).not.toContain('c8');
    // r3 belonged to c8, so it goes too.
    expect(evidenceMap.recommendations.map((r) => r.trustLabel)).toEqual([
      'rewording_only',
      'verified_from_resume',
    ]);
  });
  it('drops keywords that do not appear in the job description', () => {
    const output = demoModelOutput();
    output.keywords.push({ term: 'Linux kernel', required: true });
    const { evidenceMap, stats } = build(output);
    expect(stats.discardedKeywords).toBe(1);
    expect(evidenceMap.keywords.map((k) => k.term)).not.toContain('Linux kernel');
  });
  it('keeps enough keywords for a valid map when too many are not in the job', () => {
    const output = demoModelOutput();
    output.keywords = Array.from({ length: 10 }, (_, i) => ({
      term: `Invented ${i}`,
      required: false,
    }));
    output.keywords.push({ term: 'Python', required: true });
    const { evidenceMap, stats } = build(output);
    expect(evidenceMap.keywords).toHaveLength(8);
    expect(evidenceMap.keywords.map((k) => k.term)).toContain('Python');
    expect(stats.discardedKeywords).toBe(3);
  });
  it('drops trivial rewording_only cards that change fewer than 3 words', () => {
    const output = demoModelOutput();
    const original =
      'Designed and documented three REST API endpoints in API Gateway for the internal shipment tracking dashboard.';
    output.recommendations = [
      {
        competencyId: 'c2',
        originalText: original,
        proposedText: `Successfully designed and documented three REST API endpoints in API Gateway for the internal shipment tracking dashboard.`,
        reason: 'Adds filler.',
        trustLabel: 'rewording_only',
        sourceQuotes: [],
      },
    ];
    const { evidenceMap, stats } = build(output);
    expect(evidenceMap.recommendations).toEqual([]);
    expect(stats.discardedRecommendations).toBe(1);
  });
  it('drops working-condition competencies even when quoted from the job', () => {
    const output = demoModelOutput();
    const job = {
      ...DEMO_JOB,
      description: `${DEMO_JOB.description}\n- Work 40 hours/week, and overtime as required.`,
    };
    output.competencies[6]!.jobQuote = 'Work 40 hours/week, and overtime as required';
    const { evidenceMap, stats } = buildEvidenceMap({
      output,
      resumeText: DEMO_RESUME_TEXT,
      job,
      inputKind: 'text',
    });
    expect(stats.discardedCompetencies).toBe(1);
    expect(evidenceMap.competencies.map((c) => c.id)).not.toContain('c7');
  });
  it('drops rewording that appends unsupported claims', () => {
    const output = demoModelOutput();
    output.recommendations = [
      {
        competencyId: 'c5',
        originalText:
          'Modeled bookings in DynamoDB and wrote integration tests for the booking rules.',
        proposedText:
          'Modeled bookings in DynamoDB and wrote integration tests for the booking rules, ensuring they met the project requirements.',
        reason: 'Adds purpose.',
        trustLabel: 'rewording_only',
        sourceQuotes: [],
      },
    ];
    const { evidenceMap, stats } = build(output);
    expect(evidenceMap.recommendations).toEqual([]);
    expect(stats.discardedRecommendations).toBe(1);
  });
  it('drops rewrites of role or date headings', () => {
    const output = demoModelOutput();
    output.recommendations = [
      {
        competencyId: 'c1',
        originalText: 'Campus Room Finder (capstone, team of four), Sep 2024 – May 2025',
        proposedText:
          'Campus Room Finder capstone project with a team of four, from September 2024 to May 2025',
        reason: 'Consistency.',
        trustLabel: 'rewording_only',
        sourceQuotes: [],
      },
    ];
    const { evidenceMap, stats } = build(output);
    expect(evidenceMap.recommendations).toEqual([]);
    expect(stats.discardedRecommendations).toBe(1);
  });
  it('caps a single experience quote at moderate (design §6.1)', () => {
    const output = demoModelOutput();
    const c7 = output.competencies.find((c) => c.id === 'c7')!;
    c7.proposedStrength = 'strong';
    const built = build(output).evidenceMap.competencies.find((c) => c.id === 'c7')!;
    expect(built.evidence).toHaveLength(1);
    expect(built.strength).toBe('moderate');
  });
});

describe('isHeadingLine', () => {
  it('recognizes role and date headings, not achievement bullets', () => {
    expect(
      isHeadingLine('Software Developer Intern Florence, Alabama IPWatch May. 2026 – Aug. 2026'),
    ).toBe(true);
    expect(
      isHeadingLine(
        'Full Stack Developer Istanbul, Turkey Turkish Airlines Technology Apr. 2023 – Oct. 2024',
      ),
    ).toBe(true);
    expect(
      isHeadingLine(
        'Smart Tourism Assistant | MERN Stack (MongoDB, Express, React, Node) 2022 – 2023',
      ),
    ).toBe(true);
    expect(isHeadingLine('Cut p95 query time from 900 ms to 350 ms with a Redis cache.')).toBe(
      false,
    );
    expect(isHeadingLine('Selected as a finalist in Teknofest 2022.')).toBe(false);
  });
});

describe('changedWordCount', () => {
  it('counts added and removed words, ignoring case and spacing', () => {
    expect(changedWordCount('Built a  dashboard', 'built a dashboard')).toBe(0);
    expect(changedWordCount('Built a dashboard', 'Successfully built a dashboard')).toBe(1);
    expect(changedWordCount('Was responsible for writing APIs', 'Wrote APIs')).toBe(5);
  });
});
