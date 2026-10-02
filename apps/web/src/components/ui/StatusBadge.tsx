import {
  BadgeCheck,
  CircleDashed,
  CircleOff,
  PenLine,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';

export type EvidenceStatus = 'verified' | 'confirmed' | 'weak' | 'missing' | 'rewording';

interface StatusConfig {
  label: string;
  Icon: LucideIcon;
  className: string;
}

/** Trust and strength states (design.md §9.3). Always icon + text, never color only (Req 14.3). */
export const statusConfig: Record<EvidenceStatus, StatusConfig> = {
  verified: {
    label: 'Verified',
    Icon: BadgeCheck,
    className: 'border-emerald-700/20 bg-emerald-50 text-emerald-700',
  },
  confirmed: {
    label: 'Confirmed by you',
    Icon: UserCheck,
    className: 'border-indigo-600/20 bg-indigo-50 text-indigo-700',
  },
  weak: {
    label: 'Weak',
    Icon: CircleDashed,
    className: 'border-amber-700/20 bg-amber-50 text-amber-700',
  },
  missing: {
    label: 'Missing',
    Icon: CircleOff,
    className: 'border-amber-700 bg-paper-0 text-amber-700',
  },
  rewording: {
    label: 'Rewording only',
    Icon: PenLine,
    className: 'border-line-200 bg-paper-50 text-ink-700',
  },
};

export interface StatusBadgeProps {
  status: EvidenceStatus;
  /** Overrides the default label text. */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const { label: defaultLabel, Icon, className: tone } = statusConfig[status];
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption font-medium',
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{label ?? defaultLabel}</span>
    </span>
  );
}
