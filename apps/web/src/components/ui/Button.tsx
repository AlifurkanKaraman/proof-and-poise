import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn, focusRing } from '../../lib/cn';
import { Spinner } from './Spinner';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none',
    'transition-colors duration-micro ease-standard',
    'disabled:cursor-not-allowed disabled:opacity-60',
    focusRing,
  ],
  {
    variants: {
      variant: {
        primary: 'rounded-md bg-indigo-600 text-paper-0 shadow-xs hover:bg-indigo-700',
        secondary:
          'rounded-md border border-line-200 bg-paper-0 text-ink-950 shadow-xs hover:bg-paper-50',
        ghost: 'rounded-md text-ink-950 hover:bg-indigo-50',
        destructive: 'rounded-md bg-red-700 text-paper-0 shadow-xs hover:bg-red-700/90',
        link: 'rounded-sm text-indigo-700 underline underline-offset-4 hover:text-indigo-600',
      },
      size: {
        // min-h-11 keeps a 44px touch target on every size (Req 14.6).
        sm: 'min-h-11 px-3 text-small sm:min-h-9',
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
      {children}
    </button>
  );
}
