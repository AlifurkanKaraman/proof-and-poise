import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

const iconTileVariants = cva('inline-flex shrink-0 items-center justify-center', {
  variants: {
    tone: {
      indigo: 'bg-indigo-100 text-indigo-700',
      emerald: 'bg-emerald-100 text-emerald-700',
      amber: 'bg-amber-100 text-amber-700',
      red: 'bg-red-100 text-red-700',
      ink: 'bg-ink-100 text-ink-700',
      dark: 'bg-ink-800 text-paper-0',
    },
    size: {
      sm: 'size-8 rounded-md [&>svg]:size-4',
      md: 'size-10 rounded-lg [&>svg]:size-5',
      lg: 'size-12 rounded-xl [&>svg]:size-6',
    },
  },
  defaultVariants: { tone: 'indigo', size: 'md' },
});

export interface IconTileProps extends VariantProps<typeof iconTileVariants> {
  icon: LucideIcon;
  className?: string;
}

/** Decorative icon in a tinted tile. Always `aria-hidden`: meaning is carried by adjacent text. */
export function IconTile({ icon: Icon, tone, size, className }: IconTileProps) {
  return (
    <span className={cn(iconTileVariants({ tone, size }), className)} aria-hidden="true">
      <Icon strokeWidth={1.75} />
    </span>
  );
}
