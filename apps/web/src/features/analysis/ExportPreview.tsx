import type { ReactNode } from 'react';
import type { ExportBlock, ExportLayout, ExportRun } from '@proof-and-poise/shared';
import { cn, focusRing } from '../../lib/cn';

interface ExportPreviewProps {
  layout: ExportLayout;
  /** Accessible name of the preview region, e.g. "Preview: Jake's Resume style". */
  label: string;
}

const t = (run: ExportRun) => run.text.replace(/\s+/g, ' ').trim();

/**
 * Small HTML preview of the export, drawn from the same layout model as the DOCX and PDF
 * renderers (design §7.7), so what the candidate sees is what they download.
 */
export function ExportPreview({ layout, label }: ExportPreviewProps) {
  const jake = layout.style === 'jake';
  const nodes: ReactNode[] = [];
  let bullets: ExportRun[] = [];
  const flush = (key: number) => {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={`ul-${key}`} className="list-disc pl-6">
        {bullets.map((r, i) => (
          <li key={i}>{t(r)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  layout.blocks.forEach((block: ExportBlock, i) => {
    if (block.kind === 'bullet') {
      bullets.push(block.run);
      return;
    }
    flush(i);
    switch (block.kind) {
      case 'name':
        nodes.push(
          <p key={i} className={cn('text-h4 font-semibold', jake && 'text-center text-h3')}>
            {t(block.run)}
          </p>,
        );
        break;
      case 'contact':
        nodes.push(
          <p key={i} className={cn('text-caption', jake && 'text-center')}>
            {block.items.map(t).join(' | ')}
          </p>,
        );
        break;
      case 'heading':
        nodes.push(
          <p
            key={i}
            className={cn(
              'mt-3 font-semibold',
              jake && 'border-b border-ink-950 uppercase tracking-wide',
            )}
          >
            {t(block.run)}
          </p>,
        );
        break;
      case 'entry':
        nodes.push(
          <div key={i} className="mt-1">
            <p className="flex flex-wrap justify-between gap-x-3">
              <strong>{t(block.title)}</strong>
              {block.right && <span>{t(block.right)}</span>}
            </p>
            {(block.subtitle || block.subtitleRight) && (
              <p className="flex flex-wrap justify-between gap-x-3 italic">
                <span>{block.subtitle && t(block.subtitle)}</span>
                {block.subtitleRight && <span>{t(block.subtitleRight)}</span>}
              </p>
            )}
          </div>,
        );
        break;
      case 'skill':
        nodes.push(
          <p key={i}>
            <strong>{t(block.label)}</strong> {t(block.items)}
          </p>,
        );
        break;
      case 'paragraph':
        nodes.push(<p key={i}>{t(block.run)}</p>);
        break;
    }
  });
  flush(layout.blocks.length);

  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        'max-h-96 overflow-auto rounded-lg border border-line-200 bg-paper-0 p-4 text-small text-ink-950',
        '[font-family:ui-serif,Georgia,serif]',
        focusRing,
      )}
    >
      {nodes}
    </div>
  );
}
