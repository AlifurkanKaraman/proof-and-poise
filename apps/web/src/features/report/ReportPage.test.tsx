import type { ErrorCode, Report, Turn } from '@proof-and-poise/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api/errors';
import { ReportView, reportProblem } from './ReportPage';

const dimensions = {
  relevance: { score: 3, rationale: 'On topic.' },
  specificity: { score: 2, rationale: 'Few details.' },
  evidence: { score: 3, rationale: 'Some proof.' },
  star: null,
  clarity: { score: 3, rationale: 'Clear.' },
  ownership: { score: 2, rationale: 'Mostly we.' },
  roleConnection: { score: 3, rationale: 'Relevant.' },
} as const;

function turn(id: string, label: string, kind: Turn['kind'], question: string): Turn {
  return {
    id,
    index: 1,
    label,
    kind,
    competencyIds: ['c1'],
    question,
    status: 'evaluated',
    answer: { text: `Answer for ${question}`, source: 'typed', edited: false },
    evaluation: {
      dimensions,
      strength: 'Clear structure.',
      improvement: 'Add a measurable result.',
      strongerOutline: ['State the situation', 'Quantify the result'],
      weightedScore: 2.5,
      candidateFollowUp: null,
      feedbackSource: 'sample',
    },
  };
}

const report: Report = {
  readiness: {
    score: 68,
    interviewPerformance: 70,
    jobMatch: 64,
    performanceWeight: 0.7,
    jobMatchWeight: 0.3,
  },
  summary: 'Solid React evidence; testing evidence is thin.',
  competencies: [
    { competencyId: 'c1', name: 'React development', readiness: 'developing', bestScore: 2.5 },
    { competencyId: 'c2', name: 'Testing', readiness: 'not_assessed', bestScore: null },
  ],
  questions: [
    {
      primary: turn('q1', '1', 'behavioral', 'Tell me about a project you led.'),
      followUps: [turn('q1f', '1a', 'follow_up', 'What was the measurable result?')],
      practiceAttempts: [],
      originalScore: 2.5,
      bestScore: 2.5,
    },
  ],
  strongestEvidence: [
    { competencyId: 'c1', evidenceId: 'e1', source: 'resume', quote: 'Built a React dashboard' },
  ],
  weakestAreas: [{ competencyId: 'c2', reason: 'No testing evidence yet.' }],
  starOutlines: [
    {
      competencyId: 'c1',
      title: 'React dashboard story',
      situation: 'Team lacked visibility.',
      task: 'Build a dashboard.',
      action: 'Built it in React.',
      result: 'Adopted by the team.',
    },
    {
      competencyId: 'c2',
      title: 'Testing story',
      situation: 'Bugs slipped through.',
      task: 'Add tests.',
      action: 'Wrote unit tests.',
      result: 'Fewer regressions.',
    },
  ],
  actions: [
    { priority: 2, competencyId: 'c2', step: 'Add one testing bullet.' },
    { priority: 1, competencyId: 'c1', step: 'Quantify the dashboard result.' },
    { priority: 3, competencyId: 'c1', step: 'Rehearse the STAR outline.' },
  ],
  scoreEvents: [],
  generatedAt: '2026-09-29T12:00:00.000Z',
};

function renderView(overrides: Partial<Parameters<typeof ReportView>[0]> = {}) {
  const props = {
    report,
    onPrint: vi.fn(),
    onDelete: vi.fn(),
    isDeleting: false,
    onStartOver: vi.fn(),
    onPracticeAgain: vi.fn(),
    ...overrides,
  };
  render(<ReportView {...props} />);
  return props;
}

describe('ReportView', () => {
  it('renders every Req 12.1 section from the contract shape', () => {
    renderView();
    expect(screen.getByRole('heading', { level: 1, name: /readiness report/i })).toBeVisible();
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText(report.summary)).toBeInTheDocument();
    const status = screen.getByRole('heading', { name: /competency status/i }).parentElement!;
    expect(within(status).getByText('React development')).toBeInTheDocument();
    expect(within(status).getByText('Not Assessed')).toBeInTheDocument();
    expect(screen.getByText(/Built a React dashboard/)).toBeInTheDocument();
    expect(screen.getByText(/No testing evidence yet/)).toBeInTheDocument();
    expect(screen.getByText('React dashboard story')).toBeInTheDocument();
  });

  it('lists exactly three actions in priority order with competency names', () => {
    renderView();
    const steps = screen
      .getAllByText(/Quantify the dashboard|Add one testing|Rehearse the STAR/)
      .map((el) => el.textContent);
    expect(steps).toEqual([
      'Quantify the dashboard result.',
      'Add one testing bullet.',
      'Rehearse the STAR outline.',
    ]);
  });

  it('expands question feedback with nested follow-ups and offers practice below Proficient', async () => {
    const props = renderView();
    const toggle = screen.getByRole('button', { name: /Question 1/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('What was the measurable result?')).toBeInTheDocument();
    expect(screen.getAllByText('Not applicable').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /practice this question again/i }));
    expect(props.onPracticeAgain).toHaveBeenCalledWith('q1');
  });

  it('disables practice once every practice attempt is used (Req 12.3)', async () => {
    const q = report.questions[0]!;
    const attempt = (n: number) => turn(`p${n}`, '1', 'practice', q.primary.question);
    renderView({
      report: {
        ...report,
        questions: [{ ...q, practiceAttempts: [attempt(1), attempt(2), attempt(3)] }],
      },
    });
    expect(screen.getByText(/used every practice attempt/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Question 1/ }));
    expect(screen.getByRole('button', { name: /practice this question again/i })).toBeDisabled();
  });

  it('expands every question while printing and restores afterwards', () => {
    renderView();
    const firstQuestion = report.questions[0]!.primary.question;
    const answerText = `Answer for ${firstQuestion}`;
    expect(screen.queryByText(answerText)).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.getByText(answerText)).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(screen.queryByText(answerText)).not.toBeInTheDocument();
  });
  it('explains an empty strongest-evidence list instead of printing a blank card', () => {
    renderView({ report: { ...report, strongestEvidence: [] } });
    expect(screen.getByText(/no resume line is strong enough to highlight yet/i)).toBeVisible();
  });
  it('wires print and delete-data confirmation (Req 2.5)', async () => {
    const props = renderView();
    await userEvent.click(screen.getByRole('button', { name: /^print$/i }));
    expect(props.onPrint).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /delete my data/i }));
    expect(props.onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /delete everything/i }));
    expect(props.onDelete).toHaveBeenCalled();
  });
});

describe('reportProblem', () => {
  const err = (kind: 'http' | 'network', code: ErrorCode) =>
    new ApiError({ kind, code, message: code, route: 'createReport' });

  it('retries only failures where trying again can help', () => {
    expect(reportProblem(err('network', 'INTERNAL')).canRetry).toBe(true);
    for (const code of ['CAPACITY_REACHED', 'MODEL_OUTPUT_INVALID', 'INTERNAL'] as const) {
      expect(reportProblem(err('http', code)).canRetry).toBe(true);
    }
    for (const code of ['CONFLICT', 'NOT_FOUND', 'QUOTA_EXCEEDED', 'UNAUTHORIZED'] as const) {
      expect(reportProblem(err('http', code)).canRetry).toBe(false);
    }
    expect(reportProblem(err('http', 'QUOTA_EXCEEDED')).home).toBe(true);
  });
});
