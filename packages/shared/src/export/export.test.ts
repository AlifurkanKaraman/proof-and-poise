import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEMO_RESUME_TEXT } from '../fixtures/demo/resume';
import { applySkillAdditions } from '../tailoring/tailor';
import { resumeTextArb } from '../test/arbitraries';
import {
  detectHeading,
  exportFileName,
  exportLayoutFor,
  layoutRuns,
  parseResumeForExport,
  splitTrailingDates,
  verifyExportLayout,
  type ExportBlock,
  type ExportLayout,
  type ExportStyle,
} from './index';

const STYLES: ExportStyle[] = ['original', 'jake'];
const CANONICAL = [
  'Summary',
  'Education',
  'Experience',
  'Projects',
  'Technical Skills',
  'Certifications',
  'Awards',
  'Leadership',
  'Volunteer Experience',
];

/**
 * The oracle's own idea of a heading line that Jake may replace, independent of the parser:
 * one of these phrases (any case, optional colon) that starts with an uppercase letter. It
 * covers every known heading `headingArb` generates; anything else must never vanish.
 */
const ORACLE_HEADINGS = new Set([
  'summary',
  'education',
  'experience',
  'projects',
  'skills',
  'technical skills',
  'certifications',
  'awards',
  'leadership',
  'volunteer',
]);
const oracleHeading = (line: string) => {
  const core = line.trim().replace(/\s*:$/, '');
  return /^[A-Z]/.test(core) && ORACLE_HEADINGS.has(core.toLowerCase());
};

/** Independent oracle for the truthfulness invariant (design §7.7, Req 7.10). */
function oracle(text: string, layout: ExportLayout): string[] {
  const out: string[] = [];
  const lines = text.split('\n');
  // Separators and bullet markers (grounding/normalize.ts BULLETS) carry no content.
  const content = (s: string) => s.replace(/[\s,|*–—\-•‣⁃∙▪▫●◦■□◆◇❖➢➤✓✔·\uF0B7\uF0A7]/g, '');
  const runsByLine = new Map<number, { start: number; end: number }[]>();
  const seen = new Set<string>();
  let unsourcedHeadings = 0;
  for (const block of layout.blocks) {
    const runs =
      block.kind === 'contact'
        ? block.items
        : block.kind === 'entry'
          ? [block.title, block.right, block.subtitle, block.subtitleRight]
          : block.kind === 'skill'
            ? [block.label, block.items]
            : [block.run];
    for (const run of runs) {
      if (!run) continue;
      if (!run.source) {
        if (block.kind !== 'heading' || !CANONICAL.includes(run.text))
          out.push(`added ${run.text}`);
        else unsourcedHeadings++;
        continue;
      }
      const { line, start, end } = run.source;
      if (lines[line]?.slice(start, end) !== run.text || run.text.trim() === '') {
        out.push(`bad slice ${line}`);
      }
      const key = `${line}:${start}`;
      if (seen.has(key)) out.push(`duplicate ${key}`);
      seen.add(key);
      runsByLine.set(line, [...(runsByLine.get(line) ?? []), { start, end }]);
    }
  }
  let dropped = 0;
  lines.forEach((line, i) => {
    const runs = (runsByLine.get(i) ?? []).sort((a, b) => a.start - b.start);
    if (runs.length === 0 && content(line) !== '') {
      if (layout.style === 'jake' && oracleHeading(line)) dropped++;
      else out.push(`missing line ${i}: ${line}`);
      return;
    }
    const joined = runs.map((r) => line.slice(r.start, r.end)).join('');
    if (content(joined) !== content(line)) out.push(`changed line ${i}: ${line}`);
  });
  if (dropped > unsourcedHeadings) out.push('a heading line vanished without a replacement');
  const first = lines.find((l) => content(l) !== '');
  if ((first?.trim() ?? null) !== layout.name) out.push(`name ${layout.name}`);
  return out;
}

const headings = (layout: ExportLayout) =>
  layout.blocks.filter((b) => b.kind === 'heading').map((b) => b.run.text);

const entries = (layout: ExportLayout) =>
  layout.blocks.filter((b): b is Extract<ExportBlock, { kind: 'entry' }> => b.kind === 'entry');

