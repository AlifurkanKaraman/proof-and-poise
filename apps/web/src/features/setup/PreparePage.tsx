import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  Briefcase,
  ClipboardCheck,
  FileText,
  ListChecks,
  Lock,
  MessagesSquare,
  SearchCheck,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useRef, useState, type Ref } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import {
  InterviewTypeSchema,
  LIMITS,
  type ErrorCode,
  type JobInput,
} from '@proof-and-poise/shared';
import { Page } from '../../app/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { IconTile } from '../../components/ui/IconTile';
import { Input } from '../../components/ui/Input';
import { Stepper } from '../../components/ui/Stepper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { Textarea } from '../../components/ui/Textarea';
import { useMotionPreset } from '../../design/useReducedMotion';
import { isApiError, userMessage } from '../../lib/api/errors';
import { useCreateSession, useSubmitSetup, type SetupResume } from '../../lib/api/queries';
import { cn, focusRing } from '../../lib/cn';
import { loadSession } from '../../lib/session';
import { ResumeDropzone } from './ResumeDropzone';
import {
  EMPTY_JOB,
  fieldMessage,
  formatBytes,
  INTERVIEW_TYPES,
  JobFormSchema,
  loadSetupDraft,
  ResumeTextFormSchema,
  saveSetupDraft,
  validateResumeFile,
  type JobFormValues,
  type ResumeMode,
  type ResumeTextFormOutput,
  type ResumeTextFormValues,
} from './setupForm';

const STEPS = ['Resume', 'Target job', 'Review'];

/** Router state set by recovery actions on the analysis screen (not user input). */
const SetupIntentSchema = z.object({
  resumeMode: z.enum(['upload', 'paste']).optional(),
  step: z.number().int().min(0).max(2).optional(),
  /** Reuse the stored session instead of creating another (retry after a failed analysis). */
  reuseSession: z.boolean().optional(),
});

const isResumeMode = (v: string): v is ResumeMode => v === 'upload' || v === 'paste';

