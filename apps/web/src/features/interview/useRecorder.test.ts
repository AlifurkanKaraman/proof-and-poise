import { describe, expect, it } from 'vitest';
import { LIMITS } from '@proof-and-poise/shared';
import { pickRecorderFormat, RECORDER_FORMATS } from './useRecorder';

const supports =
  (...types: string[]) =>
  (t: string) =>
    types.includes(t);

describe('pickRecorderFormat (Req 10.4)', () => {
  it('prefers WebM/Opus (Chrome, Firefox) and sends it as audio/webm', () => {
    expect(pickRecorderFormat(supports('audio/webm;codecs=opus', 'audio/webm'))).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      contentType: 'audio/webm',
    });
  });

  it('falls back to MP4 for Safari (desktop and iOS)', () => {
    expect(pickRecorderFormat(supports('audio/mp4'))).toEqual({
      mimeType: 'audio/mp4',
      contentType: 'audio/mp4',
    });
  });

  it('uses Ogg when it is the only supported format', () => {
    expect(pickRecorderFormat(supports('audio/ogg;codecs=opus'))?.contentType).toBe('audio/ogg');
  });

  it('returns null when the browser supports none of the allowed formats', () => {
    expect(pickRecorderFormat(supports('audio/wav'))).toBeNull();
  });

  it('only maps to content types the upload contract accepts', () => {
    const allowed: readonly string[] = LIMITS.audioUpload.contentTypes;
    for (const f of RECORDER_FORMATS) {
      expect(allowed).toContain(f.contentType);
      expect(f.mimeType.startsWith(f.contentType)).toBe(true);
    }
  });
});
