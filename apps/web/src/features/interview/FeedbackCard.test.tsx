import type { Evaluation } from '@proof-and-poise/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackCard } from './FeedbackCard';

const dim = (score: number) => ({ score, rationale: `Because ${score}` });

const evaluation: Evaluation = {
  dimensions: {
    relevance: dim(4),
    specificity: dim(3),
    evidence: dim(2),
    star: null,
    clarity: dim(3),
    ownership: null,
    roleConnection: dim(1),
  },
  strength: 'Clear ownership of the outcome.',
  improvement: 'Add a metric.',
  strongerOutline: ['State the situation', 'Quantify the result'],
  weightedScore: 2.8,
  candidateFollowUp: null,
  feedbackSource: 'sample',
};

describe('FeedbackCard', () => {
  it('renders scored dimensions and marks null ones as not assessed', () => {
    render(<FeedbackCard evaluation={evaluation} onContinue={() => {}} />);
    expect(screen.getByText('2.8/4.0')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
    expect(screen.getAllByText(/not assessed/i)).toHaveLength(2);
    expect(screen.getByText('Quantify the result')).toBeInTheDocument();
  });

  it('continues, and offers the report on the last question', async () => {
    const onContinue = vi.fn();
    const { rerender } = render(<FeedbackCard evaluation={evaluation} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /next question/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    rerender(<FeedbackCard evaluation={evaluation} onContinue={onContinue} isLast />);
    expect(screen.getByRole('button', { name: /view your report/i })).toBeInTheDocument();
  });
});
