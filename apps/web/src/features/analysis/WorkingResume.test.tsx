import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_EVIDENCE_MAP, DEMO_RESUME_TEXT, type Recommendation } from '@proof-and-poise/shared';
import { RouteErrorBoundary } from '../../app/RouteErrorBoundary';
import { AnalysisWorkspace } from './AnalysisWorkspace';
import { changedLines, WorkingResume } from './WorkingResume';
import { renderDocx } from './export/renderDocx';
import { loadPdfFonts, renderPdf } from './export/renderPdf';

// The real renderers are heavy (docx, pdf-lib, fonts); the real downloadBlob still runs.
vi.mock('./export/renderDocx', () => ({ renderDocx: vi.fn() }));
vi.mock('./export/renderPdf', () => ({ renderPdf: vi.fn(), loadPdfFonts: vi.fn() }));

const RESUME = ['Jordan Doe', 'Built a dashboard for the team', 'Wrote tests'].join('\n');

const rec = (over: Partial<Recommendation>): Recommendation => ({
  ...DEMO_EVIDENCE_MAP.recommendations.find((r) => r.trustLabel !== 'missing_evidence')!,
  id: 'r1',
  originalText: 'Built a dashboard for the team',
  proposedText: 'Built a React dashboard used daily by 12 analysts',
  decision: 'accepted',
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('WorkingResume (Req 7.7)', () => {
  it('applies an accepted change and labels the changed line with text, not color alone', () => {
    render(<WorkingResume resumeText={RESUME} recommendations={[rec({})]} />);
    const list = screen.getByRole('list', { name: 'Tailored resume lines' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent('Changed line:');
    expect(items[1]).toHaveTextContent('Built a React dashboard used daily by 12 analysts');
    expect(within(items[1]!).getByText('Changed')).toBeInTheDocument();
    expect(items[0]).not.toHaveTextContent('Changed');
    expect(screen.queryByText('Built a dashboard for the team')).not.toBeInTheDocument();
  });

  it('leaves pending and rejected changes out', () => {
    render(
      <WorkingResume
        resumeText={RESUME}
        recommendations={[rec({ decision: 'pending' }), rec({ id: 'r2', decision: 'rejected' })]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Tailored resume lines' });
    expect(within(list).getByText('Built a dashboard for the team')).toBeInTheDocument();
    expect(screen.queryByText('Changed')).not.toBeInTheDocument();
    expect(screen.getByText(/Accepted changes and added skills appear here/)).toBeInTheDocument();
  });

  it('is reachable as a Resume tab in the workspace', async () => {
    render(
      <AnalysisWorkspace
        evidenceMap={{ ...DEMO_EVIDENCE_MAP, recommendations: [rec({})] }}
        resumeText={RESUME}
        onStartInterview={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Resume' }));
    expect(screen.getByRole('heading', { name: 'Tailored resume' })).toBeInTheDocument();
    expect(screen.getByText('Changed line:')).toBeInTheDocument();
  });

  it('exports the same text the tab shows, added skills included (Req 7.10)', () => {
    render(
      <WorkingResume
        resumeText={RESUME}
        recommendations={[rec({})]}
        skillAdditions={['Kubernetes']}
      />,
    );
    const preview = screen.getByRole('region', { name: /^Preview:/ });
    expect(preview).toHaveTextContent('Built a React dashboard used daily by 12 analysts');
    expect(preview).toHaveTextContent('Additional skills: Kubernetes');
    expect(screen.getByRole('button', { name: 'Download .pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download .docx' })).toBeInTheDocument();
    // DOCX/PDF replace the old plain-text copy and .txt download.
    expect(screen.queryByRole('button', { name: /copy as text|download \.txt/i })).toBeNull();
  });

  it('marks only lines that differ', () => {
    expect(changedLines('a\nb\nb', 'a\nB\nb')).toEqual([false, true, false]);
  });
});

describe('AnalysisWorkspace empty states', () => {
  it('shows empty states when there are no competencies or keywords', async () => {
    render(
      <AnalysisWorkspace
        evidenceMap={{ ...DEMO_EVIDENCE_MAP, competencies: [], keywords: [], recommendations: [] }}
        onStartInterview={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: /Competencies/ }));
    expect(screen.getByRole('heading', { name: 'No competencies found' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Keywords/ }));
    expect(screen.getByRole('heading', { name: 'No keywords found' })).toBeInTheDocument();
  });
});

describe('Resume tab downloads keep the screen rendered (Req 7.10, 14.2)', () => {
  const blob = new Blob(['x']);
  const formats = ['docx', 'pdf'] as const;
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let anchorParents: (ParentNode | null)[];

  beforeEach(() => {
    // jsdom has no object URLs; stub them so the real downloadBlob can run.
    createObjectURL = vi.fn(() => 'blob:resume');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    anchorParents = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      anchorParents.push(this.parentNode);
    });
    vi.mocked(renderDocx).mockReset().mockResolvedValue(blob);
    vi.mocked(renderPdf).mockReset().mockResolvedValue(blob);
    vi.mocked(loadPdfFonts).mockReset().mockResolvedValue({
      regular: new Uint8Array(),
      bold: new Uint8Array(),
      italic: new Uint8Array(),
    });
  });
  afterEach(() => {
    Object.assign(URL, { createObjectURL: original.create, revokeObjectURL: original.revoke });
  });

  async function renderResumeRoute() {
    const router = createMemoryRouter([
      {
        path: '/',
        ErrorBoundary: RouteErrorBoundary,
        element: (
          <AnalysisWorkspace
            evidenceMap={DEMO_EVIDENCE_MAP}
            resumeText={DEMO_RESUME_TEXT}
            onStartInterview={() => {}}
          />
        ),
      },
    ]);
    render(<RouterProvider router={router} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Resume' }));
  }

  function expectScreenRendered() {
    expect(screen.getByRole('heading', { name: 'Tailored resume' })).toBeInTheDocument();
    expect(screen.queryByText('This screen failed to load')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }

  /** Mimic a translator or extension that wraps page text in <font> (outside React). */
  function wrapTextNodes(root: Element) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      if (node.data.trim() === '' || node.parentElement?.tagName === 'FONT') continue;
      const font = document.createElement('font');
      node.replaceWith(font);
      font.append(node);
    }
  }

  it('each download button downloads through a revoked object URL and the tab stays rendered', async () => {
    await renderResumeRoute();
    for (const [i, ext] of formats.entries()) {
      await userEvent.click(screen.getByRole('button', { name: `Download .${ext}` }));
      await screen.findByText(`Downloaded amara-okonkwo-fictional-resume-original.${ext}.`);
      expect(createObjectURL).toHaveBeenCalledTimes(i + 1);
      expect(createObjectURL).toHaveBeenLastCalledWith(blob);
      expect(revokeObjectURL).toHaveBeenCalledTimes(i + 1);
      expect(revokeObjectURL).toHaveBeenLastCalledWith('blob:resume');
      expectScreenRendered();
    }
    // The temporary anchor lives on <body>, outside React's tree, and is removed again.
    expect(anchorParents).toEqual([document.body, document.body]);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('survives an extension that rewrites text nodes (insertBefore NotFoundError)', async () => {
    let release = () => {};
    const gated = () =>
      new Promise<Blob>((resolve) => {
        release = () => resolve(blob);
      });
    vi.mocked(renderDocx).mockImplementation(gated);
    vi.mocked(renderPdf).mockImplementation(gated);
    await renderResumeRoute();
    const panel = () => screen.getByRole('region', { name: 'Download a formatted resume' });

    for (const [style, slug] of [
      [/Your original order/, 'original'],
      [/Jake's Resume style/, 'jake'],
    ] as const) {
      await userEvent.click(screen.getByRole('radio', { name: style }));
      wrapTextNodes(panel());
      for (const ext of formats) {
        const renderer = ext === 'docx' ? renderDocx : renderPdf;
        const calls = vi.mocked(renderer).mock.calls.length;
        await userEvent.click(screen.getByRole('button', { name: `Download .${ext}` }));
        await screen.findByText(`Creating your .${ext}…`);
        wrapTextNodes(panel());
        await vi.waitFor(() => expect(renderer).toHaveBeenCalledTimes(calls + 1));
        release();
        await screen.findByText(`Downloaded amara-okonkwo-fictional-resume-${slug}.${ext}.`);
        expectScreenRendered();
      }
    }
    expect(revokeObjectURL).toHaveBeenCalledTimes(createObjectURL.mock.calls.length);
  });
});
