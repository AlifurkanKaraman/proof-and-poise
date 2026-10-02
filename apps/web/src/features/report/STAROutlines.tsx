import { Check, Copy, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import type { StarOutline } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { IconTile } from '../../components/ui/IconTile';
import { cn } from '../../lib/cn';

interface STAROutlinesProps {
  outlines: StarOutline[];
  className?: string;
}

const PARTS = [
  { key: 'situation', letter: 'S', label: 'Situation' },
  { key: 'task', letter: 'T', label: 'Task' },
  { key: 'action', letter: 'A', label: 'Action' },
  { key: 'result', letter: 'R', label: 'Result' },
] as const;

function asText(outline: StarOutline): string {
  return [outline.title, ...PARTS.map((p) => `${p.label}: ${outline[p.key]}`)].join('\n');
}

/** Copies the outline as plain text. Falls back to a visible hint if the browser blocks it. */
function CopyButton({ outline }: { outline: StarOutline }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(outline));
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2500);
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => void copy()}
        aria-label={`Copy outline: ${outline.title}`}
      >
        {state === 'copied' ? (
          <Check className="size-4 text-emerald-700" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {state === 'copied' ? 'Copied' : 'Copy'}
      </Button>
      <span role="status" className="text-caption text-ink-700">
        {state === 'copied' && 'Outline copied to your clipboard.'}
        {state === 'failed' && 'Could not copy. Select the text instead.'}
      </span>
    </div>
  );
}

/**
 * 2-3 suggested STAR story outlines built from existing evidence (Req 12.1).
 * No invented details - only facts from resume, confirmations, or answers.
 */
export function STAROutlines({ outlines, className }: STAROutlinesProps) {
  if (outlines.length === 0) return null;

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-3">
        <IconTile icon={Lightbulb} tone="indigo" />
        <div>
          <h2 className="font-heading text-h3 font-semibold text-ink-950">STAR Story Outlines</h2>
          <p className="text-small text-ink-700">
            Built only from your real experience. Use them to structure your answers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {outlines.map((outline, idx) => (
          <Card key={`${outline.competencyId}-${idx}`} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-h4 font-semibold text-ink-950">{outline.title}</h3>
              <CopyButton outline={outline} />
            </div>

            <dl className="flex flex-col gap-3">
              {PARTS.map((p) => (
                <div key={p.key} className="flex items-start gap-3">
                  <dt className="flex size-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-small font-bold text-indigo-700">
                    <span aria-hidden="true">{p.letter}</span>
                    <span className="sr-only">{p.label}</span>
                  </dt>
                  <dd className="text-small text-ink-950">{outline[p.key]}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </section>
  );
}
