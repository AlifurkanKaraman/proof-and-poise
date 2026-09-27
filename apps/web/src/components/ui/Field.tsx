import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, focusRing } from '../../lib/cn';

/** Shared control styles for Input and Textarea. */
export function controlClasses(invalid: boolean, className?: string) {
  return cn(
    'w-full rounded-md border bg-paper-0 px-3 py-2 text-body text-ink-950 shadow-xs',
    'placeholder:text-ink-700/70 disabled:cursor-not-allowed disabled:bg-paper-50 disabled:opacity-70',
    focusRing,
    invalid ? 'border-red-700' : 'border-line-200 hover:border-ink-700/40',
    className,
  );
}

/** Builds a space-separated aria-describedby value, or undefined if empty. */
export function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const value = ids.filter(Boolean).join(' ');
  return value.length > 0 ? value : undefined;
}

interface FieldShellProps {
  id: string;
  label: ReactNode;
  required?: boolean | undefined;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  footer?: ReactNode;
  children: ReactNode;
}

/** Label + control + hint + error. Error is linked via aria-describedby by the control. */
export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  footer,
  children,
}: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-small font-medium text-ink-950">
        {label}
        {required && (
          <span className="text-ink-700">
            <span aria-hidden="true"> *</span>
            <span className="sr-only"> (required)</span>
          </span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-small text-ink-700">
          {hint}
        </p>
      )}
      {children}
      <div className="flex items-start justify-between gap-4">
        {error ? (
          <p id={`${id}-error`} className="flex items-start gap-1 text-small text-red-700">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : (
          <span />
        )}
        {footer}
      </div>
    </div>
  );
}
