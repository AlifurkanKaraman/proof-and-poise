import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_EVIDENCE_MAP, type Recommendation } from '@proof-and-poise/shared';
import { AnalysisWorkspace } from './AnalysisWorkspace';
import { changedLines, WorkingResume } from './WorkingResume';

const RESUME = ['Jordan Doe', 'Built a dashboard for the team', 'Wrote tests'].join('\n');

const rec = (over: Partial<Recommendation>): Recommendation => ({
  ...DEMO_EVIDENCE_MAP.recommendations.find((r) => r.trustLabel !== 'missing_evidence')!,
  id: 'r1',
  originalText: 'Built a dashboard for the team',
  proposedText: 'Built a React dashboard used daily by 12 analysts',
  decision: 'accepted',
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('WorkingResume (Req 7.7)', () => {
  it('applies an accepted change and labels the changed line with text, not color alone', () => {
    render(<WorkingResume resumeText={RESUME} recommendations={[rec({})]} />);
    const list = screen.getByRole('list', { name: 'Tailored resume lines' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent('Changed line:');
    expect(items[1]).toHaveTextContent('Built a React dashboard used daily by 12 analysts');
    expect(within(items[1]!).getByText('Changed')).toBeInTheDocument();
    expect(items[0]).not.toHaveTextContent('Changed');
    expect(screen.queryByText('Built a dashboard for the team')).not.toBeInTheDocument();
  });

  it('leaves pending and rejected changes out', () => {
    render(
      <WorkingResume
        resumeText={RESUME}
        recommendations={[rec({ decision: 'pending' }), rec({ id: 'r2', decision: 'rejected' })]}
      />,
    );
    expect(screen.getByText('Built a dashboard for the team')).toBeInTheDocument();
    expect(screen.queryByText('Changed')).not.toBeInTheDocument();
    expect(screen.getByText(/Accepted changes and added skills appear here/)).toBeInTheDocument();
  });

  it('copies the working text to the clipboard and announces it', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    // userEvent.setup() installs its own clipboard; replace it with the spy.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<WorkingResume resumeText={RESUME} recommendations={[rec({})]} />);
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(writeText).toHaveBeenCalledWith(
      ['Jordan Doe', 'Built a React dashboard used daily by 12 analysts', 'Wrote tests'].join('\n'),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Tailored resume copied');
  });

  it('offers a manual fallback when the clipboard is blocked', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<WorkingResume resumeText={RESUME} recommendations={[]} />);
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(screen.getByRole('status')).toHaveTextContent('copy it manually');
  });

  it('is reachable as a Resume tab in the workspace', async () => {
    render(
      <AnalysisWorkspace
        evidenceMap={{ ...DEMO_EVIDENCE_MAP, recommendations: [rec({})] }}
        resumeText={RESUME}
        onStartInterview={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Resume' }));
    expect(screen.getByRole('heading', { name: 'Tailored resume' })).toBeInTheDocument();
    expect(screen.getByText('Changed line:')).toBeInTheDocument();
  });

  it('marks only lines that differ', () => {
    expect(changedLines('a\nb\nb', 'a\nB\nb')).toEqual([false, true, false]);
  });
});

describe('AnalysisWorkspace empty states', () => {
  it('shows empty states when there are no competencies or keywords', async () => {
    render(
      <AnalysisWorkspace
        evidenceMap={{ ...DEMO_EVIDENCE_MAP, competencies: [], keywords: [], recommendations: [] }}
        onStartInterview={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: /Competencies/ }));
    expect(screen.getByRole('heading', { name: 'No competencies found' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Keywords/ }));
    expect(screen.getByRole('heading', { name: 'No keywords found' })).toBeInTheDocument();
  });
});
