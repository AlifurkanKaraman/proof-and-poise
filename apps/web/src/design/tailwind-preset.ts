import type { Config } from 'tailwindcss';
import { colors, fontFamily, fontSize, maxWidth, motion, radius, shadow, spacing } from './tokens';

const ms = (n: number) => `${n}ms`;
const easing = `cubic-bezier(${motion.easing.join(', ')})`;

/**
 * Tailwind preset built from tokens.ts. Colors, radii, shadows, fonts and type
 * scale REPLACE Tailwind defaults so only design tokens are available.
 */
export const proofAndPoisePreset = {
  content: [],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      ...colors,
    },
    fontFamily: {
      heading: [...fontFamily.heading],
      body: [...fontFamily.body],
    },
    fontSize: Object.fromEntries(
      Object.entries(fontSize).map(([k, [size, lineHeight]]) => [k, [size, { lineHeight }]]),
    ),
    borderRadius: { ...radius },
    boxShadow: { ...shadow },
    extend: {
      spacing: { ...spacing },
      maxWidth: { ...maxWidth },
      transitionDuration: {
        micro: ms(motion.duration.micro),
        standard: ms(motion.duration.standard),
        reveal: ms(motion.duration.reveal),
      },
      transitionTimingFunction: { standard: easing },
    },
  },
} satisfies Config;
