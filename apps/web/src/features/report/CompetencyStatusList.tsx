import { CheckCircle, Circle, TrendingUp, XCircle } from 'lucide-react';
import type { Report } from '@proof-and-poise/shared';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { cn } from '../../lib/cn';

type ReportCompetency = Report['competencies'][number];

interface CompetencyStatusListProps {
  competencies: ReportCompetency[];
  className?: string;
}

const READINESS_CONFIG = {
  ready: {
    icon: CheckCircle,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-700/20',
    label: 'Ready',
  },
  developing: {
    icon: TrendingUp,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-600/20',
    label: 'Developing',
  },
  needs_practice: {
    icon: XCircle,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-700/20',
    label: 'Needs Practice',
  },
  not_assessed: {
    icon: Circle,
    color: 'text-ink-500',
    bg: 'bg-ink-50',
    border: 'border-ink-500/20',
    label: 'Not Assessed',
  },
} as const;

/**
 * Per-competency status list (Req 12.1).
 * Shows ready | developing | needs_practice | not_assessed for each competency.
 */
export function CompetencyStatusList({ competencies, className }: CompetencyStatusListProps) {
  return (
    <div className={cn('rounded-lg border border-line-200 bg-paper-0 p-6', className)}>
      <h2 className="mb-4 text-h3 font-semibold text-ink-950">Competency Status</h2>

      <ul className="grid grid-cols-1 gap-3">
        {competencies.map((competency) => {
          const config = READINESS_CONFIG[competency.readiness];
          const Icon = config.icon;

          return (
            <li
              key={competency.competencyId}
              className={cn('flex items-start gap-3 rounded border p-4', config.border, config.bg)}
            >
              <Icon className={cn('size-5 shrink-0', config.color)} aria-hidden />
              <div className="flex-1">
                <p className="text-small font-semibold text-ink-950">{competency.name}</p>
                {competency.bestScore !== null && (
                  <p className="mt-1 text-caption text-ink-700">
                    Best answer score: {competency.bestScore.toFixed(1)} / 4
                  </p>
                )}
              </div>
              <StatusBadge
                status={
                  competency.readiness === 'ready'
                    ? 'verified'
                    : competency.readiness === 'needs_practice'
                      ? 'weak'
                      : 'missing'
                }
                label={config.label}
                className="shrink-0"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
