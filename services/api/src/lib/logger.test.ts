import { describe, expect, it } from 'vitest';
import { createLogger, pickAllowed, toSafeError } from './logger';

const SECRET_RESUME = 'Amara Okonkwo built a serverless pipeline on AWS Lambda';
const SECRET_ANSWER = 'I once led a migration of our monolith';

function capture() {
  const lines: string[] = [];
  return { lines, log: createLogger((l) => lines.push(l)) };
}

describe('logger redaction (Req 15.3)', () => {
  it('drops every non-allowlisted field, including content-bearing ones', () => {
    const { lines, log } = capture();
    const hostile = {
      requestId: 'req-1',
      route: 'POST /sessions/{sessionId}/analysis',
      status: 202,
      body: { resume: SECRET_RESUME },
      resumeText: SECRET_RESUME,
      answer: SECRET_ANSWER,
      prompt: 'system prompt',
      modelOutput: '{"x":1}',
      authorization: 'Bearer abc',
    };
    log.info('request', hostile as never);
    const out = lines.join('\n');
    expect(out).not.toContain(SECRET_RESUME);
    expect(out).not.toContain(SECRET_ANSWER);
    expect(out).not.toContain('Bearer');
    expect(out).not.toContain('system prompt');
    const parsed = JSON.parse(lines[0]!);
    expect(Object.keys(parsed).sort()).toEqual(
      ['at', 'event', 'level', 'requestId', 'route', 'status'].sort(),
    );
  });

  it('rejects free-text in allowlisted string fields and wrong types', () => {
    expect(
      pickAllowed({ route: SECRET_RESUME.repeat(5), errorCode: 'line\nbreak', status: '200' }),
    ).toEqual({});
    expect(pickAllowed({ latencyMs: Number.NaN, inputTokens: 12 })).toEqual({ inputTokens: 12 });
  });

  it('keeps model-call counters but drops model content fields', () => {
    expect(
      pickAllowed({
        task: 'analyze',
        attempt: 2,
        discardedQuotes: 3,
        discardedRecommendations: 1,
        toolInput: { quote: SECRET_RESUME },
        validationIssues: ['competencies.0.name: too_big'],
      }),
    ).toEqual({ task: 'analyze', attempt: 2, discardedQuotes: 3, discardedRecommendations: 1 });
  });

  it('logs errors as { code, name } only, never the message or stack', () => {
    const { lines, log } = capture();
    const err = Object.assign(new Error(`Validation failed for ${SECRET_ANSWER}`), {
      code: 'ValidationException',
      name: 'ValidationException',
    });
    log.error('request_failed', err, { requestId: 'req-2' });
    const out = lines.join('\n');
    expect(out).not.toContain(SECRET_ANSWER);
    expect(out).not.toContain('stack');
    expect(JSON.parse(lines[0]!).error).toEqual({
      code: 'ValidationException',
      name: 'ValidationException',
    });
  });

  it('falls back safely for non-error values', () => {
    expect(toSafeError('boom')).toEqual({ code: 'UNKNOWN', name: 'Error' });
    expect(toSafeError({ code: SECRET_RESUME.repeat(4) })).toEqual({
      code: 'UNKNOWN',
      name: 'Error',
    });
  });

  it('never echoes a free-form event name', () => {
    const { lines, log } = capture();
    log.info(SECRET_ANSWER);
    expect(lines[0]).not.toContain(SECRET_ANSWER);
    expect(JSON.parse(lines[0]!).event).toBe('invalid_event_name');
  });
});
