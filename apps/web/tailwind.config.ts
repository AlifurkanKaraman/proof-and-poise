import type { Config } from 'tailwindcss';
import { proofAndPoisePreset } from './src/design/tailwind-preset';

// Loaded from src/index.css via `@config`. All theme values come from src/design/tokens.ts.
export default {
  presets: [proofAndPoisePreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config;