describe('resume export truthfulness (Req 7.10, design §7.7)', () => {
  it.each(STYLES)('%s: every content line appears once, nothing is added', (style) => {
    fc.assert(
      fc.property(resumeTextArb, (text) => {
        const layout = exportLayoutFor(text, style);
        expect(verifyExportLayout(text, layout)).toEqual([]);
        expect(oracle(text, layout)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it.each(STYLES)('%s: holds after accepted changes and added skills', (style) => {
    fc.assert(
      fc.property(
        resumeTextArb,
        fc.array(fc.constantFrom('Kubernetes', 'Go', 'Ağ güvenliği'), { maxLength: 3 }),
        (text, skills) => {
          const tailored = applySkillAdditions(text, skills);
          const layout = exportLayoutFor(tailored, style);
          expect(verifyExportLayout(tailored, layout)).toEqual([]);
          expect(oracle(tailored, layout)).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('verify catches an invented or dropped line', () => {
    const layout = exportLayoutFor(DEMO_RESUME_TEXT, 'jake');
    const invented: ExportLayout = {
      ...layout,
      blocks: [
        ...layout.blocks,
        { kind: 'paragraph', run: { text: 'Led 50 engineers', source: null } },
      ],
    };
    expect(verifyExportLayout(DEMO_RESUME_TEXT, invented)).not.toEqual([]);
    const dropped: ExportLayout = { ...layout, blocks: layout.blocks.slice(0, -1) };
    expect(verifyExportLayout(DEMO_RESUME_TEXT, dropped)).not.toEqual([]);
  });
});

describe('demo fixture', () => {
  const jake = exportLayoutFor(DEMO_RESUME_TEXT, 'jake');
  const original = exportLayoutFor(DEMO_RESUME_TEXT, 'original');

  it('orders sections the Jake way', () => {
    expect(headings(jake)).toEqual([
      'Summary',
      'Education',
      'Experience',
      'Projects',
      'Technical Skills',
    ]);
  });

  it('splits dates to the right of entry titles', () => {
    const intern = entries(jake).find((e) => e.title.text.startsWith('Software Engineering'));
    expect(intern?.title.text).toBe('Software Engineering Intern, Cloud Platform Team');
    expect(intern?.right?.text).toBe('Jun 2024 – Aug 2024');
    expect(intern?.subtitle?.text).toBe('Harborview Logistics (fictional company)');
    const bs = entries(jake).find((e) => e.title.text.startsWith('BS in'));
    expect(bs?.right?.text).toBe('2019 – 2023');
  });

  it('builds the contact line and skill rows', () => {
    const contact = jake.blocks.find((b) => b.kind === 'contact');
    expect(contact?.kind === 'contact' && contact.items.map((r) => r.text)).toContain(
      'amara.okonkwo@example.com',
    );
    expect(jake.name).toBe('Amara Okonkwo (fictional)');
    const languages = jake.blocks.find((b) => b.kind === 'skill' && b.label.text === 'Languages:');
    expect(languages?.kind === 'skill' && languages.items.text).toBe(
      'Python, TypeScript, JavaScript, SQL',
    );
  });

  it('keeps the original order and wording', () => {
    const shown = original.blocks.map((b) =>
      b.kind === 'contact'
        ? b.items.map((r) => r.text).join(' | ')
        : layoutRuns({ ...original, blocks: [b] })[0]?.text,
    );
    const expected = DEMO_RESUME_TEXT.split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => l.replace(/^- /, ''));
    expect(shown).toEqual(expected);
  });

  it('puts added skills in the skills section', () => {
    const text = applySkillAdditions(DEMO_RESUME_TEXT, ['Kubernetes']);
    const layout = exportLayoutFor(text, 'jake');
    const skillsAt = layout.blocks.findIndex(
      (b) => b.kind === 'heading' && b.run.text === 'Technical Skills',
    );
    const added = layout.blocks.findIndex(
      (b) => b.kind === 'skill' && b.label.text === 'Additional skills:',
    );
    expect(added).toBeGreaterThan(skillsAt);
    expect(layout.blocks[added]?.kind === 'skill' && layout.blocks[added].items.text).toBe(
      'Kubernetes',
    );
    expect(verifyExportLayout(text, layout)).toEqual([]);
  });
});

describe('fallbacks and helpers', () => {
  const NO_HEADINGS = 'Ayşe Yıldız (fictional)\nayse@example.com\n\nBuilt things.\n- Did stuff';

  it('keeps a resume with no headings as one section', () => {
    const doc = parseResumeForExport(NO_HEADINGS);
    expect(doc.name?.text).toBe('Ayşe Yıldız (fictional)');
    expect(doc.contact.map((r) => r.text)).toEqual(['ayse@example.com']);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]?.heading).toBeNull();
    for (const style of STYLES) {
      const layout = exportLayoutFor(NO_HEADINGS, style);
      expect(verifyExportLayout(NO_HEADINGS, layout)).toEqual([]);
      expect(layoutRuns(layout).map((r) => r.text)).toEqual([
        'Ayşe Yıldız (fictional)',
        'ayse@example.com',
        'Built things.',
        'Did stuff',
      ]);
    }
  });

  it('detects headings', () => {
    expect(detectHeading('EXPERIENCE')).toBe('experience');
    expect(detectHeading('Technical Skills:')).toBe('skills');
    expect(detectHeading('Volunteer')).toBe('volunteer');
    expect(detectHeading('LANGUAGES')).toBe('unknown');
    expect(detectHeading('- AWS')).toBeNull();
    expect(detectHeading('Built a dashboard')).toBeNull();
    expect(detectHeading('AWS, GCP')).toBeNull();
    expect(detectHeading('Skills & Interests')).toBe('skills');
    expect(detectHeading('TECHNICAL SKILLS AND TOOLS')).toBe('skills');
    // Hard-wrapped sentence fragments from PDF text stay content.
    expect(detectHeading('skills and experience building scalable web services for')).toBeNull();
    expect(detectHeading('Skills and experience in')).toBeNull();
    expect(detectHeading('leadership')).toBeNull();
    expect(detectHeading('experience')).toBeNull();
    expect(detectHeading('● Built a dashboard')).toBeNull();
  });

  it('keeps wrapped heading-like lines in Jake style', () => {
    const text = [
      'Ayşe Yıldız (fictional)',
      'SUMMARY',
      'Backend developer with five years of',
      'skills and experience building scalable web services for',
      'leadership',
      'EXPERIENCE',
      'Engineer, Jan 2024 - Present',
    ].join('\n');
    const layout = exportLayoutFor(text, 'jake');
    expect(verifyExportLayout(text, layout)).toEqual([]);
    expect(oracle(text, layout)).toEqual([]);
    const shown = layoutRuns(layout).map((r) => r.text);
    expect(shown).toContain('skills and experience building scalable web services for');
    expect(shown).toContain('leadership');
    expect(headings(layout)).toEqual(['Summary', 'Experience']);
  });

  it('treats extraction bullet glyphs as bullets', () => {
    const text = [
      'Ayşe Yıldız (fictional)',
      'ayse@example.com ● İstanbul',
      'EXPERIENCE',
      'Engineer, Jan 2024 - Present',
      'Acme (fictional)',
      '● Built a çözüm dashboard',
      '\uF0B7Wrote tests',
      '◦  Fixed bugs',
    ].join('\n');
    for (const style of STYLES) {
      const layout = exportLayoutFor(text, style);
      expect(verifyExportLayout(text, layout)).toEqual([]);
      expect(oracle(text, layout)).toEqual([]);
      const bullets = layout.blocks.filter((b) => b.kind === 'bullet').map((b) => b.run.text);
      expect(bullets).toEqual(['Built a çözüm dashboard', 'Wrote tests', 'Fixed bugs']);
      expect(layoutRuns(layout).some((r) => /[●◦\uF0B7]/.test(r.text))).toBe(false);
    }
    const contact = exportLayoutFor(text, 'jake').blocks.find((b) => b.kind === 'contact');
    expect(contact?.kind === 'contact' && contact.items.map((r) => r.text)).toEqual([
      'ayse@example.com',
      'İstanbul',
    ]);
  });

  it('keeps a URL in the skills section whole', () => {
    const text = 'Ayşe Yıldız (fictional)\nSKILLS\nhttps://github.com/ayse\nGitHub: https://x.dev';
    const layout = exportLayoutFor(text, 'jake');
    expect(verifyExportLayout(text, layout)).toEqual([]);
    const paragraph = layout.blocks.find((b) => b.kind === 'paragraph');
    expect(paragraph?.kind === 'paragraph' && paragraph.run.text).toBe('https://github.com/ayse');
    const skill = layout.blocks.find((b) => b.kind === 'skill');
    expect(skill?.kind === 'skill' && [skill.label.text, skill.items.text]).toEqual([
      'GitHub:',
      'https://x.dev',
    ]);
  });

  it.each([
    ['Intern, Jun 2024 – Aug 2024', 'Intern', 'Jun 2024 – Aug 2024'],
    ['BS in CE, 2019 – 2023', 'BS in CE', '2019 – 2023'],
    ['Engineer | Jan 2024 - Present', 'Engineer', 'Jan 2024 - Present'],
    ['Course Scheduler CLI, Jan 2024 – Mar 2024', 'Course Scheduler CLI', 'Jan 2024 – Mar 2024'],
    ['Award, 2024', 'Award', '2024'],
  ])('splits dates off %s', (line, main, dates) => {
    const r = splitTrailingDates(line);
    expect(line.slice(...r.main)).toBe(main);
    expect(r.dates && line.slice(...r.dates)).toBe(dates);
  });

  it.each(['Led a team of 5 in 2023', '2019 – 2023', 'Digital Marketing'])(
    'leaves %s whole',
    (line) => {
      expect(splitTrailingDates(line).dates).toBeNull();
    },
  );

  it('builds ASCII-safe file names', () => {
    expect(exportFileName('Ayşe Yıldız (fictional)', 'jake', 'pdf')).toBe(
      'ayse-yildiz-fictional-resume-jake.pdf',
    );
    expect(exportFileName('Amara Okonkwo (fictional)', 'original', 'docx')).toBe(
      'amara-okonkwo-fictional-resume-original.docx',
    );
    expect(exportFileName(null, 'original', 'docx')).toBe('resume-original.docx');
    expect(exportFileName('— ✨ —', 'jake', 'pdf')).toBe('resume-jake.pdf');
  });
});
