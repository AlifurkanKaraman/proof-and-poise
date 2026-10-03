import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  DEMO_JOB,
  DEMO_RESUME_INPUT,
  ERROR_STATUS,
  routes as contractRoutes,
  type ErrorCode,
} from '@proof-and-poise/shared';
import { Providers } from '../../app/providers';
import { routes } from '../../app/routes';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/session';
import { errorResponse, mswPath } from '../../mocks/handlers';
import { createMockServer } from '../../mocks/node';
import { scoreToast } from './scoreToast';

const { server } = createMockServer({ analysisMs: 1 });
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

async function openRecommendations() {
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
  await userEvent.click(await screen.findByRole('tab', { name: /Recommendations/ }));
}

const card = (name: string) => screen.getByRole('article', { name: `Recommendation for ${name}` });

/** What browser page translation does: replace each text node with a <font> element. */
function translateTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (!node.nodeValue?.trim() || node.parentElement?.closest('textarea')) continue;
    const font = document.createElement('font');
    font.textContent = node.nodeValue;
    node.replaceWith(font);
  }
}

const failOnce = (path: string, code: ErrorCode) =>
  server.use(
    http.post(
      mswPath(path),
      () => HttpResponse.json({ error: { code, message: 'x' } }, { status: ERROR_STATUS[code] }),
      { once: true },
    ),
  );

