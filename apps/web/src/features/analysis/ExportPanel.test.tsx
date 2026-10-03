import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_RESUME_TEXT } from '@proof-and-poise/shared';
import { downloadBlob } from '../../lib/download';
import { ExportPanel } from './ExportPanel';
import { renderDocx } from './export/renderDocx';
import { loadPdfFonts, renderPdf } from './export/renderPdf';

vi.mock('./export/renderDocx', () => ({ renderDocx: vi.fn() }));
vi.mock('./export/renderPdf', () => ({ renderPdf: vi.fn(), loadPdfFonts: vi.fn() }));
vi.mock('../../lib/download', () => ({ downloadBlob: vi.fn() }));

const blob = new Blob(['x']);

beforeEach(() => {
  vi.mocked(renderDocx).mockResolvedValue(blob);
  vi.mocked(renderPdf).mockResolvedValue(blob);
  vi.mocked(loadPdfFonts).mockResolvedValue({
    regular: new Uint8Array(),
    bold: new Uint8Array(),
    italic: new Uint8Array(),
  });
});
afterEach(() => vi.clearAllMocks());

describe('ExportPanel (Req 7.10)', () => {
  it('offers two keyboard-selectable styles and previews the chosen one', async () => {
    const user = userEvent.setup();
    render(<ExportPanel text={DEMO_RESUME_TEXT} />);
    const group = screen.getByRole('group', { name: 'Style' });
    const original = within(group).getByRole('radio', { name: /Your original order/ });
    const jake = within(group).getByRole('radio', { name: /Jake's Resume style/ });
    expect(original).toBeChecked();
    expect(screen.getByRole('region', { name: 'Preview: Your original order' })).toHaveTextContent(
      'SKILLS',
    );

    original.focus();
    await user.keyboard('{ArrowDown}');
    expect(jake).toBeChecked();
    const preview = screen.getByRole('region', { name: "Preview: Jake's Resume style" });
    expect(within(preview).getByText('Technical Skills')).toBeInTheDocument();
    expect(within(preview).getByText('Jun 2024 – Aug 2024')).toBeInTheDocument();
  });

  it('downloads a Jake PDF with a busy state and an announcement', async () => {
    const user = userEvent.setup();
    let resolve: (b: Blob) => void = () => {};
    vi.mocked(renderPdf).mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ExportPanel text={DEMO_RESUME_TEXT} />);
    await user.click(screen.getByRole('radio', { name: /Jake's Resume style/ }));
    await user.click(screen.getByRole('button', { name: 'Download .pdf' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Download .pdf' })).toHaveAttribute(
        'aria-busy',
        'true',
      ),
    );
    expect(screen.getByRole('button', { name: 'Download .docx' })).toBeDisabled();
    expect(screen.getByText('Creating your .pdf…')).toBeInTheDocument();

    resolve(blob);
    await screen.findByText('Downloaded amara-okonkwo-fictional-resume-jake.pdf.');
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'amara-okonkwo-fictional-resume-jake.pdf');
    expect(vi.mocked(renderPdf).mock.calls[0]?.[0].style).toBe('jake');
  });

  it('downloads an original-order DOCX', async () => {
    const user = userEvent.setup();
    render(<ExportPanel text={DEMO_RESUME_TEXT} />);
    await user.click(screen.getByRole('button', { name: 'Download .docx' }));
    await screen.findByText('Downloaded amara-okonkwo-fictional-resume-original.docx.');
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'amara-okonkwo-fictional-resume-original.docx');
  });

  it('shows a recoverable error with Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(renderDocx).mockRejectedValueOnce(new Error('boom'));
    render(<ExportPanel text={DEMO_RESUME_TEXT} />);
    await user.click(screen.getByRole('button', { name: 'Download .docx' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't create the file");
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await screen.findByText('Downloaded amara-okonkwo-fictional-resume-original.docx.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(renderDocx).toHaveBeenCalledTimes(2);
  });
});
