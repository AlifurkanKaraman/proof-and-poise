/**
 * Proof & Poise design tokens (design.md §9). This is the ONLY file in apps/web
 * allowed to contain hex color values; ESLint enforces that (Req 14.1).
 */

export const colors = {
  ink: {
    950: '#0B1220', // app frame, hero, footer
    900: '#131C2E', // dark surfaces
    800: '#1C2740', // raised dark surfaces, dividers on dark
    100: '#EDF0F6', // quiet fills on light
    700: '#334155', // secondary text on light
    500: '#64748B', // muted text on dark only
  },
  paper: {
    0: '#FFFFFF', // raised surfaces
    50: '#F5F7FB', // page background (cool porcelain)
  },
  line: {
    200: '#DCE2EE', // borders, dividers
    300: '#BFC9DB', // stronger borders, inactive connectors
  },
  indigo: {
    50: '#EEF1FD',
    100: '#DEE4FB', // evidence highlight, selected fills
    600: '#3A4BC8', // primary actions, focus, selection
    700: '#2F3DA8',
  },
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    700: '#047857', // verified evidence, progress
  },
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    700: '#B45309', // weak or missing evidence
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
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
  sm: '0 1px 3px rgb(11 18 32 / .07), 0 1px 2px rgb(11 18 32 / .04)',
  md: '0 10px 30px -12px rgb(11 18 32 / .20)',
  lift: '0 24px 48px -20px rgb(11 18 32 / .35)',
} as const;

export const motion = {
  duration: { micro: 120, standard: 200, reveal: 320 },
  /** cubic-bezier(0.2, 0, 0, 1) */
  easing: [0.2, 0, 0, 1] as const,
} as const;

export const tokens = { colors, fontFamily, fontSize, spacing, maxWidth, radius, shadow, motion };