describe('recommendation decisions (Req 7.5)', () => {
  it('accepts, shows a score toast with the reason, and undoes', async () => {
    await openRecommendations();
    await userEvent.click(within(card('CI/CD pipelines')).getByRole('button', { name: 'Accept' }));

    expect(await within(card('CI/CD pipelines')).findByText('Accepted')).toBeInTheDocument();
    // The mock reports either the score delta with its reason or "no change".
    expect(
      await screen.findByText(/You accepted a suggested change\.|Your scores did not change\./),
    ).toBeInTheDocument();

    await userEvent.click(within(card('CI/CD pipelines')).getByRole('button', { name: 'Undo' }));
    expect(
      await within(card('CI/CD pipelines')).findByRole('button', { name: 'Accept' }),
    ).toBeEnabled();
  });

  it('rolls back on error and retries', async () => {
    failOnce(contractRoutes.decideRecommendation.path, 'INTERNAL');
    await openRecommendations();
    await userEvent.click(within(card('REST API design')).getByRole('button', { name: 'Reject' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't save your decision");
    expect(alert).toHaveTextContent('Your previous choice was restored.');
    // Rolled back to pending.
    expect(within(card('REST API design')).getByRole('button', { name: 'Reject' })).toBeEnabled();

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await within(card('REST API design')).findByText('Rejected')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

describe('confirmation dialog (Req 8.1)', () => {
  const statement = 'I containerized three services with Docker and ran them on a k3s cluster.';

  async function openDialog(beforeOpen?: () => void) {
    await openRecommendations();
    beforeOpen?.();
    await userEvent.click(
      within(card('Kubernetes and containers')).getByRole('button', {
        name: 'I have this experience',
      }),
    );
    return screen.findByRole('dialog', { name: /Kubernetes and containers/ });
  }

  it('validates with ARIA-linked errors, then saves and updates the card', async () => {
    const dialog = await openDialog(() => {
      // Missing evidence offers no Accept (Req 7.4); practice is labeled Coming soon.
      const missing = card('Kubernetes and containers');
      expect(within(missing).queryByRole('button', { name: 'Accept' })).toBeNull();
      expect(within(missing).getByRole('button', { name: /Coming soon/ })).toBeDisabled();
    });

    await userEvent.type(within(dialog).getByLabelText(/Your experience/), 'Too short');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save confirmation' }));
    const textarea = within(dialog).getByLabelText(/Your experience/);
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription(/Write between 30 and 500 characters/);
    const checkbox = within(dialog).getByRole('checkbox', {
      name: 'This describes my real experience.',
    });
    expect(checkbox).toHaveAccessibleDescription(/Confirm that this describes/);

    await userEvent.clear(textarea);
    await userEvent.type(textarea, statement);
    await userEvent.click(checkbox);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save confirmation' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      await screen.findByText(/You confirmed Kubernetes and containers experience\./),
    ).toBeInTheDocument();
    // Demo sessions get no rewrite, like the API: the card stays missing evidence with no
    // Accept, now marked as confirmed (Req 7.4, 13.2).
    const updated = card('Kubernetes and containers');
    expect(within(updated).getAllByText('Confirmed by you').length).toBeGreaterThan(0);
    expect(within(updated).queryByRole('button', { name: 'Accept' })).toBeNull();
  });

  it('a not-eligible rejection offers Close, not Retry', async () => {
    server.use(
      http.post(
        mswPath(contractRoutes.createConfirmation.path),
        () => errorResponse('VALIDATION', 'x', { competencyId: 'not_eligible' }),
        { once: true },
      ),
    );
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/Your experience/), statement);
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save confirmation' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent("Your resume already shows evidence for this, so there's");
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Save confirmation' })).toBeDisabled();
    await userEvent.click(within(alert).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the quota error with a recovery action', async () => {
    failOnce(contractRoutes.createConfirmation.path, 'QUOTA_EXCEEDED');
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/Your experience/), statement);
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save confirmation' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Confirmation limit reached');
    await userEvent.click(within(alert).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Tailor tab confirmation (design §7.6, Req 8.1)', () => {
  const statement = 'I containerized three services with Docker and ran them on a k3s cluster.';

  async function openTailor() {
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
    await userEvent.click(await screen.findByRole('tab', { name: 'Tailor resume' }));
    return screen.getByRole('heading', { name: /keywords your resume doesn't show/i })
      .parentElement!;
  }

  const row = (gaps: HTMLElement, term: string) =>
    within(gaps).getByText(term, { selector: 'span' }).closest('li')!;

  const jobMatch = () => {
    const dd = screen.getByText('Job match', { selector: 'dt' }).nextElementSibling!;
    const m = /\((\d+) at analysis, (\d+) now\)/.exec(dd.textContent ?? '');
    return { atAnalysis: Number(m?.[1]), now: Number(m?.[2]) };
  };

  it('confirms once, without an error, and shows the keyword as confirmed', async () => {
    let posts = 0;
    const count = ({ request }: { request: Request }) => {
      if (request.method === 'POST' && request.url.endsWith('/confirmations')) posts++;
    };
    server.events.on('request:start', count);
    try {
      const gaps = await openTailor();
      await userEvent.click(screen.getByRole('button', { name: 'Add REST APIs to Skills' }));
      const before = jobMatch();

      await userEvent.click(
        within(row(gaps, 'Kubernetes')).getByRole('button', { name: 'I have this experience' }),
      );
      const dialog = await screen.findByRole('dialog', { name: /Kubernetes and containers/ });
      await userEvent.type(within(dialog).getByLabelText(/Your experience/), statement);
      await userEvent.click(within(dialog).getByRole('checkbox'));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save confirmation' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(
        await screen.findByText('You confirmed Kubernetes and containers experience.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(posts).toBe(1);

      const k8s = row(gaps, 'Kubernetes');
      expect(within(k8s).getByText('Confirmed by you')).toBeInTheDocument();
      expect(within(k8s).queryByText('Gap: prepare to discuss it')).toBeNull();
      expect(within(k8s).queryByRole('button', { name: 'I have this experience' })).toBeNull();
      const after = jobMatch();
      expect(after.atAnalysis).toBe(before.atAnalysis);
      expect(after.now).toBeGreaterThan(before.now);
      // The added skill survives the confirmation.
      expect(screen.getByRole('button', { name: 'Remove REST APIs from Skills' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    } finally {
      server.events.removeListener('request:start', count);
    }
  });

  // Regression (Req 8.1, 8.3): a standard session gets a confirmed_by_candidate rewrite back,
  // like the API, and the screen keeps rendering even when the page has been translated.
  it('keeps the screen after a confirmation on a translated page', async () => {
    const created = await api.request('createSession', { body: { mode: 'standard' } });
    saveSession(created);
    await api.request('startAnalysis', {
      params: { sessionId: created.sessionId },
      body: { resume: DEMO_RESUME_INPUT, job: DEMO_JOB },
    });
    const router = createMemoryRouter(routes, {
      initialEntries: [`/s/${created.sessionId}/analysis`],
    });
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    );
    await userEvent.click(await screen.findByRole('tab', { name: 'Tailor resume' }));
    const gaps = screen.getByRole('heading', {
      name: /keywords your resume doesn't show/i,
    }).parentElement!;
    await userEvent.click(screen.getByRole('button', { name: 'Add REST APIs to Skills' }));

    await userEvent.click(
      within(row(gaps, 'Kubernetes')).getByRole('button', { name: 'I have this experience' }),
    );
    const dialog = await screen.findByRole('dialog', { name: /Kubernetes and containers/ });
    // Naming the keyword moves it out of "doesn't show" while the dialog is still open.
    await userEvent.type(
      within(dialog).getByLabelText(/Your experience/),
      'I deployed three Docker services to a Kubernetes cluster with Helm charts.',
    );
    await userEvent.click(within(dialog).getByRole('checkbox'));
    // Browser page translation (e.g. Chrome's) swaps text nodes for <font> elements. React
    // then inserted the Save button's spinner before a detached text node and threw
    // NotFoundError, so the route error boundary replaced the screen.
    translateTextNodes(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save confirmation' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      await screen.findByText('You confirmed Kubernetes and containers experience.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('This screen failed to load')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tailor your resume for this job' })).toBeVisible();

    // The rewrite is offered as a change to accept, and the screen survives every tab.
    await userEvent.click(screen.getByRole('tab', { name: /Recommendations/ }));
    const rewrite = card('Kubernetes and containers');
    expect(within(rewrite).getByRole('button', { name: 'Accept' })).toBeEnabled();
    await userEvent.click(within(rewrite).getByRole('button', { name: 'Accept' }));
    expect(await within(card('Kubernetes and containers')).findByText('Accepted')).toBeVisible();
    for (const name of [/Competencies/, /Keywords/, 'Resume', 'Tailor resume', 'Overview']) {
      await userEvent.click(screen.getByRole('tab', { name }));
      expect(screen.queryByText('This screen failed to load')).toBeNull();
    }
  });

  it("doesn't offer a confirmation the API would reject", async () => {
    const gaps = await openTailor();
    // c4 "CI/CD pipelines" is moderate, so the API rejects it as not eligible.
    const cicd = row(gaps, 'CI/CD');
    expect(within(cicd).queryByRole('button', { name: 'I have this experience' })).toBeNull();
    expect(within(cicd).getByText('Gap: prepare to discuss it')).toBeInTheDocument();
  });
});

describe('scoreToast', () => {
  it('shows the metric change and its reason', () => {
    expect(
      scoreToast(
        {
          id: 'ev1',
          metric: 'jobMatch',
          before: 62,
          after: 66,
          reason: 'You confirmed Kubernetes experience.',
          sourceRef: 'confirmation:c8',
          at: '2026-09-27T00:00:00.000Z',
        },
        'Saved',
      ),
    ).toEqual({
      title: 'Job match: 62 → 66',
      description: 'You confirmed Kubernetes experience.',
      tone: 'success',
    });
    expect(scoreToast(null, 'Change rejected')).toMatchObject({
      title: 'Change rejected',
      description: 'Your scores did not change.',
    });
  });
});