export default function PreparePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [initial] = useState(() => {
    const parsed = SetupIntentSchema.safeParse(location.state ?? {});
    const intent = parsed.success ? parsed.data : {};
    const draft = loadSetupDraft();
    const stored = loadSession();
    const reusable =
      intent.reuseSession === true &&
      draft?.sessionId != null &&
      stored?.sessionId === draft.sessionId
        ? draft.sessionId
        : null;
    return { intent, draft, reusable };
  });
  const { intent, draft } = initial;

  const [step, setStep] = useState(intent.step ?? 0);
  const [resumeMode, setResumeMode] = useState<ResumeMode>(
    intent.resumeMode ?? draft?.resumeMode ?? 'upload',
  );
  const [file, setFile] = useState<File | null>(draft?.file ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initial.reusable);
  const [submitError, setSubmitError] = useState<unknown>(null);

  // Shared Zod schemas on the client, same as the server (Req 3.5).
  const resumeForm = useForm<ResumeTextFormValues, unknown, ResumeTextFormOutput>({
    resolver: zodResolver(ResumeTextFormSchema),
    defaultValues: { text: draft?.resumeText ?? '' },
    mode: 'onTouched',
  });
  const jobForm = useForm<JobFormValues, unknown, JobInput>({
    resolver: zodResolver(JobFormSchema),
    defaultValues: draft?.job ?? EMPTY_JOB,
    mode: 'onTouched',
  });

  const createSession = useCreateSession();
  const submitSetup = useSubmitSetup();
  const submitting = createSession.isPending || submitSetup.isPending;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const stepMotion = useMotionPreset('step');

  // Move focus to the new step's heading so keyboard and screen reader users follow along.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const saveDraft = (id: string | null = sessionId) =>
    saveSetupDraft({
      sessionId: id,
      resumeMode,
      resumeText: resumeForm.getValues('text'),
      file,
      job: jobForm.getValues(),
    });

  const goTo = (next: number) => {
    saveDraft();
    setStep(next);
  };

  const chooseFile = (chosen: File) => {
    // Req 3.3: reject before upload with a specific message.
    const error = validateResumeFile(chosen);
    setFileError(error);
    setFile(error ? null : chosen);
  };

  const nextFromResume = async () => {
    if (resumeMode === 'paste') {
      if (!(await resumeForm.trigger('text', { shouldFocus: true }))) return;
    } else if (!file) {
      setFileError(fileError ?? 'Choose a PDF file, or paste your resume text instead.');
      fileInputRef.current?.focus();
      return;
    }
    goTo(1);
  };

  const nextFromJob = async () => {
    if (!(await jobForm.trigger(undefined, { shouldFocus: true }))) return;
    goTo(2);
  };

  const pasteInstead = () => {
    setSubmitError(null);
    setResumeMode('paste');
    goTo(0);
  };

  /** Map server field errors (Req 3.6) onto the form and go to the step that has them. */
  const applyFieldErrors = (fields: Readonly<Record<string, string>>) => {
    let target: number | null = null;
    for (const [path, code] of Object.entries(fields)) {
      if (path === 'resume.text') {
        resumeForm.setError('text', { type: code });
        target = 0;
      } else if (path.startsWith('job.')) {
        const name = path.slice(4);
        if (name === 'description' || name === 'role' || name === 'company') {
          jobForm.setError(name, { type: code });
          target ??= 1;
        }
      }
    }
    return target;
  };

  const start = async () => {
    setSubmitError(null);
    const job = JobFormSchema.safeParse(jobForm.getValues());
    if (!job.success) {
      setStep(1);
      return;
    }
    let resume: SetupResume;
    if (resumeMode === 'paste') {
      const text = ResumeTextFormSchema.safeParse(resumeForm.getValues());
      if (!text.success) {
        setStep(0);
        return;
      }
      resume = { kind: 'text', text: text.data.text };
    } else {
      if (!file) {
        setStep(0);
        return;
      }
      resume = { kind: 'file', file };
    }

    let id = sessionId;
    try {
      if (!id) {
        id = (await createSession.mutateAsync('standard')).sessionId;
        setSessionId(id);
      }
      saveDraft(id);
      await submitSetup.mutateAsync({ sessionId: id, resume, job: job.data });
      navigate(`/s/${id}/analysis`);
    } catch (error) {
      // Shown below with a recovery action (Req 14.2).
      if (isApiError(error) && error.code === 'UNAUTHORIZED') setSessionId(null);
      if (isApiError(error) && error.code === 'VALIDATION' && error.fields) {
        const target = applyFieldErrors(error.fields);
        if (target !== null) setStep(target);
      }
      setSubmitError(error);
    }
  };

  const errorCode: ErrorCode | null = isApiError(submitError) ? submitError.code : null;
  const jobErrors = jobForm.formState.errors;
  // Read for the Review step only, where the job inputs aren't mounted and can't change.
  const jobValues = jobForm.getValues();

  return (
    <Page
      title="Prepare for a job"
      lead="Add your resume and the job you want. We map each requirement to evidence from your resume."
    >
      <Stepper steps={STEPS} current={step} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-6">
          {submitError !== null && step !== 2 && (
            <ErrorState
              title="We couldn't start the analysis"
              message={userMessage(submitError)}
              action={
                <Button onClick={() => setSubmitError(null)} variant="secondary">
                  Dismiss
                </Button>
              }
            />
          )}

          <motion.section
            key={step}
            initial={stepMotion.initial}
            animate={stepMotion.animate}
            transition={stepMotion.transition}
            aria-labelledby="setup-step-heading"
            className="flex flex-col gap-6"
          >
            {step === 0 && (
              <>
                <div className="rounded-xl border border-line-200 bg-paper-0 p-5 shadow-md sm:p-8">
                  <StepHeading ref={headingRef} icon={FileText}>
                    Your resume
                  </StepHeading>

                  <Tabs
                    value={resumeMode}
                    onValueChange={(v) => {
                      if (isResumeMode(v)) setResumeMode(v);
                    }}
                    className="mt-4"
                  >
                    <TabsList aria-label="How to add your resume">
                      <TabsTrigger value="upload">Upload PDF</TabsTrigger>
                      <TabsTrigger value="paste">Paste text</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload">
                      <ResumeDropzone
                        file={file}
                        error={fileError}
                        onFile={chooseFile}
                        onRemove={() => {
                          setFile(null);
                          setFileError(null);
                        }}
                        inputRef={fileInputRef}
                      />
                    </TabsContent>
                    <TabsContent value="paste">
                      <Textarea
                        label="Resume text"
                        hint="Paste the text of your resume, including experience, projects, and skills."
                        required
                        rows={12}
                        minLength={LIMITS.resumeText.min}
                        maxLength={LIMITS.resumeText.max}
                        defaultValue={resumeForm.getValues('text')}
                        error={fieldMessage('resumeText', resumeForm.formState.errors.text?.type)}
                        {...resumeForm.register('text')}
                      />
                    </TabsContent>
                  </Tabs>

                  <ResumeNotice />
                </div>

                <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-between gap-3 border-t border-line-200 bg-paper-0 px-4 py-3 sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                  <Button variant="secondary" onClick={() => navigate('/')}>
                    Cancel
                  </Button>
                  <Button onClick={() => void nextFromResume()}>Next: Target job</Button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="flex flex-col gap-5 rounded-xl border border-line-200 bg-paper-0 p-5 shadow-md sm:p-8">
                  <StepHeading ref={headingRef} icon={Briefcase}>
                    Target job
                  </StepHeading>
                  <Textarea
                    label="Job description"
                    hint="Paste the full job posting, including responsibilities and requirements."
                    required
                    rows={10}
                    minLength={LIMITS.jobText.min}
                    maxLength={LIMITS.jobText.max}
                    defaultValue={jobForm.getValues('description')}
                    error={fieldMessage('description', jobErrors.description?.type)}
                    {...jobForm.register('description')}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Target role"
                      required
                      maxLength={LIMITS.role.max}
                      placeholder="e.g., Junior Data Analyst"
                      error={fieldMessage('role', jobErrors.role?.type)}
                      {...jobForm.register('role')}
                    />
                    <Input
                      label="Company (optional)"
                      maxLength={LIMITS.company.max}
                      placeholder="e.g., Northwind Health"
                      error={fieldMessage('company', jobErrors.company?.type)}
                      {...jobForm.register('company')}
                    />
                  </div>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-small font-medium text-ink-950">
                      Interview type
                    </legend>
                    {InterviewTypeSchema.options.map((type) => (
                      <label
                        key={type}
                        className={cn(
                          'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line-300 bg-paper-0 p-4 hover:bg-ink-100',
                          'has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50 has-[:checked]:shadow-xs',
                        )}
                      >
                        <input
                          type="radio"
                          value={type}
                          className={cn('mt-1 size-4 accent-indigo-600', focusRing)}
                          {...jobForm.register('interviewType')}
                        />
                        <span className="flex flex-col">
                          <span className="text-small font-medium text-ink-950">
                            {INTERVIEW_TYPES[type].label}
                          </span>
                          <span className="text-small text-ink-700">
                            {INTERVIEW_TYPES[type].description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </div>

                <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-between gap-3 border-t border-line-200 bg-paper-0 px-4 py-3 sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                  <Button variant="secondary" onClick={() => goTo(0)}>
                    Back
                  </Button>
                  <Button onClick={() => void nextFromJob()}>Next: Review</Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="rounded-xl border border-line-200 bg-paper-0 p-5 shadow-md sm:p-8">
                  <StepHeading ref={headingRef} icon={ClipboardCheck}>
                    Review and analyze
                  </StepHeading>
                  <dl className="mt-4 grid gap-4 text-small sm:grid-cols-[12rem_1fr]">
                    <dt className="font-medium text-ink-950">Resume</dt>
                    <dd className="text-ink-700">
                      {resumeMode === 'upload' && file
                        ? `PDF: ${file.name} (${formatBytes(file.size)})`
                        : `Pasted text: ${resumeForm.getValues('text').trim().length.toLocaleString('en-US')} characters`}
                    </dd>
                    <dt className="font-medium text-ink-950">Target role</dt>
                    <dd className="text-ink-700">{jobValues.role}</dd>
                    <dt className="font-medium text-ink-950">Company</dt>
                    <dd className="text-ink-700">{jobValues.company?.trim() || 'Not provided'}</dd>
                    <dt className="font-medium text-ink-950">Interview type</dt>
                    <dd className="text-ink-700">
                      {INTERVIEW_TYPES[jobValues.interviewType ?? 'behavioral_mixed'].label}
                    </dd>
                    <dt className="font-medium text-ink-950">Job description</dt>
                    <dd className="text-ink-700">
                      {jobValues.description.trim().length.toLocaleString('en-US')} characters
                    </dd>
                  </dl>
                </div>

                {submitError !== null && (
                  <ErrorState
                    title={
                      errorCode === 'EXTRACTION_FAILED'
                        ? "We couldn't read that PDF"
                        : "We couldn't start the analysis"
                    }
                    message={userMessage(submitError)}
                    action={
                      errorCode === 'EXTRACTION_FAILED' ? (
                        <Button onClick={pasteInstead}>Paste text instead</Button>
                      ) : (
                        <Button onClick={() => void start()} loading={submitting}>
                          Retry
                        </Button>
                      )
                    }
                    secondaryAction={
                      <Button variant="secondary" onClick={() => goTo(0)}>
                        Edit resume
                      </Button>
                    }
                  />
                )}

                <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-between gap-3 border-t border-line-200 bg-paper-0 px-4 py-3 sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                  <Button variant="secondary" onClick={() => goTo(1)} disabled={submitting}>
                    Back
                  </Button>
                  <Button onClick={() => void start()} loading={submitting}>
                    Start analysis
                  </Button>
                </div>
              </>
            )}
          </motion.section>
        </div>
        <WhatHappensNext step={step} />
      </div>
    </Page>
  );
}

function StepHeading({
  ref,
  icon: Icon,
  children,
}: {
  ref: Ref<HTMLHeadingElement>;
  icon: typeof FileText;
  children: string;
}) {
  return (
    <h2
      ref={ref}
      id="setup-step-heading"
      tabIndex={-1}
      className="flex items-center gap-3 text-h3 font-semibold text-ink-950 focus:outline-none"
    >
      <IconTile icon={Icon} />
      {children}
    </h2>
  );
}

function ResumeNotice() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2 text-small text-ink-700" aria-label="File requirements">
        {[
          'PDF only',
          `${LIMITS.resumeUpload.maxBytes / (1024 * 1024)} MB maximum`,
          `${LIMITS.resumeUpload.maxPages} pages maximum`,
          'Text-based, not a scanned image',
        ].map((item) => (
          <li key={item} className="rounded-full border border-line-300 bg-paper-50 px-3 py-1">
            {item}
          </li>
        ))}
      </ul>
      <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
        <p className="text-small text-ink-700">
          <span className="font-semibold text-ink-950">Temporary data. </span>
          Your PDF is deleted as soon as its text is extracted. Everything in this session is
          deleted after {LIMITS.session.ttlHours} hours.
        </p>
      </div>
    </div>
  );
}

const NEXT_STEPS = [
  {
    icon: SearchCheck,
    title: 'We map your evidence',
    text: 'Each requirement is linked to the exact resume line that proves it.',
  },
  {
    icon: ListChecks,
    title: 'You approve every change',
    text: 'Suggestions are reviewed one at a time. Nothing is added without you.',
  },
  {
    icon: MessagesSquare,
    title: 'You practice the hard parts',
    text: 'A five-question mock interview aims at your weakest evidence.',
  },
] as const;

const STEP_TIPS = [
  'Use the resume you would really send. A text-based PDF or pasted text both work.',
  'Paste the whole posting. The requirements in it decide which evidence we look for.',
  'Check the details, then start. You can go back and edit before the analysis begins.',
] as const;

/** Side panel: what comes next and a privacy reassurance, so setup feels guided (Req 3, 15). */
function WhatHappensNext({ step }: { step: number }) {
  return (
    <aside aria-label="What happens next" className="flex flex-col gap-4 lg:sticky lg:top-6">
      <Card padding="md" className="flex flex-col gap-4">
        <h2 className="text-h4 font-semibold text-ink-950">What happens next</h2>
        <ol className="flex flex-col gap-4">
          {NEXT_STEPS.map(({ icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <IconTile icon={icon} size="sm" tone="indigo" />
              <div>
                <p className="text-small font-semibold text-ink-950">{title}</p>
                <p className="text-small text-ink-700">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Card tone="tinted" padding="md" className="flex flex-col gap-2">
        <p className="text-small font-semibold text-ink-950">Tip for this step</p>
        <p className="text-small text-ink-700">{STEP_TIPS[step] ?? STEP_TIPS[0]}</p>
      </Card>
      <p className="flex items-start gap-2 px-1 text-small text-ink-700">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-700" />
        No account needed. Your session and files are deleted after {LIMITS.session.ttlHours} hours,
        or sooner when you delete them.
      </p>
    </aside>
  );
}
