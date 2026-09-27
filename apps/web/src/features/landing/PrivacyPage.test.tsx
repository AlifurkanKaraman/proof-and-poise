import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from './PrivacyPage';

describe('PrivacyPage (Req 15.8)', () => {
  it('states what is stored, where, for how long, and how to delete it', () => {
    render(<PrivacyPage />);
    for (const name of [
      'What we store',
      'Where it is stored',
      'How long we keep it',
      'How to delete it',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText(/us-east-1/)).toBeInTheDocument();
    expect(screen.getByText(/expires 24 hours after the session is created/)).toBeInTheDocument();
    expect(screen.getByText(/expires after 1 day/)).toBeInTheDocument();
    expect(screen.getByText(/kept for 14 days/)).toBeInTheDocument();
    expect(screen.getByText(/Delete my data/)).toBeInTheDocument();
  });
});
