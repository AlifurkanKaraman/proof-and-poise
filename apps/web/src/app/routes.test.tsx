import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Providers } from './providers';
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
      'Turn your real experience into interview-ready evidence.',
    );
    expect(screen.getByRole('link', { name: 'Prepare for a job' })).toHaveAttribute(
      'href',
      '/prepare',
    );
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
  });

  it('renders the 404 page for unknown paths', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('routes session screens', async () => {
    renderAt('/s/abc/interview');
    expect(await screen.findByRole('heading', { name: 'Interview' })).toBeInTheDocument();
  });

  it('exposes /dev/design in dev/test builds', async () => {
    renderAt('/dev/design');
    expect(await screen.findByRole('heading', { name: 'Design system' })).toBeInTheDocument();
  });
});
