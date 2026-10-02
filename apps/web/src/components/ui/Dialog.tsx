import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn, focusRing } from '../../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  'title'
> {
  title: ReactNode;
  description?: ReactNode;
}

/** Modal with required title (announced), optional description, and a close button. */
export function DialogContent({
  title,
  description,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink-950/60" />
      <DialogPrimitive.Content
        {...(description === undefined ? { 'aria-describedby': undefined } : {})}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-line-200 bg-paper-0 p-6 shadow-md',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="font-heading text-h3 font-semibold text-ink-950">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className={cn(
              '-m-2 inline-flex size-11 items-center justify-center rounded-md text-ink-700 hover:bg-paper-50',
              focusRing,
            )}
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        {description !== undefined && (
          <DialogPrimitive.Description className="mt-2 text-small text-ink-700">
            {description}
          </DialogPrimitive.Description>
        )}
        <div className="mt-6">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
