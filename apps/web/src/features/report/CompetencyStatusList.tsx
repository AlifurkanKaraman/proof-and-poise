import { CheckCircle2, Circle, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Report } from '@proof-and-poise/shared';
import { Card } from '../../components/ui/Card';
import { StatusBadge, type EvidenceStatus } from '../../components/ui/StatusBadge';
import { cn } from '../../lib/cn';

type ReportCompetency = Report['competencies'][number];

interface CompetencyStatusListProps {
  competencies: ReportCompetency[];
  className?: string;
}

const READINESS_CONFIG: Record<
  ReportCompetency['readiness'],
  { icon: LucideIcon; color: string; label: string; badge: EvidenceStatus }
> = {
  ready: { icon: CheckCircle2, color: 'text-emerald-700', label: 'Ready', badge: 'verified' },
  developing: {
    icon: TrendingUp,
    color: 'text-indigo-700',
    label: 'Developing',
    badge: 'rewording',
  },
  needs_practice: {
    icon: Target,
    color: 'text-amber-700',
    label: 'Needs Practice',
    badge: 'weak',
  },
  not_assessed: { icon: Circle, color: 'text-ink-700', label: 'Not Assessed', badge: 'missing' },
};

/**
 * Per-competency status list (Req 12.1).
 * Shows ready | developing | needs_practice | not_assessed for each competency.
 */
export function CompetencyStatusList({ competencies, className }: CompetencyStatusListProps) {
  return (
    <Card className={className}>
      <h2 className="mb-4 font-heading text-h3 font-semibold text-ink-950">Competency Status</h2>

      <ul className="divide-y divide-line-200">
        {competencies.map((competency) => {
          const config = READINESS_CONFIG[competency.readiness];
          const Icon = config.icon;

          return (
            <li
              key={competency.competencyId}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <Icon className={cn('size-5 shrink-0', config.color)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-small font-semibold text-ink-950">{competency.name}</p>
                {competency.bestScore !== null && (
                  <p className="text-caption text-ink-700">
                    Best answer score: {competency.bestScore.toFixed(1)} / 4
                  </p>
                )}
              </div>
              <StatusBadge status={config.badge} label={config.label} className="shrink-0" />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
