import { describe, expect, it } from 'vitest';
import { DEMO_JOB, DEMO_RESUME_TEXT, LIMITS } from '@proof-and-poise/shared';
import { draftSubmission, validateResumeFile, type SetupDraft } from './setupForm';

const PDF = LIMITS.resumeUpload.contentType;

describe('validateResumeFile (Req 3.3)', () => {
  it('accepts a PDF within the size limit', () => {
    expect(validateResumeFile({ type: PDF, size: LIMITS.resumeUpload.maxBytes })).toBeNull();
  });

  it('gives a specific message for type, empty, and oversize files', () => {
    expect(validateResumeFile({ type: 'image/png', size: 10 })).toMatch(/Only PDF/);
    expect(validateResumeFile({ type: PDF, size: 0 })).toMatch(/empty/);
    expect(validateResumeFile({ type: PDF, size: LIMITS.resumeUpload.maxBytes + 1 })).toMatch(
      /over 5 MB/,
    );
  });
});

describe('draftSubmission', () => {
  const base: SetupDraft = {
    sessionId: null,
    resumeMode: 'paste',
    resumeText: DEMO_RESUME_TEXT,
    file: null,
    job: { ...DEMO_JOB, company: '' },
  };

  it('builds a text submission from a valid draft', () => {
    expect(draftSubmission(base)?.resume).toEqual({ kind: 'text', text: DEMO_RESUME_TEXT.trim() });
  });

  it('returns null for an incomplete draft', () => {
    expect(draftSubmission({ ...base, resumeText: 'too short' })).toBeNull();
    expect(draftSubmission({ ...base, resumeMode: 'upload' })).toBeNull();
    expect(draftSubmission({ ...base, job: { ...base.job, role: ' ' } })).toBeNull();
  });
});
