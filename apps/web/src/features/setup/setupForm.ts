import { z } from 'zod';
import {
  JobInputSchema,
  LIMITS,
  ResumeTextInputSchema,
  ResumeUploadRequestSchema,
  type InterviewType,
  type JobInput,
} from '@proof-and-poise/shared';
import type { SetupResume } from '../../lib/api/queries';

// --- Form schemas: the shared contract schemas, used as-is (Req 3.5) ---------------

/** Paste tab: the contract's resume text field. */
export const ResumeTextFormSchema = z.object({ text: ResumeTextInputSchema.shape.text });
export type ResumeTextFormValues = z.input<typeof ResumeTextFormSchema>;
export type ResumeTextFormOutput = z.output<typeof ResumeTextFormSchema>;

/** Target job step: the contract's job input (company optional, interview type defaulted). */
export const JobFormSchema = JobInputSchema;
export type JobFormValues = z.input<typeof JobInputSchema>;

export const EMPTY_JOB: JobFormValues = {
  description: '',
  company: '',
  role: '',
  interviewType: 'behavioral_mixed',
};

export type ResumeMode = 'upload' | 'paste';

export const INTERVIEW_TYPES: Record<InterviewType, { label: string; description: string }> = {
  behavioral_mixed: {
    label: 'Behavioral and role-specific',
    description: 'A mix of behavioral questions and questions about the role. Recommended.',
  },
  technical_mixed: {
    label: 'Technical and behavioral',
    description: 'More questions about the technical skills in the job description.',
  },
  behavioral_only: {
    label: 'Behavioral only',
    description: 'Questions about how you worked with people and handled situations.',
  },
};

// --- Messages ------------------------------------------------------------------

const n = (value: number) => value.toLocaleString('en-US');
const MAX_MB = LIMITS.resumeUpload.maxBytes / (1024 * 1024);

type FieldName = 'resumeText' | 'description' | 'role' | 'company';

/** Plain-language message for a Zod issue code on a setup field (Req 3.4). */
export function fieldMessage(field: FieldName, type: string | undefined): string | undefined {
  if (type === undefined) return undefined;
  const tooBig = type === 'too_big';
  switch (field) {
    case 'resumeText':
      return tooBig
        ? `Resume text can be at most ${n(LIMITS.resumeText.max)} characters.`
        : `Paste at least ${n(LIMITS.resumeText.min)} characters of your resume.`;
    case 'description':
      return tooBig
        ? `The job description can be at most ${n(LIMITS.jobText.max)} characters.`
        : `Paste at least ${n(LIMITS.jobText.min)} characters of the job description.`;
    case 'role':
      return tooBig
        ? `The role can be at most ${n(LIMITS.role.max)} characters.`
        : 'Enter the role you are applying for.';
    case 'company':
      return `The company name can be at most ${n(LIMITS.company.max)} characters.`;
  }
}

/**
 * Client-side PDF checks before any upload (Req 3.3), using the shared upload schema.
 * Returns a specific message, or null when the file is acceptable.
 */
export function validateResumeFile(file: Pick<File, 'type' | 'size'>): string | null {
  const result = ResumeUploadRequestSchema.safeParse({ contentType: file.type, size: file.size });
  if (result.success) return null;
  const issues = result.error.issues;
  if (issues.some((i) => i.path[0] === 'contentType')) {
    return 'Only PDF files are accepted. Choose a PDF, or paste your resume text instead.';
  }
  if (file.size < LIMITS.resumeUpload.minBytes) {
    return 'This file is empty. Choose a PDF that has content.';
  }
  return `This file is over ${MAX_MB} MB. Choose a smaller PDF, or paste your resume text instead.`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Draft kept across screens -------------------------------------------------------

/**
 * What the candidate entered, kept in memory (never storage) so that "Paste text instead"
 * and Retry on the analysis screen can return to setup with the values still there.
 * A reload forgets it.
 */
export interface SetupDraft {
  sessionId: string | null;
  resumeMode: ResumeMode;
  resumeText: string;
  file: File | null;
  job: JobFormValues;
}

let draft: SetupDraft | null = null;

export function saveSetupDraft(value: SetupDraft) {
  draft = value;
}

export function loadSetupDraft(): SetupDraft | null {
  return draft;
}

export function clearSetupDraft() {
  draft = null;
}

/** The request a draft would submit, or null when it isn't complete and valid. */
export function draftSubmission(d: SetupDraft): { resume: SetupResume; job: JobInput } | null {
  const job = JobFormSchema.safeParse(d.job);
  if (!job.success) return null;
  if (d.resumeMode === 'upload') {
    return d.file && validateResumeFile(d.file) === null
      ? { resume: { kind: 'file', file: d.file }, job: job.data }
      : null;
  }
  const text = ResumeTextFormSchema.safeParse({ text: d.resumeText });
  return text.success ? { resume: { kind: 'text', text: text.data.text }, job: job.data } : null;
}
