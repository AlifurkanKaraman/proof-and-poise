import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnswerPanel } from './AnswerPanel';

const LONG = 'I led a migration of our billing service and cut the error rate by half.';

async function openTypeTab() {
  await userEvent.click(screen.getByRole('tab', { name: /type/i }));
}

describe('AnswerPanel', () => {
  it('keeps submit disabled until the typed answer reaches the minimum length', async () => {
    render(<AnswerPanel onSubmit={() => {}} isSubmitting={false} />);
    await openTypeTab();
    const submit = screen.getByRole('button', { name: /submit answer/i });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/your answer/i), 'too short');
    expect(submit).toBeDisabled();
    expect(screen.getByText(/at least 20 characters/i)).toBeInTheDocument();
  });

  it('submits the trimmed typed answer', async () => {
    const onSubmit = vi.fn();
    render(<AnswerPanel onSubmit={onSubmit} isSubmitting={false} />);
    await openTypeTab();
    await userEvent.type(screen.getByLabelText(/your answer/i), `  ${LONG}  `);
    await userEvent.click(screen.getByRole('button', { name: /submit answer/i }));
    expect(onSubmit).toHaveBeenCalledWith({ type: 'text', text: LONG });
  });

  it('disables submit while submitting', async () => {
    render(<AnswerPanel onSubmit={() => {}} isSubmitting />);
    await openTypeTab();
    await userEvent.type(screen.getByLabelText(/your answer/i), LONG);
    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
  });
});
