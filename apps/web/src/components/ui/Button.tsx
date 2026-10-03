import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn, focusRing } from '../../lib/cn';
import { Spinner } from './Spinner';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none',
    'transition-colors duration-micro ease-standard',
    'disabled:cursor-not-allowed disabled:opacity-60',
    focusRing,
  ],
  {
    variants: {
      variant: {
        primary: 'rounded-lg bg-indigo-600 text-paper-0 shadow-sm hover:bg-indigo-700',
        secondary:
          'rounded-lg border border-line-300 bg-paper-0 text-ink-950 shadow-xs hover:bg-ink-100',
        ghost: 'rounded-lg text-ink-950 hover:bg-ink-100',
        destructive: 'rounded-lg bg-red-700 text-paper-0 shadow-xs hover:bg-red-700/90',
        link: 'rounded-sm text-indigo-700 underline underline-offset-4 hover:text-indigo-600',
      },
      size: {
        // min-h-11 keeps a 44px touch target on every size (Req 14.6).
        sm: 'min-h-11 px-3 text-small',
        md: 'min-h-11 px-4 text-body',
        lg: 'min-h-12 px-6 text-body',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'min-h-0 px-0 sm:min-h-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
  /** Render the single child (e.g. a router Link) with button styles. */
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  asChild = false,
  disabled,
  children,
  type,
  ref,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {/* Req 8.1: React inserts the spinner before this element, never before a bare text
          node that page translation may have replaced, which threw and blanked the screen.
          `contents` keeps the children as flex items, so the layout doesn't change. */}
      <span className="contents">{children}</span>
    </button>
  );
}
