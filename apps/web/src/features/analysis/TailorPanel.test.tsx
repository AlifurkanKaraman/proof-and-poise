import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_EVIDENCE_MAP, DEMO_RESUME_TEXT } from '@proof-and-poise/shared';
import { AnalysisWorkspace } from './AnalysisWorkspace';

function renderWorkspace() {
  render(
    <AnalysisWorkspace
      evidenceMap={DEMO_EVIDENCE_MAP}
      resumeText={DEMO_RESUME_TEXT}
      onStartInterview={() => {}}
      actions={{
        onDecide: vi.fn(),
        pendingRecId: null,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      }}
    />,
  );
}

describe('Tailor resume tab (design §7.6)', () => {
  it('is step 1 on the overview and opens the Tailor tab', async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole('button', { name: 'Tailor my resume' }));
    expect(screen.getByRole('tab', { name: 'Tailor resume' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Tailor your resume for this job' })).toBeVisible();
    expect(screen.getByText(/not an employer's ATS score/)).toBeInTheDocument();
  });

  it('offers only keywords the resume shows, and adds them to the tailored resume', async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole('tab', { name: 'Tailor resume' }));
    expect(screen.getByRole('button', { name: 'Add REST APIs to Skills' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add Kubernetes to Skills' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add REST APIs to Skills' }));
    expect(screen.getByRole('button', { name: 'Remove REST APIs from Skills' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: /view and download/i }));
    const lines = screen.getByRole('list', { name: 'Tailored resume lines' });
    expect(within(lines).getByText('Additional skills: REST APIs')).toBeInTheDocument();
    expect(screen.getByText(/1 skill added/)).toBeInTheDocument();
  });

  it('lists missing keywords as gaps with a confirmation action, never as additions', async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole('tab', { name: 'Tailor resume' }));
    const gaps = screen.getByRole('heading', {
      name: /keywords your resume doesn't show/i,
    }).parentElement!;
    expect(within(gaps).getByText('Kubernetes')).toBeInTheDocument();
    expect(
      within(gaps).getAllByRole('button', { name: /i have this experience/i }).length,
    ).toBeGreaterThan(0);
  });
});
