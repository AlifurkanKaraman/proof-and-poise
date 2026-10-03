import { Circle, CircleCheck, CircleDot, FileDown, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  exportFileName,
  exportLayoutFor,
  verifyExportLayout,
  type ExportLayout,
  type ExportStyle,
} from '@proof-and-poise/shared';
import { ErrorState } from '../../components/states/ErrorState';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { downloadBlob } from '../../lib/download';
import { ExportPreview } from './ExportPreview';

type Format = 'docx' | 'pdf';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; format: Format }
  | { kind: 'done'; file: string }
  | { kind: 'error'; format: Format };

const STYLES: { value: ExportStyle; title: string; description: string }[] = [
  {
    value: 'original',
    title: 'Your original order',
    description: 'your sections, order and wording in a clean layout.',
  },
  {
    value: 'jake',
    title: "Jake's Resume style",
    description: 'one column with Education, Experience, Projects, Technical Skills.',
  },
];

async function render(format: Format, layout: ExportLayout) {
  // Loaded on click only, so docx, pdf-lib and the fonts stay out of the main bundle.
  if (format === 'docx') {
    const { renderDocx } = await import('./export/renderDocx');
    return renderDocx(layout);
  }
  const { renderPdf, loadPdfFonts } = await import('./export/renderPdf');
  return renderPdf(layout, await loadPdfFonts());
}

/**
 * Download the tailored resume as DOCX or PDF in two styles (Req 7.10, design §7.7). Runs
 * entirely in the browser; the layout is checked for truthfulness before any file is made.
 */
export function ExportPanel({ text }: { text: string }) {
  const [style, setStyle] = useState<ExportStyle>('original');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const layout = useMemo(() => exportLayoutFor(text, style), [text, style]);
  const styleTitle = STYLES.find((s) => s.value === style)?.title ?? '';

  const generate = async (format: Format) => {
    setStatus({ kind: 'busy', format });
    try {
      // Req 7.10: refuse to export anything that adds, drops or rewords a line.
      if (verifyExportLayout(text, layout).length > 0) throw new Error('Export check failed');
      const blob = await render(format, layout);
      const file = exportFileName(layout.name, style, format);
      downloadBlob(blob, file);
      setStatus({ kind: 'done', file });
    } catch {
      setStatus({ kind: 'error', format });
    }
  };

  const busy = status.kind === 'busy' ? status.format : null;

  return (
    <section
      aria-labelledby="export-heading"
      className="flex flex-col gap-3 rounded-lg border border-line-200 bg-paper-0 p-4"
    >
      <h3 id="export-heading" className="text-h4 font-semibold text-ink-950">
        Download a formatted resume
      </h3>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-small font-semibold text-ink-950">Style</legend>
        {STYLES.map((s) => {
          const checked = style === s.value;
          const Icon = checked ? CircleDot : Circle;
          return (
            <label
              key={s.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-small text-ink-950',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600',
                checked ? 'border-indigo-600 bg-indigo-50' : 'border-line-300 bg-paper-0',
              )}
            >
              <input
                type="radio"
                name="export-style"
                value={s.value}
                checked={checked}
                onChange={() => {
                  setStyle(s.value);
                  setStatus({ kind: 'idle' });
                }}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-5 shrink-0 text-indigo-600" />
              <span>
                <span className="font-semibold">{s.title}:</span> {s.description}
              </span>
            </label>
          );
        })}
      </fieldset>

      <p className="text-small text-ink-700">
        We only keep your resume's text (an uploaded PDF is deleted within a day), so this can't
        copy your PDF's design.
      </p>

      <ExportPreview layout={layout} label={`Preview: ${styleTitle}`} />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={busy === 'docx'}
          disabled={busy !== null}
          onClick={() => void generate('docx')}
        >
          {busy !== 'docx' && <FileText aria-hidden="true" className="size-4" />}
          Download .docx
        </Button>
        <Button
          variant="secondary"
          loading={busy === 'pdf'}
          disabled={busy !== null}
          onClick={() => void generate('pdf')}
        >
          {busy !== 'pdf' && <FileDown aria-hidden="true" className="size-4" />}
          Download .pdf
        </Button>
      </div>

      <p aria-live="polite" className="flex min-h-5 items-center gap-2 text-small text-ink-700">
        {status.kind === 'busy' && `Creating your .${status.format}…`}
        {status.kind === 'done' && (
          <>
            <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
            {`Downloaded ${status.file}.`}
          </>
        )}
      </p>

      {status.kind === 'error' && (
        <ErrorState
          title="Couldn't create the file"
          message="Nothing left your browser. Try again, or use Download .txt."
          action={<Button onClick={() => void generate(status.format)}>Retry</Button>}
        />
      )}
    </section>
  );
}
