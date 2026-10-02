import { LIMITS } from '../limits';

/**
 * Deterministic gate for interview answers (Req 9–11): rejects keyboard mashing such as
 * "asdgsdagsadgasdg" before any model call, so unreadable text can't earn a score.
 * A token is a run of letters. It's plausible when it has at most `maxWordLetters`
 * letters and, if it uses Latin letters, contains a vowel and no run of more than
 * `maxConsonantRun` consonants. Tokens in other scripts count as plausible.
 */
const LETTER_RUN = /\p{L}+/gu;
const LATIN = /[a-z]/i;
const VOWEL = /[aeiouy]/i;

export function isPlausibleWord(token: string): boolean {
  const { maxWordLetters, maxConsonantRun } = LIMITS.answer.readability;
  if ([...token].length > maxWordLetters) return false;
  if (!LATIN.test(token)) return true;
  if (!VOWEL.test(token)) return false;
  const run = new RegExp(`[b-df-hj-np-tv-xz]{${maxConsonantRun + 1},}`, 'i');
  return !run.test(token);
}

export function isReadableAnswer(text: string): boolean {
  const { minWords, minDistinctWords, minShare } = LIMITS.answer.readability;
  const tokens = text.match(LETTER_RUN) ?? [];
  if (tokens.length === 0) return false;
  const plausible = tokens.filter(isPlausibleWord);
  const distinct = new Set(plausible.map((t) => t.toLowerCase())).size;
  return (
    plausible.length >= minWords &&
    distinct >= minDistinctWords &&
    plausible.length / tokens.length >= minShare
  );
}

export const UNREADABLE_ANSWER_MESSAGE =
  'Write your answer in full sentences so it can be evaluated.';
