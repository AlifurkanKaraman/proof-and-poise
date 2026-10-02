import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mediaState } from '../test/setup';

// Framer caches the media-query result per module instance, so this file sets the
// preference before importing the hook. (Vitest isolates modules per test file.)
mediaState.prefersReducedMotion = true;
const { useMotionPreset, useReducedMotion } = await import('./useReducedMotion');

describe('useReducedMotion (prefers-reduced-motion: reduce)', () => {
  it('returns true', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('useMotionPreset returns an instant, movement-free preset', () => {
    const { result } = renderHook(() => useMotionPreset('step'));
    expect(result.current.transition).toEqual({ duration: 0 });
    expect(result.current.initial['x']).toBe(0);
  });
});
