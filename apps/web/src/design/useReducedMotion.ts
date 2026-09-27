import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';
import { presets, resolvePreset, type MotionPreset, type PresetName } from './motion';

/** True when the user prefers reduced motion. Framer returns `null` before it knows; treat as false. */
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() === true;
}

/** Returns a motion preset, switched to instant opacity changes under reduced motion (Req 14.5). */
export function useMotionPreset(name: PresetName): MotionPreset {
  const reduced = useReducedMotion();
  return resolvePreset(presets[name], reduced);
}
