import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  DEMO_EVIDENCE_MAP,
  DEMO_JOB,
  DEMO_RESUME_TEXT,
  routes as contractRoutes,
  type AnalysisStatusResponse,
  type EvidenceMap,
} from '@proof-and-poise/shared';
import { Providers } from '../../app/providers';
import { routes } from '../../app/routes';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/session';
import { mswPath } from '../../mocks/handlers';
import { createMockServer } from '../../mocks/node';
import { clearSetupDraft, saveSetupDraft } from '../setup/setupForm';
import { AnalysisWorkspace } from './AnalysisWorkspace';

const { server } = createMockServer({ analysisMs: 1 });
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
  clearSetupDraft();
});
afterAll(() => server.close());

async function openAnalysis() {
  const created = await api.request('createSession', { body: { mode: 'demo' } });
  saveSession(created);
  const router = createMemoryRouter(routes, {
    initialEntries: [`/s/${created.sessionId}/analysis`],
  });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { router, sessionId: created.sessionId };
}

const analysisOnce = (body: AnalysisStatusResponse) =>
  server.use(
    http.get(mswPath(contractRoutes.getAnalysis.path), () => HttpResponse.json(body), {
      once: true,
    }),
  );

describe('AnalysisPage (task 12)', () => {
  it('shows the four contract stages with the running one current', async () => {
    server.use(
      http.get(mswPath(contractRoutes.getAnalysis.path), () =>
        HttpResponse.json({ status: 'running', stage: 'checking_evidence' }),
      ),
    );
    await openAnalysis();
    // Before the first response the first stage is current; wait for the running stage.
    await waitFor(() =>
      expect(screen.getByText('Checking evidence').closest('li')).toHaveAttribute(
        'aria-current',
        'step',
      ),
    );
    const progress = screen.getByRole('region', { name: /Analyzing your resume/ });
    const items = within(progress)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      'Reading resume (done)',
      'Mapping competencies (done)',
      'Checking evidence',
      'Drafting recommendations',
    ]);
  });

  it('shows a failed analysis with Retry that resubmits the setup draft', async () => {
    const started: unknown[] = [];
    server.use(
      http.post(mswPath(contractRoutes.startAnalysis.path), async ({ request }) => {
        started.push(await request.clone().json());
      }),
    );
    analysisOnce({ status: 'failed', errorCode: 'MODEL_OUTPUT_INVALID' });
    const { sessionId } = await openAnalysis();
    saveSetupDraft({
      sessionId,
      resumeMode: 'paste',
      resumeText: DEMO_RESUME_TEXT,
      file: null,
      job: DEMO_JOB,
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The analysis failed');
    expect(alert).toHaveTextContent('The AI response could not be verified');
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(started).toHaveLength(1));
    expect(await screen.findByRole('heading', { name: 'Your analysis' })).toBeInTheDocument();
  });

  it('renders the ready workspace', async () => {
    await openAnalysis();
    expect(await screen.findByRole('heading', { name: 'Your analysis' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Competencies/ })).toBeInTheDocument();
  });
});

describe('AnalysisWorkspace', () => {
  it('renders all four strengths as icon + text badges and all three importances', async () => {
    const [first, ...rest] = DEMO_EVIDENCE_MAP.competencies;
    const map: EvidenceMap = {
      ...DEMO_EVIDENCE_MAP,
      competencies: [...rest, { ...first!, importance: 'contextual' }],
    };
    render(<AnalysisWorkspace evidenceMap={map} onStartInterview={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: /Competencies/ }));

    for (const title of ['Required', 'Preferred', 'Contextual']) {
      expect(screen.getByRole('heading', { name: title, level: 2 })).toBeInTheDocument();
    }
    for (const label of ['Strong evidence', 'Moderate evidence', 'Weak evidence', 'No evidence']) {
      const badge = screen.getAllByText(label)[0]!.closest('[data-status]');
      expect(badge?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
