import { describe, expect, it } from 'vitest';
import { containsTerm, findTerms, matchKeywords } from '../keywords/match';
import { validateRecommendation } from './labels';
import { normalize } from './normalize';
import { addedTerms, novelTerms, numericTokens } from './novelTerms';
import { filterGroundedEvidence, isGroundedQuote } from './quotes';

const RESUME = `EXPERIENCE
• Built a serverless REST API with AWS Lambda and DynamoDB for 3 campus teams
• Reduced p95 latency by 40% using caching
SKILLS
Python, TypeScript, Terraform`;

describe('normalize', () => {
  it('lowercases, unifies quotes/dashes, strips bullets, collapses whitespace', () => {
    expect(normalize('  • Led  “Cloud”\u2014Team’s  work\n\n')).toBe('led "cloud"-team\'s work');
  });
  it('applies NFKC', () => {
    expect(normalize('ﬁle')).toBe('file');
  });
});

describe('isGroundedQuote', () => {
  it('accepts a normalized substring of a source', () => {
    expect(isGroundedQuote('built a serverless  REST API', [RESUME])).toBe(true);
  });
  it('rejects a quote not in any source', () => {
    expect(isGroundedQuote('Built a Kubernetes operator', [RESUME])).toBe(false);
  });
  it('rejects trivially short quotes', () => {
    expect(isGroundedQuote('python', [RESUME])).toBe(false);
  });
});

describe('filterGroundedEvidence', () => {
  it('drops ungrounded resume quotes and keeps confirmations', () => {
    const { kept, discarded } = filterGroundedEvidence(
      [
        { source: 'resume', quote: 'Reduced p95 latency by 40%' },
        { source: 'resume', quote: 'Managed a team of 20 engineers' },
        { source: 'candidate_confirmation', quote: 'I ran a k8s cluster for my lab.' },
      ],
      RESUME,
    );
    expect(kept.map((e) => e.source)).toEqual(['resume', 'candidate_confirmation']);
    expect(discarded).toBe(1);
  });
});

describe('numericTokens', () => {
  it('extracts canonical numeric claims and ignores product names', () => {
    expect(
      numericTokens('Cut costs by 40 percent, saved $1,200 and 2.5 million on S3 and EC2'),
    ).toEqual(['40%', '$1200', '2.5million']);
  });
});

describe('novelTerms', () => {
  it('flags numbers and tech terms absent from sources', () => {
    const r = novelTerms('Built a REST API on Kubernetes serving 10k users', 'Built a REST API', [
      RESUME,
    ]);
    expect(r.numbers).toEqual(['10k']);
    expect(r.terms).toContain('kubernetes');
  });
  it('allows terms and numbers present elsewhere in the resume', () => {
    const r = novelTerms('Reduced latency by 40% with DynamoDB', 'Reduced p95 latency', [RESUME]);
    expect(r).toEqual({ numbers: [], terms: [] });
  });
  it('treats aliases as the same term', () => {
    const r = novelTerms('Deployed on k8s', 'Deployed', ['Kubernetes cluster admin']);
    expect(r.terms).toEqual([]);
  });
  it('flags job keywords when provided', () => {
    const r = novelTerms('Led stakeholder management', 'Led meetings', [RESUME], {
      keywords: ['stakeholder management'],
    });
    expect(r.terms).toEqual(['stakeholder management']);
  });
});

describe('addedTerms', () => {
  it('lists terms in proposed not in original', () => {
    expect(addedTerms('Built with Python', 'Built a tool').terms).toEqual(['python']);
  });
});

describe('keyword matching', () => {
  it('matches aliases, plurals, and flexible separators', () => {
    expect(containsTerm('Ran workloads on K8s', 'Kubernetes')).toBe(true);
    expect(containsTerm('Wrote REST APIs', 'rest api')).toBe(true);
    expect(containsTerm('Set up CI-CD pipelines', 'CI/CD')).toBe(true);
    expect(containsTerm('Microservice design', 'microservices')).toBe(false);
    expect(containsTerm('Microservices design', 'microservice')).toBe(true);
  });
  it('respects word boundaries and symbols', () => {
    expect(containsTerm('Scala and C++ work', 'c++')).toBe(true);
    expect(containsTerm('Grade C in class', 'c++')).toBe(false);
    expect(containsTerm('JavaScript', 'java')).toBe(false);
  });
  it('findTerms returns canonical terms', () => {
    expect(findTerms('Used JS and AWS Lambda').sort()).toEqual(
      ['aws', 'aws lambda', 'javascript'].sort(),
    );
  });
  it('matchKeywords marks matched keywords', () => {
    const out = matchKeywords(
      [
        { term: 'Python', required: true },
        { term: 'Kubernetes', required: false },
      ],
      [RESUME],
    );
    expect(out.map((k) => k.matched)).toEqual([true, false]);
  });
});

