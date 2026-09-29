import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  AnalysisRequestSchema,
  DEMO_JOB,
  DEMO_RESUME_TEXT,
  routes as contractRoutes,
} from '@proof-and-poise/shared';
import { Providers } from '../../app/providers';
import { routes } from '../../app/routes';
import { setMockFault } from '../../mocks/controls';
import { MOCK_UPLOAD_URL } from '../../mocks/db';
import { mswPath } from '../../mocks/handlers';
import { createMockServer } from '../../mocks/node';
import { clearSetupDraft } from './setupForm';

const { server } = createMockServer({ analysisMs: 1 });
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setMockFault(null);
  sessionStorage.clear();
  clearSetupDraft();
});
afterAll(() => server.close());

/** Records startAnalysis bodies and upload POSTs, then lets the mock API answer. */
function spy() {
  const bodies: unknown[] = [];
  let uploads = 0;
  server.use(
    http.post(mswPath(contractRoutes.startAnalysis.path), async ({ request }) => {
      bodies.push(await request.clone().json());
    }),
    http.post(MOCK_UPLOAD_URL, () => {
      uploads++;
    }),
  );
  return { bodies, uploads: () => uploads };
}

function renderPrepare() {
  const router = createMemoryRouter(routes, { initialEntries: ['/prepare'] });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

const pdf = (content = '%PDF-1.4 fictional resume', name = 'resume.pdf') =>
  new File([content], name, { type: 'application/pdf' });

async function pasteResume(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('tab', { name: 'Paste text' }));
  await user.click(screen.getByLabelText(/Resume text/));
  await user.paste(DEMO_RESUME_TEXT);
}

async function fillJob(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByLabelText(/Job description/));
  await user.paste(DEMO_JOB.description);
  await user.type(screen.getByLabelText(/Target role/), DEMO_JOB.role);
}

const next = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
  user.click(screen.getByRole('button', { name }));

describe('PreparePage (task 11)', () => {
  it('submits a contract-valid body for pasted text and opens the analysis', async () => {
    const user = userEvent.setup();
    const { bodies } = spy();
    const router = renderPrepare();

    await pasteResume(user);
    await next(user, /Next: Target job/);
    await fillJob(user);
    await next(user, /Next: Review/);
    expect(await screen.findByText('Not provided')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start analysis' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/s\/.+\/analysis$/));
    expect(bodies).toHaveLength(1);
    const body = AnalysisRequestSchema.parse(bodies[0]);
    expect(body.resume).toEqual({ kind: 'text', text: DEMO_RESUME_TEXT.trim() });
    expect(body.job).toMatchObject({
      role: DEMO_JOB.role,
      description: DEMO_JOB.description.trim(),
      interviewType: 'behavioral_mixed',
    });
  });

  it('uploads a PDF through the presigned POST and starts with the upload key', async () => {
    const user = userEvent.setup();
    const recorded = spy();
    const router = renderPrepare();

    await user.upload(await screen.findByLabelText('Choose PDF file'), pdf());
    expect(screen.getByText('resume.pdf')).toBeInTheDocument();
    await next(user, /Next: Target job/);
    await fillJob(user);
    await user.click(screen.getByRole('radio', { name: /Technical and behavioral/ }));
    await next(user, /Next: Review/);
    await user.click(screen.getByRole('button', { name: 'Start analysis' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/analysis$/));
    expect(recorded.uploads()).toBe(1);
    const body = AnalysisRequestSchema.parse(recorded.bodies[0]);
    expect(body.resume).toMatchObject({ kind: 'upload', key: expect.stringMatching(/^resumes\//) });
    expect(body.job.interviewType).toBe('technical_mixed');
  });

  it('rejects non-PDF and empty files before upload with a linked error', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPrepare();
    const input = await screen.findByLabelText('Choose PDF file');

    await user.upload(input, new File(['hello'], 'resume.txt', { type: 'text/plain' }));
    const typeError = await screen.findByRole('alert');
    expect(typeError).toHaveTextContent('Only PDF files are accepted');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(typeError.id);

    await user.upload(input, pdf(''));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is empty');
  });

  it('shows field errors linked to their inputs and keeps values when going back', async () => {
    const user = userEvent.setup();
    renderPrepare();

    await pasteResume(user);
    await next(user, /Next: Target job/);
    await next(user, /Next: Review/);
    const role = screen.getByLabelText(/Target role/);
    await waitFor(() => expect(role).toHaveAttribute('aria-invalid', 'true'));
    expect(role.getAttribute('aria-describedby')).toContain(`${role.id}-error`);
    expect(screen.getByText('Enter the role you are applying for.')).toBeInTheDocument();

    await user.type(role, DEMO_JOB.role);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText(/Resume text/)).toHaveValue(DEMO_RESUME_TEXT);
    await next(user, /Next: Target job/);
    expect(await screen.findByLabelText(/Target role/)).toHaveValue(DEMO_JOB.role);
  });

  it('shows a recoverable error when starting fails and retries', async () => {
    const user = userEvent.setup();
    setMockFault({ kind: 'UPSTREAM_UNAVAILABLE', route: 'startAnalysis' });
    const router = renderPrepare();

    await pasteResume(user);
    await next(user, /Next: Target job/);
    await fillJob(user);
    await next(user, /Next: Review/);
    await user.click(screen.getByRole('button', { name: 'Start analysis' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't start the analysis");
    expect(alert).toHaveTextContent('temporarily unavailable');

    setMockFault(null);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/analysis$/));
  });

  it('after EXTRACTION_FAILED, "Paste text instead" returns to the paste tab with job values kept', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(mswPath(contractRoutes.getAnalysis.path), () =>
        HttpResponse.json({ status: 'failed', errorCode: 'EXTRACTION_FAILED' }),
      ),
    );
    const { bodies } = spy();
    const router = renderPrepare();

    await user.upload(await screen.findByLabelText('Choose PDF file'), pdf());
    await next(user, /Next: Target job/);
    await fillJob(user);
    await next(user, /Next: Review/);
    await user.click(screen.getByRole('button', { name: 'Start analysis' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't read your PDF");
    const sessionPath = router.state.location.pathname;
    await user.click(screen.getByRole('button', { name: 'Paste text instead' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/prepare'));
    expect(await screen.findByRole('tab', { name: 'Paste text' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByLabelText(/Resume text/));
    await user.paste(DEMO_RESUME_TEXT);
    await next(user, /Next: Target job/);
    expect(await screen.findByLabelText(/Target role/)).toHaveValue(DEMO_JOB.role);
    expect(screen.getByLabelText(/Job description/)).toHaveValue(DEMO_JOB.description);

    // The retry reuses the same session and sends the pasted text.
    await next(user, /Next: Review/);
    await user.click(screen.getByRole('button', { name: 'Start analysis' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(AnalysisRequestSchema.parse(bodies[1]).resume.kind).toBe('text');
    await waitFor(() => expect(router.state.location.pathname).toBe(sessionPath));
  });
});
