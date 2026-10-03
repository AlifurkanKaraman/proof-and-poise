import type { Turn, TurnKind } from '@proof-and-poise/shared';
import {
  Briefcase,
  CornerDownRight,
  Info,
  MapPin,
  MessagesSquare,
  Repeat,
  SearchCheck,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Disclosure } from '../../components/ui/Disclosure';
import { IconTile } from '../../components/ui/IconTile';
import { cn } from '../../lib/cn';

interface QuestionCardProps {
  turn: Turn;
  className?: string;
}

const KINDS: Record<TurnKind, { label: string; icon: LucideIcon; why: string }> = {
  behavioral: {
    label: 'Behavioral',
    icon: MessagesSquare,
    why: 'Interviewers use this kind of question to hear how you actually worked through a real situation.',
  },
  role_specific: {
    label: 'Role-specific',
    icon: Briefcase,
    why: 'This one comes straight from what the job asks for, so your answer can show you already do it.',
  },
  evidence_gap: {
    label: 'Evidence gap',
    icon: SearchCheck,
    why: 'Your resume says little about this requirement, so this is a chance to add the proof it is missing.',
  },
  follow_up: {
    label: 'Follow-up',
    icon: CornerDownRight,
    why: 'This builds on your previous answer. A concrete detail or number is what is being asked for.',
  },
  practice: {
    label: 'Practice',
    icon: Repeat,
    why: 'A second try at a question you already answered. Use the feedback you got to make it stronger.',
  },
};

const STAR: { letter: string; title: string; hint: string; icon: LucideIcon }[] = [
  { letter: 'S', title: 'Situation', hint: 'Where and when, in one sentence.', icon: MapPin },
  { letter: 'T', title: 'Task', hint: 'What you were responsible for.', icon: Target },
  { letter: 'A', title: 'Action', hint: 'What you did, using "I".', icon: Zap },
  { letter: 'R', title: 'Result', hint: 'What changed, ideally with a number.', icon: TrendingUp },
];

/** The current interview question with its kind, why it is asked, and an optional STAR guide. */
export function QuestionCard({ turn, className }: QuestionCardProps) {
  const kind = KINDS[turn.kind];

  return (
    <Card
      tone="raised"
      padding="lg"
      className={cn('flex flex-col gap-5', className)}
      role="region"
      aria-label="Interview question"
    >
      <div className="flex items-center gap-3">
        <IconTile icon={kind.icon} size="md" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-caption font-semibold text-indigo-700">
            {kind.label}
          </span>
          <span className="text-small text-ink-700">Question {turn.label}</span>
        </div>
      </div>

      <p className="max-w-reading font-heading text-h3 font-semibold text-ink-950">
        {turn.question}
      </p>

      <p className="flex max-w-reading items-start gap-2 text-small text-ink-700">
        <Info className="mt-0.5 size-4 shrink-0 text-indigo-700" aria-hidden="true" />
        <span>{kind.why}</span>
      </p>

      <Disclosure summary="Need a structure? Try STAR" className="border-t border-line-200 pt-1">
        <ol className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STAR.map((s) => (
            <li key={s.letter} className="flex items-start gap-3 rounded-lg bg-ink-100 p-3">
              <IconTile icon={s.icon} size="sm" tone="indigo" />
              <span>
                <span className="block text-small font-semibold text-ink-950">{s.title}</span>
                <span className="block text-caption text-ink-700">{s.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </Disclosure>
    </Card>
  );
}
