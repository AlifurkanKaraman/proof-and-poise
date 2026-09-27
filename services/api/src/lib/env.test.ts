import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from './env';

const valid = {
  APP_STAGE: 'dev',
  TABLE_NAME: 'proof-and-poise-dev',
  BUCKET_NAME: 'proof-and-poise-dev-uploads',
  ALLOWED_ORIGINS: 'http://localhost:5173, https://develop.example.amplifyapp.com',
};

describe('loadEnv (Req 15.4)', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.MODEL_ID).toBe('us.amazon.nova-lite-v1:0');
    expect(env.ALLOWED_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://develop.example.amplifyapp.com',
    ]);
  });

  it('fails fast listing only the invalid keys, never their values', () => {
    const secretish = 'not-a-url-super-secret';
    try {
      loadEnv({
        ...valid,
        APP_STAGE: 'staging',
        ALLOWED_ORIGINS: secretish,
        TABLE_NAME: undefined,
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      const e = err as EnvError;
      expect(e.invalidKeys.sort()).toEqual(['ALLOWED_ORIGINS', 'APP_STAGE', 'TABLE_NAME']);
      expect(e.message).not.toContain(secretish);
    }
  });
});
