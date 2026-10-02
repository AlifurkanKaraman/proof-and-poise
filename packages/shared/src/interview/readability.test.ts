import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AnswerRequestSchema } from '../schemas/inputs';
import { isPlausibleWord, isReadableAnswer } from './readability';

const WORDS = [
  'I',
  'led',
  'a',
  'migration',
  'and',
  'cut',
  'latency',
  'by',
  'adding',
  'indexes',
  'to',
  'the',
  'database',
  'team',
  'reviewed',
  'every',
  'change',
  'before',
  'release',
  'which',
  'reduced',
  'errors',
  'strengths',
  'customers',
  'reported',
  'faster',
  'pages',
];

describe('isReadableAnswer (keyboard mashing never reaches evaluation)', () => {
  it.each([
    'gasdgasdgasgasdgsagadsga',
    'sfasfasfasfasfasfasfsaf',
    'asdgsdagsadgasdgasgasdgs',
    'Sgdsgsdgadgaga',
    'asdf asdf asdf asdf asdf',
    'sdfg hjkl qwrt zxcv bnmp',
    '!!!!!!!!!!!!!!!!!!!!!!!!',
  ])('rejects %j', (text) => {
    expect(isReadableAnswer(text)).toBe(false);
  });

  it.each([
    'I led a migration and cut latency 35%.',
    'I did some work on a project.',
    'Situation: our dashboard took 8 seconds to load. I added indexes and pagination.',
    'At Acme I led a migration, cutting p95 latency by 35% across two quarters.',
  ])('accepts %j', (text) => {
    expect(isReadableAnswer(text)).toBe(true);
  });

  it('accepts sentences of at least five distinct real words', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...WORDS), { minLength: 5, maxLength: 20 }),
        (words) => isReadableAnswer(`${words.join(' ')}.`),
      ),
    );
  });

  it('rejects any single whitespace-free token', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{20,60}$/), (token) => !isReadableAnswer(token)),
    );
  });

  it('rejects one word repeated', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...WORDS),
        fc.integer({ min: 5, max: 30 }),
        (w, n) => !isReadableAnswer(Array.from({ length: n }, () => w).join(' ')),
      ),
    );
  });

  it('treats non-Latin words as plausible', () => {
    expect(isPlausibleWord('проект')).toBe(true);
    expect(isPlausibleWord('sdfghj')).toBe(false);
  });
});

describe('AnswerRequestSchema readability', () => {
  it('rejects unreadable text on the text field', () => {
    const r = AnswerRequestSchema.safeParse({
      text: 'asdgsdagsadgasdgasgasdgs',
      source: 'typed',
      edited: false,
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['text']);
  });
});
