import { DEMO_SAMPLE_ANSWERS, type DemoTurnLabel } from '@proof-and-poise/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Providers } from '../../app/providers';
import { routes } from '../../app/routes';
import { api } from '../../lib/api';
import { loadSession, saveSession } from '../../lib/session';
import { setMockFault } from '../../mocks/controls';
import { createMockServer } from '../../mocks/node';

// Task 20: report and practice wired to the contract routes through the MSW mock API
// (createReport/getReport/startPractice/deleteSession, design §8; Req 2.5, 12.1, 12.3).
const { server } = createMockServer();
const requests: string[] = [];
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  server.events.on('request:start', ({ request }) => {
    requests.push(
      `${request.method} ${new URL(request.url).pathname.replace(/^.*\/sessions\/[^/]+/, '')}`,
    );
  });
});
afterEach(() => {
  server.resetHandlers();
  setMockFault(null);
  sessionStorage.clear();
  requests.length = 0;
});
afterAll(() => server.close());

/** A demo session with every interview question answered (the report can be built). */
async function completedInterview(): Promise<string> {
  const created = await api.request('createSession', { body: { mode: 'demo' } });
  saveSession(created);
  const params = { sessionId: created.sessionId };
  const started = await api.request('startInterview', { params });
  let turn = started.turns[0] ?? null;
  while (turn) {
    const res = await api.request('submitAnswer', {
      params: { ...params, turnId: turn.id },
      body: {
        text: DEMO_SAMPLE_ANSWERS[turn.label as DemoTurnLabel],
        source: 'typed',
        edited: false,
      },
    });
    turn = res.next;
  }
  return created.sessionId;
}

function renderReport(sessionId: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/s/${sessionId}/report`] });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

const reportHeading = () =>
  screen.findByRole('heading', { level: 1, name: /your readiness report/i }, { timeout: 5_000 });

describe('ReportPage integration (task 20)', () => {
  it('creates the report when GET is 404, then shows it with the practice quota', async () => {
    const sessionId = await completedInterview();
    requests.length = 0;
    renderReport(sessionId);
    await reportHeading();
    expect(requests).toEqual(expect.arrayContaining(['GET /report', 'POST /report']));
    expect(requests.indexOf('GET /report')).toBeLessThan(requests.indexOf('POST /report'));
    expect(screen.getByText(/3 of 3 practice attempts left/i)).toBeInTheDocument();
  });

  it('offers Retry for a failed build and recovers', async () => {
    const sessionId = await completedInterview();
    setMockFault({ kind: 'MODEL_OUTPUT_INVALID', route: 'createReport' });
    renderReport(sessionId);
    expect(await screen.findByText(/report could not be generated/i)).toBeInTheDocument();
    setMockFault(null);
    await userEvent.click(screen.getByRole('button', { name: /^retry$/i }));
    await reportHeading();
  });

  it('does not offer Retry when the report quota is used up', async () => {
    const sessionId = await completedInterview();
    setMockFault({ kind: 'QUOTA_EXCEEDED', route: 'createReport' });
    const router = renderReport(sessionId);
    expect(await screen.findByText(/report limit reached/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^retry$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /start over/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('sends the candidate back to the interview when it is not finished (409)', async () => {
    const created = await api.request('createSession', { body: { mode: 'demo' } });
    saveSession(created);
    await api.request('startInterview', { params: { sessionId: created.sessionId } });
    const router = renderReport(created.sessionId);
    expect(await screen.findByText(/finish the interview first/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back to interview/i }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/s/${created.sessionId}/interview`),
    );
  });

  it('practice again → practice turn → answer → regenerated report (Req 12.3)', async () => {
    const sessionId = await completedInterview();
    const router = renderReport(sessionId);
    await reportHeading();

    await userEvent.click(screen.getByRole('button', { name: /Question 1/ }));
    await userEvent.click(screen.getByRole('button', { name: /practice this question again/i }));

    // The interview page starts the practice turn with { turnId } and drops the query param.
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(requests).toContain('POST /practice');
    await userEvent.click(await screen.findByRole('tab', { name: /type/i }));
    const box = screen.getByLabelText(/your answer/i);
    await userEvent.click(box);
    await userEvent.paste(DEMO_SAMPLE_ANSWERS['1a']);
    requests.length = 0;
    await userEvent.click(screen.getByRole('button', { name: /submit answer/i }));
    await userEvent.click(
      await screen.findByRole('button', { name: /view your report/i }, { timeout: 5_000 }),
    );

    // The stale report is refetched (404) and rebuilt, now listing the practice attempt.
    await reportHeading();
    expect(requests).toEqual(expect.arrayContaining(['GET /report', 'POST /report']));
    expect(screen.getByText(/2 of 3 practice attempts left/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Question 1/ }));
    expect(screen.getByText(/practice attempts$/i)).toBeInTheDocument();
  }, 20_000);

  it('delete my data clears the stored session and goes home (Req 2.5)', async () => {
    const sessionId = await completedInterview();
    const router = renderReport(sessionId);
    await reportHeading();
    await userEvent.click(screen.getByRole('button', { name: /delete my data/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /delete everything/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(loadSession()).toBeNull();
    expect(requests).toContain('DELETE ');
  });

  it('keeps the dialog open with an error when delete fails', async () => {
    const sessionId = await completedInterview();
    setMockFault({ kind: 'UPSTREAM_UNAVAILABLE', route: 'deleteSession' });
    const router = renderReport(sessionId);
    await reportHeading();
    await userEvent.click(screen.getByRole('button', { name: /delete my data/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /delete everything/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/not deleted/i);
    expect(router.state.location.pathname).toBe(`/s/${sessionId}/report`);
    expect(loadSession()).not.toBeNull();
  });
});
