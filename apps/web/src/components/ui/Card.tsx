import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, Ref } from 'react';
import { cn } from '../../lib/cn';

/**
 * Surface primitive. Three levels so a page has hierarchy instead of identical boxes:
 * `plain` for lists and details, `raised` for the one primary object on a screen,
 * `tinted` for guidance and next steps.
 */
export const cardVariants = cva('rounded-xl border', {
  variants: {
    tone: {
      plain: 'border-line-200 bg-paper-0 shadow-sm',
      raised: 'border-line-200 bg-paper-0 shadow-md',
      tinted: 'border-indigo-100 bg-indigo-50',
      success: 'border-emerald-100 bg-emerald-50',
      attention: 'border-amber-100 bg-amber-50',
      dark: 'border-ink-800 bg-ink-950 text-paper-0 shadow-lift',
    },
    padding: {
      none: '',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
    },
  },
  defaultVariants: { tone: 'plain', padding: 'md' },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  ref?: Ref<HTMLDivElement>;
}

export function Card({ tone, padding, className, ref, ...props }: CardProps) {
  return <div ref={ref} className={cn(cardVariants({ tone, padding }), className)} {...props} />;
}
