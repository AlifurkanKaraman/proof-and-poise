import { describe, expect, it } from 'vitest';
import { normalizeBaseUrl, parseWebEnv } from './env';

describe('web env', () => {
  it('uses the configured API base URL without a trailing /v1', () => {
    const env = parseWebEnv(
      {
        VITE_API_BASE_URL: 'https://example.execute-api.us-east-1.amazonaws.com/v1/',
        VITE_APP_ENV: 'dev',
      },
      'production',
    );
    expect(env).toEqual({
      apiBaseUrl: 'https://example.execute-api.us-east-1.amazonaws.com',
      appEnv: 'dev',
      mockApi: false,
    });
  });

  it('keeps a base path that is not /v1', () => {
    expect(normalizeBaseUrl('https://api.test/prefix/')).toBe('https://api.test/prefix');
  });

  it('always targets the page origin in mock mode', () => {
    const env = parseWebEnv({ VITE_API_BASE_URL: 'https://real.api.test' }, 'mock');
    expect(env).toEqual({ apiBaseUrl: window.location.origin, appEnv: 'mock', mockApi: true });
  });

  it('defaults to the page origin and "local" when unset or empty', () => {
    expect(parseWebEnv({ VITE_API_BASE_URL: '', VITE_APP_ENV: '' }, 'development')).toEqual({
      apiBaseUrl: window.location.origin,
      appEnv: 'local',
      mockApi: false,
    });
  });

  it('rejects invalid values and names the variable, not the value', () => {
    expect(() => parseWebEnv({ VITE_API_BASE_URL: 'not a url secret-ish' }, 'production')).toThrow(
      /^Invalid web environment: VITE_API_BASE_URL$/,
    );
    expect(() => parseWebEnv({ VITE_APP_ENV: 'staging' }, 'production')).toThrow(/VITE_APP_ENV/);
  });
});
