import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Providers } from '../../app/providers';
import { routes } from '../../app/routes';
import { loadSession } from '../../lib/session';
import { setMockFault } from '../../mocks/controls';
import { createMockServer } from '../../mocks/node';

const { server } = createMockServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setMockFault(null);
  sessionStorage.clear();
});
afterAll(() => server.close());

function renderDemo() {
  const router = createMemoryRouter(routes, { initialEntries: ['/demo'] });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe('DemoPage', () => {
  it('creates a demo session, stores it, and opens its analysis', async () => {
    const router = renderDemo();
    expect(await screen.findByRole('heading', { name: 'Analysis' })).toBeInTheDocument();
    const session = loadSession();
    expect(session).not.toBeNull();
    expect(router.state.location.pathname).toBe(`/s/${session?.sessionId}/analysis`);
    // The token never appears in the URL (Req 2.3).
    expect(router.state.location.pathname).not.toContain(session?.token ?? '');
  });

  it('shows a recoverable error and retries', async () => {
    setMockFault({ kind: 'CAPACITY_REACHED', route: 'createSession' });
    renderDemo();
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't start the demo");
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');

    setMockFault(null);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Analysis' })).toBeInTheDocument();
  });
});
