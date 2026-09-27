import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge about the custom font-size tokens so `text-small` and
// `text-ink-700` are not treated as conflicting classes.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'h4', 'body', 'small', 'caption'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Visible 2px indigo focus ring with 2px offset (Req 14.4). */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

/** Focus ring for dark (ink-950/900) surfaces, where indigo-600 falls below 3:1. */
export const focusRingOnDark =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-0';
