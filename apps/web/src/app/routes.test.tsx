import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { clearSession, saveSession } from '../lib/session';
import { Providers } from './providers';
import { SESSION_MISSING_MESSAGE } from './RequireSession';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
}

describe('router', () => {
  it('lazy-loads the landing page with both CTAs', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Tailor your resume to the job, using only what you can prove.',
    );
    // The header nav repeats both links, so scope to the page content.
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: 'Prepare for a job' })).toHaveAttribute(
      'href',
      '/prepare',
    );
    expect(main.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
  });

  it('renders the 404 page for unknown paths', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('routes session screens when this tab holds the session token', async () => {
    const sessionId = '0b6f1f7e-2d3c-4a5b-8c9d-0e1f2a3b4c5d';
    saveSession({ sessionId, sessionToken: 't'.repeat(43) });
    renderAt(`/s/${sessionId}/interview`);
    expect(await screen.findByRole('heading', { name: 'Interview' })).toBeInTheDocument();
    clearSession();
  });

  it('redirects session screens to / with a message when the token is missing (design §10)', async () => {
    renderAt('/s/0b6f1f7e-2d3c-4a5b-8c9d-0e1f2a3b4c5d/report');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Tailor your resume to the job, using only what you can prove.',
    );
    expect(screen.getByText(SESSION_MISSING_MESSAGE).closest('[role="status"]')).not.toBeNull();
  });

  it('redirects when the stored session is for a different ID', async () => {
    saveSession({
      sessionId: '11111111-2222-4333-8444-555555555555',
      sessionToken: 't'.repeat(43),
    });
    renderAt('/s/0b6f1f7e-2d3c-4a5b-8c9d-0e1f2a3b4c5d/analysis');
    expect(await screen.findByText(SESSION_MISSING_MESSAGE)).toBeInTheDocument();
    clearSession();
  });

  it('scrolls to the top after navigating via a link (ScrollRestoration)', async () => {
    // jsdom doesn't implement scrollTo.
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    try {
      renderAt('/');
      await screen.findByRole('heading', { level: 1 });
      scrollTo.mockClear();
      const footer = within(screen.getByRole('contentinfo'));
      await userEvent.click(footer.getByRole('link', { name: 'Privacy' }));
      expect(
        await screen.findByRole('heading', { level: 1, name: /privacy/i }),
      ).toBeInTheDocument();
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('exposes /dev/design in dev/test builds', async () => {
    renderAt('/dev/design');
    expect(await screen.findByRole('heading', { name: 'Design system' })).toBeInTheDocument();
  });
});
