import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge, type EvidenceStatus } from './StatusBadge';

const cases: [EvidenceStatus, string][] = [
  ['verified', 'Verified'],
  ['confirmed', 'Confirmed by you'],
  ['weak', 'Weak'],
  ['missing', 'Missing'],
  ['rewording', 'Rewording only'],
];

describe('StatusBadge', () => {
  it.each(cases)('%s shows text and a decorative icon', (status, label) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('accepts a custom label', () => {
    render(<StatusBadge status="weak" label="Weak: listed in Skills only" />);
    expect(screen.getByText('Weak: listed in Skills only')).toBeInTheDocument();
  });
});