describe('validateRecommendation', () => {
  const ctx = {
    resumeText: RESUME,
    confirmations: [] as string[],
    keywords: ['Terraform', 'Kubernetes'],
  };
  const lambdaQuote = 'Built a serverless REST API with AWS Lambda and DynamoDB for 3 campus teams';

  it('rejects when originalText is not in the resume', () => {
    expect(
      validateRecommendation(
        {
          trustLabel: 'rewording_only',
          originalText: 'Invented text here',
          proposedText: 'x',
          sourceEvidence: [],
        },
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'original_not_in_resume' });
  });

  it('accepts a pure rewording', () => {
    expect(
      validateRecommendation(
        {
          trustLabel: 'rewording_only',
          originalText: 'Reduced p95 latency by 40% using caching',
          proposedText: 'Used caching to reduce p95 latency by 40%',
          sourceEvidence: [],
        },
        ctx,
      ),
    ).toEqual({ ok: true });
  });

  it('rejects a rewording that adds a number', () => {
    const r = validateRecommendation(
      {
        trustLabel: 'rewording_only',
        originalText: 'Reduced p95 latency by 40% using caching',
        proposedText: 'Reduced p95 latency by 55% using caching',
        sourceEvidence: [],
      },
      ctx,
    );
    expect(r).toMatchObject({ ok: false, reason: 'novel_terms', novelCount: 1 });
  });

  it('rejects a rewording that pulls in a term from elsewhere in the resume', () => {
    expect(
      validateRecommendation(
        {
          trustLabel: 'rewording_only',
          originalText: 'Reduced p95 latency by 40% using caching',
          proposedText: 'Reduced p95 latency by 40% using DynamoDB caching',
          sourceEvidence: [],
        },
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'rewording_adds_terms' });
  });

  it('accepts verified_from_resume when the added term is in a cited quote', () => {
    expect(
      validateRecommendation(
        {
          trustLabel: 'verified_from_resume',
          originalText: 'Reduced p95 latency by 40% using caching',
          proposedText: 'Reduced p95 latency by 40% using caching in front of DynamoDB',
          sourceEvidence: [{ source: 'resume', quote: lambdaQuote }],
        },
        ctx,
      ),
    ).toEqual({ ok: true });
  });

  it('rejects verified_from_resume without a supporting quote', () => {
    expect(
      validateRecommendation(
        {
          trustLabel: 'verified_from_resume',
          originalText: 'Reduced p95 latency by 40% using caching',
          proposedText: 'Reduced p95 latency by 40% using caching in front of DynamoDB',
          sourceEvidence: [{ source: 'resume', quote: 'Reduced p95 latency by 40% using caching' }],
        },
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'unsupported_added_terms' });
  });

  it('rejects a job keyword absent from resume and confirmations', () => {
    expect(
      validateRecommendation(
        {
          trustLabel: 'verified_from_resume',
          originalText: lambdaQuote,
          proposedText: 'Built a serverless REST API on Kubernetes for 3 campus teams',
          sourceEvidence: [{ source: 'resume', quote: lambdaQuote }],
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, reason: 'novel_terms' });
  });

  it('allows confirmed_by_candidate terms from the confirmation statement', () => {
    const statement = 'I administered a Kubernetes cluster for my research lab for two semesters.';
    expect(
      validateRecommendation(
        {
          trustLabel: 'confirmed_by_candidate',
          originalText: lambdaQuote,
          proposedText:
            'Built a serverless REST API with AWS Lambda and DynamoDB for 3 campus teams; administered a Kubernetes cluster',
          sourceEvidence: [{ source: 'candidate_confirmation', quote: statement }],
        },
        { ...ctx, confirmations: [statement] },
      ),
    ).toEqual({ ok: true });
  });

  it('missing_evidence must not carry proposed text', () => {
    const base = {
      trustLabel: 'missing_evidence' as const,
      originalText: lambdaQuote,
      sourceEvidence: [],
    };
    expect(validateRecommendation({ ...base, proposedText: null }, ctx)).toEqual({ ok: true });
    expect(validateRecommendation({ ...base, proposedText: 'x' }, ctx)).toEqual({
      ok: false,
      reason: 'unexpected_proposed_text',
    });
  });
});
