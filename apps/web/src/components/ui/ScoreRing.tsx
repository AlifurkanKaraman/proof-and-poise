import { motion } from 'framer-motion';
import { transitions } from '../../design/motion';
import { useReducedMotion } from '../../design/useReducedMotion';
import { cn } from '../../lib/cn';

export interface ScoreRingProps {
  /** Integer 0–100. Values outside the range are clamped. */
  value: number;
  label: string;
  size?: number;
  tone?: 'indigo' | 'emerald' | 'amber';
  className?: string;
}

const toneClass = {
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
} as const;

/** SVG ring with the numeric value and label as text, so it's never color-only. */
export function ScoreRing({
  value,
  label,
  size = 112,
  tone = 'indigo',
  className,
}: ScoreRingProps) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <figure className={cn('inline-flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-line-200"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke="currentColor"
            className={toneClass[tone]}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: reduced ? offset : circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={reduced ? transitions.instant : transitions.reveal}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-heading font-bold tracking-tight text-ink-950"
          style={{ fontSize: Math.round(size * 0.3) }}
        >
          {clamped}
          <span className="sr-only"> out of 100</span>
        </span>
      </div>
      <figcaption className="text-small font-medium text-ink-700">{label}</figcaption>
    </figure>
  );
}
