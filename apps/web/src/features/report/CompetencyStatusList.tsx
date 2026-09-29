import { CheckCircle, Circle, TrendingUp, XCircle } from 'lucide-react';
import type { Competency } from '@proof-and-poise/shared';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { cn } from '../../lib/cn';

interface CompetencyStatusListProps {
  competencies: Competency[];
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
  // Group by importance
  const byImportance = {
    required: competencies.filter((c) => c.importance === 'required'),
    preferred: competencies.filter((c) => c.importance === 'preferred'),
    bonus: competencies.filter((c) => c.importance === 'bonus'),
  };

  return (
    <div className={cn('rounded-lg border border-line-200 bg-paper-0 p-6', className)}>
      <h2 className="mb-4 text-h3 font-semibold text-ink-950">Competency Status</h2>

      <div className="flex flex-col gap-6">
        {byImportance.required.length > 0 && (
          <Section title="Required" competencies={byImportance.required} />
        )}
        {byImportance.preferred.length > 0 && (
          <Section title="Preferred" competencies={byImportance.preferred} />
        )}
        {byImportance.bonus.length > 0 && (
          <Section title="Bonus" competencies={byImportance.bonus} />
        )}
      </div>
    </div>
  );
}

function Section({ title, competencies }: { title: string; competencies: Competency[] }) {
  return (
    <div>
      <p className="mb-3 text-caption font-semibold uppercase tracking-wide text-ink-700">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-3">
        {competencies.map((competency) => {
          const config = READINESS_CONFIG[competency.readiness];
          const Icon = config.icon;

          return (
            <div
              key={competency.id}
              className={cn(
                'flex items-start gap-3 rounded border p-4',
                config.border,
                config.bg,
              )}
            >
              <Icon className={cn('size-5 shrink-0', config.color)} aria-hidden />
              <div className="flex-1">
                <p className="text-small font-semibold text-ink-950">{competency.name}</p>
                <p className="mt-1 text-caption text-ink-700">{competency.description}</p>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
