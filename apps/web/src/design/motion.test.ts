import { describe, expect, it } from 'vitest';
import { presets, resolvePreset, transitions } from './motion';
import { motion } from './tokens';

describe('motion presets', () => {
  it('use token durations (120/200/320 ms) and the standard easing', () => {
    expect(transitions.micro.duration).toBe(motion.duration.micro / 1000);
    expect(transitions.standard.duration).toBe(0.2);
    expect(transitions.reveal.duration).toBe(0.32);
    expect(transitions.standard.ease).toEqual([0.2, 0, 0, 1]);
  });

  it('returns the preset unchanged when motion is allowed', () => {
    expect(resolvePreset(presets.step, false)).toBe(presets.step);
  });

  it('removes movement and uses an instant transition under reduced motion', () => {
    const r = resolvePreset(presets.step, true);
    expect(r.transition).toEqual({ duration: 0 });
    expect(r.initial).toEqual({ opacity: 0, x: 0 });
    expect(r.animate).toEqual({ opacity: 1, x: 0 });
    expect(r.exit).toEqual({ opacity: 0 });
  });
});
