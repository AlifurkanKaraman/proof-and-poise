import { CircleAlert, FileCheck2, FileUp, Upload } from 'lucide-react';
import { useId, useState, type DragEvent, type Ref } from 'react';
import { LIMITS } from '@proof-and-poise/shared';
import { Button, buttonVariants } from '../../components/ui/Button';
import { describedBy } from '../../components/ui/Field';
import { IconTile } from '../../components/ui/IconTile';
import { cn } from '../../lib/cn';
import { formatBytes } from './setupForm';

export interface ResumeDropzoneProps {
  file: File | null;
  error: string | null;
  /** Called with the chosen or dropped file; validation happens in the parent. */
  onFile: (file: File) => void;
  onRemove: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * PDF picker with drag and drop (Req 3.2–3.3). The native file input stays in the tab
 * order (visually hidden) so keyboard and screen reader users get the platform picker;
 * its label is styled as the button and shows the focus ring.
 */
export function ResumeDropzone({ file, error, onFile, onRemove, inputRef }: ResumeDropzoneProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-micro',
          dragging
            ? 'border-indigo-600 bg-indigo-50'
            : error
              ? 'border-red-700 bg-red-50'
              : file
                ? 'border-emerald-700 border-solid bg-emerald-50'
                : 'border-line-300 bg-paper-50',
        )}
      >
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <IconTile icon={FileCheck2} tone="emerald" size="lg" />
            <p className="text-body font-semibold break-all text-ink-950">{file.name}</p>
            <p className="text-small text-ink-700">{formatBytes(file.size)} · PDF selected</p>
            <Button variant="secondary" size="sm" onClick={onRemove}>
              Remove file
            </Button>
          </div>
        ) : (
          <>
            <IconTile icon={dragging ? FileUp : Upload} tone={error ? 'red' : 'indigo'} size="lg" />
            <p id={hintId} className="text-small text-ink-700">
              <span className="block text-body font-semibold text-ink-950">
                {dragging ? 'Drop your PDF to upload it' : 'Drag and drop your PDF here'}
              </span>
              or choose a file from your device.
            </p>
            <input
              ref={inputRef}
              id={id}
              type="file"
              accept={`${LIMITS.resumeUpload.contentType},.pdf`}
              className="peer sr-only"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(hintId, error !== null && errorId)}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen) onFile(chosen);
                // Allow choosing the same file again after an error.
                e.target.value = '';
              }}
            />
            <label
              htmlFor={id}
              className={cn(
                buttonVariants({ variant: 'secondary' }),
                'cursor-pointer',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600',
              )}
            >
              Choose PDF file
            </label>
          </>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-small text-red-700">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
