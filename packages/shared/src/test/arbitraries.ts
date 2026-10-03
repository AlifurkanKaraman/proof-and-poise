import fc from 'fast-check';
import type { Importance, Strength } from '../schemas/common';
import type { DimensionScores } from '../schemas/interview';

export const importanceArb: fc.Arbitrary<Importance> = fc.constantFrom(
  'required',
  'preferred',
  'contextual',
);
export const strengthArb: fc.Arbitrary<Strength> = fc.constantFrom(
  'strong',
  'moderate',
  'weak',
  'none',
);

export const scoredCompetencyArb = fc.record({ importance: importanceArb, strength: strengthArb });

export const competenciesArb = fc.array(scoredCompetencyArb, { minLength: 6, maxLength: 12 });

export const keywordsArb = fc.array(fc.record({ required: fc.boolean(), matched: fc.boolean() }), {
  minLength: 8,
  maxLength: 30,
});

const dimArb = fc.record({
  score: fc.integer({ min: 1, max: 4 }),
  rationale: fc.constant('Cites the answer.'),
});

/** Rubric dimensions; `star` is null for non-behavioral questions. */
export const dimensionsArb: fc.Arbitrary<DimensionScores> = fc.record({
  relevance: dimArb,
  specificity: dimArb,
  evidence: dimArb,
  star: fc.option(dimArb, { nil: null }),
  clarity: dimArb,
  ownership: dimArb,
  roleConnection: dimArb,
});

/** Candidate follow-up: absent, usable, or too long to use. */
export const candidateFollowUpArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 300 }).filter((s) => s.trim().length > 0),
  fc.string({ minLength: 301, maxLength: 400 }),
);

/** Characters for free-form resume lines: Turkish/Latin letters, separators, digits. */
const resumeCharArb = fc.constantFrom(
  ...'abcXYZ ş ğ ı İ ç ö ü é ñ Ş Ğ Ç Ö Ü – — | · • ● \uF0B7 * - , : ( ) @ . 0 2 9\t'.split(' '),
  ' ',
  ' ',
);

const headingArb = fc
  .constantFrom(
    'Experience',
    'Education',
    'Projects',
    'Skills',
    'Technical Skills',
    'Summary',
    'Certifications',
    'Awards',
    'Leadership',
    'Volunteer',
    'Languages',
    'Publications',
  )
  .chain((h) =>
    fc.constantFrom(h, h.toUpperCase(), h.toLowerCase(), `${h}:`, `  ${h.toUpperCase()}  `),
  );

const wordsArb = fc
  .array(fc.constantFrom('Built', 'Ayşe', 'Yıldız', 'İstanbul', 'API', 'çözüm', 'Müller'), {
    minLength: 1,
    maxLength: 5,
  })
  .map((w) => w.join(' '));

const datesArb = fc.constantFrom(
  'Jun 2024 – Aug 2024',
  '2019 – 2023',
  'Jan 2024 - Present',
  'Sept 2021 to May 2022',
  '2024',
);

/**
 * Content lines that look a bit like headings but aren't: hard line wraps out of a sentence
 * in PDF-extracted text. An export must keep every one of them.
 */
const headingLikeContentArb = fc.constantFrom(
  'skills and experience building scalable web services for',
  'Skills and experience building',
  'Skills and experience in',
  'leadership',
  'experience',
  'education',
  'projects',
  'technical skills and',
  'Experience building serverless APIs on AWS for a team',
  'https://github.com/ayse-yildiz',
);

/** One resume line: headings, bullets, dated titles, skill lines, blanks and noise. */
export const resumeLineArb: fc.Arbitrary<string> = fc.oneof(
  headingArb,
  headingLikeContentArb,
  wordsArb.map((w) => w.toUpperCase()),
  fc
    .tuple(
      fc.constantFrom('-', '•', '*', '–', '●', '◦', '\uF0B7', '✓'),
      fc.constantFrom(' ', '  ', '\t', ''),
      wordsArb,
    )
    .map(([m, s, w]) => `${m}${s}${w}`),
  fc
    .tuple(wordsArb, fc.constantFrom(', ', ' | ', ' ', '  ', '\t', ' – '), datesArb)
    .map(([w, s, d]) => `${w}${s}${d}`),
  fc.tuple(wordsArb, wordsArb).map(([l, items]) => `${l}: ${items}, ${items}`),
  fc.constantFrom('', '   ', '---', '- ', '•'),
  fc.string({ unit: resumeCharArb, maxLength: 40 }),
);

/** A resume as newline-joined `resumeLineArb` lines (the first non-blank one is the name). */
export const resumeTextArb: fc.Arbitrary<string> = fc
  .array(resumeLineArb, { minLength: 0, maxLength: 40 })
  .map((lines) => lines.join('\n'));
