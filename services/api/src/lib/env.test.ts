import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv, loadWorkerEnv } from './env';

const valid = {
  APP_STAGE: 'dev',
  TABLE_NAME: 'proof-and-poise-dev',
  BUCKET_NAME: 'proof-and-poise-dev-uploads',
  ALLOWED_ORIGINS: 'http://localhost:5173, https://develop.example.amplifyapp.com',
  IP_HASH_SALT_PARAM: '/proof-and-poise/dev/ip-hash-salt',
  WORKER_FUNCTION_NAME: 'proof-and-poise-dev-analysis-worker',
};

describe('loadWorkerEnv (Req 15.4)', () => {
  it('needs only storage and model settings', () => {
    const env = loadWorkerEnv({
      APP_STAGE: 'dev',
      TABLE_NAME: valid.TABLE_NAME,
      BUCKET_NAME: valid.BUCKET_NAME,
    });
    expect(env).toEqual({
      APP_STAGE: 'dev',
      TABLE_NAME: valid.TABLE_NAME,
      BUCKET_NAME: valid.BUCKET_NAME,
      MODEL_ID: 'us.amazon.nova-lite-v1:0',
    });
    expect(() => loadWorkerEnv({ APP_STAGE: 'dev' })).toThrow(EnvError);
  });
});

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
        IP_HASH_SALT_PARAM: undefined,
        WORKER_FUNCTION_NAME: undefined,
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      const e = err as EnvError;
      expect(e.invalidKeys.sort()).toEqual([
        'ALLOWED_ORIGINS',
        'APP_STAGE',
        'IP_HASH_SALT_PARAM',
        'TABLE_NAME',
        'WORKER_FUNCTION_NAME',
      ]);
      expect(e.message).not.toContain(secretish);
    }
  });
});
