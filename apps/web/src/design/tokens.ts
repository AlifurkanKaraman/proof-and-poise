/**
 * Proof & Poise design tokens (design.md §9). This is the ONLY file in apps/web
 * allowed to contain hex color values; ESLint enforces that (Req 14.1).
 */

export const colors = {
  ink: {
    950: '#0B1220', // app frame, hero, footer
    900: '#131C2E', // dark surfaces
    700: '#334155', // secondary text on light
    500: '#64748B', // muted text on dark only
  },
  paper: {
    0: '#FFFFFF', // raised surfaces
    50: '#FAF8F4', // page background
  },
  line: {
    200: '#E6E1D8', // borders, dividers
  },
  indigo: {
    50: '#EEF0FF',
    600: '#4F46E5', // primary actions, focus, selection
    700: '#4338CA',
  },
  emerald: {
    50: '#ECFDF5',
    700: '#047857', // verified evidence, progress
  },
  amber: {
    50: '#FFFBEB',
    700: '#B45309', // weak or missing evidence
  },
  red: {
    50: '#FEF2F2',
    700: '#B91C1C', // real errors only
  },
} as const;

export const fontFamily = {
  heading: ['"Manrope Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  body: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
} as const;

/** [font-size, line-height] pairs. */
export const fontSize = {
  display: ['clamp(2.25rem, 4vw + 1rem, 3.5rem)', '1.1'],
  h1: ['2.25rem', '1.2'],
  h2: ['1.75rem', '1.25'],
  h3: ['1.375rem', '1.3'],
  h4: ['1.125rem', '1.4'],
  body: ['1rem', '1.6'],
  small: ['0.875rem', '1.5'],
  caption: ['0.75rem', '1.4'],
} as const;

/** 4-pt spacing scale (px → rem). */
export const spacing = {
  1: '0.25rem', // 4
  2: '0.5rem', // 8
  3: '0.75rem', // 12
  4: '1rem', // 16
  6: '1.5rem', // 24
  8: '2rem', // 32
  12: '3rem', // 48
  16: '4rem', // 64
  24: '6rem', // 96
} as const;

export const maxWidth = {
  content: '72rem',
  reading: '65ch',
} as const;

export const radius = {
  none: '0',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
} as const;

export const shadow = {
  none: 'none',
  xs: '0 1px 2px rgb(11 18 32 / .06)',
  sm: '0 2px 8px rgb(11 18 32 / .06)',
  md: '0 8px 24px rgb(11 18 32 / .08)',
} as const;

export const motion = {
  duration: { micro: 120, standard: 200, reveal: 320 },
  /** cubic-bezier(0.2, 0, 0, 1) */
  easing: [0.2, 0, 0, 1] as const,
} as const;

export const tokens = { colors, fontFamily, fontSize, spacing, maxWidth, radius, shadow, motion };
