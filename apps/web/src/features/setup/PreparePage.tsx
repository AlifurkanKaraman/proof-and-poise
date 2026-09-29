import { Briefcase, FileText } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../app/Page';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Stepper } from '../../components/ui/Stepper';
import { Textarea } from '../../components/ui/Textarea';
import { useCreateSession, useStartAnalysis } from '../../lib/api/queries';

const RESUME_MIN = 200;
const RESUME_MAX = 12_000;
const JOB_MIN = 100;
const JOB_MAX = 8_000;

interface ResumeData {
  resumeText: string;
}

interface JobData {
  company: string;
  role: string;
  jobDescription: string;
}

export default function PreparePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [resumeData, setResumeData] = useState<ResumeData>({ resumeText: '' });
  const [jobData, setJobData] = useState<JobData>({
    company: '',
    role: '',
    jobDescription: '',
  });

  const createSession = useCreateSession();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startAnalysis = useStartAnalysis(sessionId ?? '');

  const isResumeValid =
    resumeData.resumeText.length >= RESUME_MIN && resumeData.resumeText.length <= RESUME_MAX;

  const isJobValid =
    jobData.company.trim().length > 0 &&
    jobData.role.trim().length > 0 &&
    jobData.jobDescription.length >= JOB_MIN &&
    jobData.jobDescription.length <= JOB_MAX;

  const handleResumeNext = async () => {
    if (!isResumeValid) return;
    try {
      const session = await createSession.mutateAsync('standard');
      setSessionId(session.sessionId);
      setStep(1);
    } catch {
      // Error is handled by React Query error state
    }
  };

  const handleJobSubmit = async () => {
    if (!isJobValid || !sessionId) return;
    try {
      await startAnalysis.mutateAsync({
        resume: resumeData.resumeText,
        job: jobData.jobDescription,
        company: jobData.company,
        role: jobData.role,
      });
      navigate(`/s/${sessionId}/analysis`);
    } catch {
      // Error is handled by React Query error state
    }
  };

  const isSubmitting = createSession.isPending || startAnalysis.isPending;

  return (
    <Page title="Prepare for a job" lead="Upload your resume and job description to get started.">
      <Stepper steps={['Resume', 'Job Details']} current={step} className="mb-6" />

      {step === 0 && (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="size-5 text-indigo-600" />
              <h2 className="text-h3 font-semibold text-ink-950">Your Resume</h2>
            </div>
            <Textarea
              label="Resume Text"
              hint="Paste your resume or a summary of your relevant experience. This is analyzed privately and never shared."
              value={resumeData.resumeText}
              onChange={(e) => setResumeData({ resumeText: e.target.value })}
              minLength={RESUME_MIN}
              maxLength={RESUME_MAX}
              required
              rows={12}
              placeholder="Paste your resume here..."
              error={
                resumeData.resumeText.length > 0 && resumeData.resumeText.length < RESUME_MIN
                  ? `Resume must be at least ${RESUME_MIN} characters.`
                  : undefined
              }
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button onClick={() => navigate('/')} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleResumeNext} disabled={!isResumeValid || isSubmitting}>
              {isSubmitting ? 'Creating session...' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Briefcase className="size-5 text-indigo-600" />
              <h2 className="text-h3 font-semibold text-ink-950">Job Details</h2>
            </div>

            <div className="flex flex-col gap-4">
              <Input
                label="Company Name"
                value={jobData.company}
                onChange={(e) => setJobData({ ...jobData, company: e.target.value })}
                required
                placeholder="e.g., Acme Corp"
              />

              <Input
                label="Job Title"
                value={jobData.role}
                onChange={(e) => setJobData({ ...jobData, role: e.target.value })}
                required
                placeholder="e.g., Senior Software Engineer"
              />

              <Textarea
                label="Job Description"
                hint="Paste the full job posting or key requirements. We'll analyze how well your background matches."
                value={jobData.jobDescription}
                onChange={(e) => setJobData({ ...jobData, jobDescription: e.target.value })}
                minLength={JOB_MIN}
                maxLength={JOB_MAX}
                required
                rows={10}
                placeholder="Paste the job description here..."
                error={
                  jobData.jobDescription.length > 0 && jobData.jobDescription.length < JOB_MIN
                    ? `Job description must be at least ${JOB_MIN} characters.`
                    : undefined
                }
              />
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button onClick={() => setStep(0)} variant="secondary" disabled={isSubmitting}>
              Back
            </Button>
            <Button onClick={handleJobSubmit} disabled={!isJobValid || isSubmitting}>
              {isSubmitting ? 'Starting analysis...' : 'Start Analysis'}
            </Button>
          </div>
        </div>
      )}
    </Page>
  );
}
