import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Providers } from './app/providers';
import { routes } from './app/routes';

/**
 * `pnpm dev:mock` only: start MSW before the first request. `import.meta.env.MODE` is
 * replaced at build time, so production builds drop this branch and the mocks chunk.
 */
async function enableMocking() {
  if (import.meta.env.MODE === 'mock') {
    const { startMockApi } = await import('./mocks/browser');
    await startMockApi();
  }
}

function render() {
  const router = createBrowserRouter(routes);
  const container = document.getElementById('root');
  if (!container) throw new Error('Root element #root not found');
  createRoot(container).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
}

void enableMocking().then(render);
