import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

function renderLanding() {
  const router = createMemoryRouter([{ path: '/', Component: LandingPage }]);
  render(<RouterProvider router={router} />);
}

afterEach(() => vi.restoreAllMocks());

describe('LandingPage', () => {
  it('renders the hero and both CTAs with their destinations (Req 1.1, 1.4)', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Tailor your resume to the job, using only what you can prove.',
    );
    expect(screen.getByRole('link', { name: 'Prepare for a job' })).toHaveAttribute(
      'href',
      '/prepare',
    );
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
  });

  it('shows the three steps and the trust, privacy, and ethics sections (Req 1.1)', () => {
    renderLanding();
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').filter((li) => /Step \d/.test(li.textContent ?? '')),
    ).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Grounded in your evidence' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the privacy details' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Read our ethical AI approach' })).toHaveAttribute(
      'href',
      '/ethics',
    );
  });

  it('makes no network calls on render (Req 1.5)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderLanding();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
