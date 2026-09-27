import type { Transition } from 'framer-motion';
import { motion as motionTokens } from './tokens';

/**
 * Motion presets (design.md §9.4). Animate only to explain: step transitions,
 * evidence-thread draw, score reveal, score deltas, recording indicator.
 * Lists, cards and page loads never animate.
 */

const ease = [...motionTokens.easing] as [number, number, number, number];
const seconds = (ms: number) => ms / 1000;

export const transitions = {
  micro: { duration: seconds(motionTokens.duration.micro), ease },
  standard: { duration: seconds(motionTokens.duration.standard), ease },
  reveal: { duration: seconds(motionTokens.duration.reveal), ease },
  instant: { duration: 0 },
} satisfies Record<string, Transition>;

export interface MotionPreset {
  initial: Record<string, number>;
  animate: Record<string, number>;
  exit: Record<string, number>;
  transition: Transition;
}

export const presets = {
  /** Step and panel transitions: slide 8px and fade. */
  step: {
    initial: { opacity: 0, x: 8 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -8 },
    transition: transitions.standard,
  },
  /** Evidence-thread draw (SVG pathLength). */
  threadDraw: {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    exit: { opacity: 0 },
    transition: transitions.reveal,
  },
  /** Score delta chip. */
  delta: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: transitions.standard,
  },
  /** Press feedback. */
  press: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    exit: { scale: 1 },
    transition: transitions.micro,
  },
} satisfies Record<string, MotionPreset>;

export type PresetName = keyof typeof presets;

/**
 * Reduced-motion variant: no movement, instant opacity change to the final state.
 * Pure function so it is unit-testable.
 */
export function resolvePreset(preset: MotionPreset, reduced: boolean): MotionPreset {
  if (!reduced) return preset;
  const keepOpacity = (v: Record<string, number>) =>
    'opacity' in v ? { opacity: v['opacity'] ?? 1 } : {};
  const finalState = { ...preset.animate };
  // Paths are drawn fully; everything else jumps to the final values.
  return {
    initial: { ...finalState, ...keepOpacity(preset.initial) },
    animate: finalState,
    exit: keepOpacity(preset.exit),
    transition: transitions.instant,
  };
}
