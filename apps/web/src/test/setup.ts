import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

/** jsdom has no matchMedia. Tests can override `prefersReducedMotion` before first render. */
export const mediaState = { prefersReducedMotion: false };

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      // Framer queries "(prefers-reduced-motion)"; CSS-style queries use ": reduce".
      matches: query.includes('prefers-reduced-motion') && mediaState.prefersReducedMotion,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
