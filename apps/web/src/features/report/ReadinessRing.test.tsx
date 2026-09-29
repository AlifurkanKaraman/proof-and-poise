import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReadinessRing } from './ReadinessRing';

const readiness = {
  score: 72,
  interviewPerformance: 80,
  jobMatch: 55,
  performanceWeight: 0.7,
  jobMatchWeight: 0.3,
} as const;

describe('ReadinessRing', () => {
  it('shows the score and a text label (not color alone)', () => {
    render(<ReadinessRing readiness={readiness} />);
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Developing')).toBeInTheDocument();
  });

  it('labels scores by band', () => {
    const { rerender } = render(<ReadinessRing readiness={{ ...readiness, score: 90 }} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    rerender(<ReadinessRing readiness={{ ...readiness, score: 30 }} />);
    expect(screen.getByText('Needs Practice')).toBeInTheDocument();
  });

  it('reveals the two-term calculation on demand (Req 12.1)', async () => {
    render(<ReadinessRing readiness={readiness} />);
    const toggle = screen.getByRole('button', { name: /how is this calculated/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: /hide calculation/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/Interview performance 80\/100 × 70%/)).toBeInTheDocument();
    expect(screen.getByText(/job match 55\/100 × 30% = 72\/100/)).toBeInTheDocument();
  });
});
