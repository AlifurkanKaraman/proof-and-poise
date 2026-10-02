/**
 * Deterministic resume tailoring (design §7.6). No model call: every suggestion comes from
 * the job's keywords and text that already exists in the resume or in the candidate's own
 * confirmations, so nothing is invented (Req 7.3, 7.6).
 *
 * - `addToSkills`: job keywords the resume (or a confirmation) already shows, but its Skills
 *   section doesn't list. Adding them doesn't change our keyword score, which already counts
 *   them; it puts them where recruiters and keyword searches look.
 * - `notShown`: job keywords the resume doesn't show. They are never added; the candidate
 *   can confirm real experience (Req 8) or treat them as gaps.
 */
import { containsTerm } from '../keywords/match';
import { buildWorkingResume, confirmationStatements } from '../scoring/recompute';
import type { Competency, EvidenceMap, ScoreEvent, ScoreSet } from '../schemas/evidenceMap';

const SKILLS_HEADING =
  /^\s*(?:technical\s+|core\s+|key\s+)?skills(?:\s*(?:&|and)\s*[\w ]+)?\s*:?\s*$/i;
const SKILLS_INLINE = /^\s*(?:technical\s+|core\s+|key\s+)?skills\s*:/i;
const OTHER_HEADING =
  /^\s*(?:experience|work experience|professional experience|education|projects?|certifications?|awards|publications|summary|profile|objective|languages|interests|volunteer(?:ing)?|references)\s*:?\s*$/i;

export const ADDED_SKILLS_LABEL = 'Additional skills:';

export interface SkillsSection {
  /** Line indexes [start, end) of the section, heading included. */
  start: number;
  end: number;
  text: string;
}

/** The resume's Skills section, or null when it has none. */
export function findSkillsSection(resumeText: string): SkillsSection | null {
  const lines = resumeText.split('\n');
  const start = lines.findIndex((l) => SKILLS_HEADING.test(l) || SKILLS_INLINE.test(l));
  if (start < 0) return null;
  let end = start + 1;
  if (SKILLS_HEADING.test(lines[start] ?? '')) {
    while (end < lines.length && !OTHER_HEADING.test(lines[end] ?? '')) end++;
  }
  // Trailing blank lines don't belong to the section.
  while (end > start + 1 && (lines[end - 1] ?? '').trim() === '') end--;
  return { start, end, text: lines.slice(start, end).join('\n') };
}

export interface SkillSuggestion {
  term: string;
  required: boolean;
  /** Where the evidence for the term is: the resume itself or a candidate confirmation. */
  source: 'resume' | 'confirmation';
}

export interface GapKeyword {
  term: string;
  required: boolean;
  /** A competency the candidate can confirm experience for, when one mentions the term. */
  competencyId: string | null;
}

export interface TailoringPlan {
  /** The working resume (accepted recommendations applied). */
  workingText: string;
  hasSkillsSection: boolean;
  addToSkills: SkillSuggestion[];
  notShown: GapKeyword[];
}

const byRequired = <T extends { required: boolean }>(a: T, b: T) =>
  Number(b.required) - Number(a.required);

function competencyFor(term: string, competencies: readonly Competency[]): string | null {
  const c = competencies.find(
    (k) =>
      k.confirmationState !== 'confirmed' &&
      containsTerm([k.name, k.description, k.missingEvidence ?? ''].join('\n'), term),
  );
  return c?.id ?? null;
}

export function tailoringPlan(
  map: Pick<EvidenceMap, 'competencies' | 'keywords' | 'recommendations'>,
  resumeText: string,
): TailoringPlan {
  const workingText = buildWorkingResume(resumeText, map.recommendations).text;
  const confirmations = confirmationStatements(map).join('\n');
  const skills = findSkillsSection(workingText);
  const addToSkills: SkillSuggestion[] = [];
  const notShown: GapKeyword[] = [];
  const seen = new Set<string>();
  for (const k of map.keywords) {
    const key = k.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const inResume = containsTerm(workingText, k.term);
    const inConfirmation = !inResume && containsTerm(confirmations, k.term);
    if (inResume || inConfirmation) {
      if (!skills || !containsTerm(skills.text, k.term)) {
        addToSkills.push({
          term: k.term,
          required: k.required,
          source: inResume ? 'resume' : 'confirmation',
        });
      }
    } else {
      notShown.push({
        term: k.term,
        required: k.required,
        competencyId: competencyFor(k.term, map.competencies),
      });
    }
  }
  return {
    workingText,
    hasSkillsSection: skills !== null,
    addToSkills: addToSkills.sort(byRequired),
    notShown: notShown.sort(byRequired),
  };
}

/**
 * Add `terms` to the resume's Skills section as one "Additional skills:" line (or a new
 * Skills section at the end). Existing lines are never changed or removed.
 */
export function applySkillAdditions(text: string, terms: readonly string[]): string {
  const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return text;
  const line = `${ADDED_SKILLS_LABEL} ${unique.join(', ')}`;
  const skills = findSkillsSection(text);
  if (!skills) return `${text}${text.endsWith('\n') ? '' : '\n'}\nSkills\n${line}\n`;
  const lines = text.split('\n');
  lines.splice(skills.end, 0, line);
  return lines.join('\n');
}

export type TrailMetric = 'jobMatch' | 'keywordCoverage' | 'evidenceCoverage';

export interface ScoreTrail {
  metric: TrailMetric;
  /** Score when the analysis finished. */
  atAnalysis: number;
  now: number;
}

/** Each score at analysis time (the first event's `before`) next to its current value. */
export function scoreTrail(
  scores: ScoreSet,
  events: readonly Pick<ScoreEvent, 'metric' | 'before'>[],
): ScoreTrail[] {
  const metrics: TrailMetric[] = ['jobMatch', 'keywordCoverage', 'evidenceCoverage'];
  return metrics.map((metric) => {
    const first = events.find((e) => e.metric === metric && e.before !== null);
    return { metric, atAnalysis: first?.before ?? scores[metric], now: scores[metric] };
  });
}
