import {
  ClipboardCheck,
  FileSearch,
  Gauge,
  Link2,
  ListChecks,
  MessageSquareText,
  Scale,
  ShieldCheck,
  Trash2,
  UserX,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { IconTile } from '../../components/ui/IconTile';
import { cn, focusRing, focusRingOnDark } from '../../lib/cn';
import { EvidenceThreadPreview } from './EvidenceThreadPreview';

const steps: { title: string; body: string; Icon: LucideIcon }[] = [
  {
    title: 'See how your resume matches the job',
    body: 'Add a job description and your resume. Each requirement is linked to the exact resume line that proves it, or marked weak or missing, with job match and keyword match scores.',
    Icon: FileSearch,
  },
  {
    title: 'Tailor your resume, truthfully',
    body: 'Accept supported changes one at a time, list the job keywords you already prove, and confirm real experience for gaps. Nothing is added that your resume or your own words do not support. Copy or download the tailored resume.',
    Icon: ClipboardCheck,
  },
  {
    title: 'Then practice the interview',
    body: 'Answer a five-question mock interview aimed at your weakest evidence, then see an explainable readiness report.',
    Icon: MessageSquareText,
  },
];

const reassurance: { text: string; Icon: LucideIcon }[] = [
  { text: 'No account needed', Icon: UserX },
  { text: 'Fictional demo profile', Icon: FlaskConical },
  { text: 'Delete your data any time', Icon: Trash2 },
];

/** Landing page (Req 1.1–1.5). Makes no network calls until the user acts. */
export default function LandingPage() {
  return (
    <>
      <section aria-labelledby="hero-title" className="bg-ink-950 text-paper-0">
        <div className="mx-auto grid max-w-content items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-24">
          <div className="flex flex-col gap-6">
            <h1
              id="hero-title"
              className="font-heading text-display font-extrabold tracking-tight text-balance"
            >
              Tailor your resume to the job, using only what you can prove.
            </h1>
            <p className="max-w-[60ch] text-body text-line-200">
              Proof &amp; Poise shows which job requirements and keywords your resume already
              proves, helps you tailor it for this job without inventing anything, and then lets you
              practice defending it in a mock interview.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className={focusRingOnDark}>
                <Link to="/prepare">Prepare for a job</Link>
              </Button>
              {/* Req 1.4: demo session creation wired in task 6 */}
              <Button
                asChild
                size="lg"
                variant="secondary"
                className={cn(
                  'border-ink-800 bg-ink-900 text-paper-0 hover:bg-ink-800',
                  focusRingOnDark,
                )}
              >
                <Link to="/demo">Try the demo</Link>
              </Button>
            </div>
            <ul className="flex flex-col gap-2 text-small text-line-200 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {reassurance.map(({ text, Icon }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="size-4 text-line-300" strokeWidth={1.75} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <EvidenceThreadPreview />
        </div>
      </section>

      <section aria-labelledby="steps-title" className="bg-paper-50">
        <div className="mx-auto flex max-w-content flex-col gap-10 px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex max-w-[60ch] flex-col gap-2">
            <h2 id="steps-title" className="text-h2 font-bold text-ink-950">
              How it works
            </h2>
            <p className="text-body text-ink-700">
              Three steps, in order. You stay in control of every change that touches your resume.
            </p>
          </div>
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map(({ title, body, Icon }, index) => (
              <li key={title} className="relative flex gap-4 md:flex-col md:gap-5">
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-12 -bottom-10 left-5 w-px bg-line-300 md:top-5 md:right-[-2rem] md:bottom-auto md:left-12 md:h-px md:w-auto"
                  />
                )}
                <IconTile icon={Icon} tone="indigo" size="md" className="relative z-10" />
                <div className="flex flex-col gap-2">
                  <p className="text-small font-semibold text-indigo-700">Step {index + 1}</p>
                  <h3 className="text-h4 font-bold text-ink-950">{title}</h3>
                  <p className="max-w-[48ch] text-small text-ink-700">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="score-title" className="border-y border-line-200 bg-paper-0">
        <div className="mx-auto grid max-w-content items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div className="flex flex-col gap-4">
            <h2 id="score-title" className="text-h2 font-bold text-ink-950">
              A readiness score you can explain
            </h2>
            <p className="max-w-[56ch] text-body text-ink-700">
              Your report combines how you answered with how well your resume matches the job. Both
              parts, and the formula behind them, are shown, so you know what to work on next.
            </p>
            <ul className="flex flex-col gap-3 text-small text-ink-700">
              <li className="flex items-start gap-3">
                <IconTile icon={ListChecks} tone="indigo" size="sm" />
                <span className="pt-1">Three prioritized actions to improve your readiness.</span>
              </li>
              <li className="flex items-start gap-3">
                <IconTile icon={MessageSquareText} tone="indigo" size="sm" />
                <span className="pt-1">
                  Feedback on each answer, with a stronger outline you can practice again.
                </span>
              </li>
            </ul>
          </div>
          <Card tone="raised" padding="lg" className="flex flex-col gap-5">
            <p className="text-small font-semibold text-ink-950">How the score is built</p>
            <WeightRow
              Icon={MessageSquareText}
              label="Interview performance"
              percent={70}
              barClass="bg-indigo-600"
            />
            <WeightRow
              Icon={FileSearch}
              label="Resume match to the job"
              percent={30}
              barClass="bg-emerald-700"
            />
            <div className="flex items-center gap-3 rounded-lg bg-ink-100 p-3">
              <IconTile icon={Gauge} tone="ink" size="md" />
              <p className="text-small text-ink-700">
                <span className="font-semibold text-ink-950">Readiness</span> is a weighted
                combination of the two, calculated by documented formulas rather than by the AI.
              </p>
            </div>
          </Card>
        </div>
      </section>

      <section aria-labelledby="trust-title" className="bg-paper-50">
        <div className="mx-auto flex max-w-content flex-col gap-10 px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="trust-title" className="text-h2 font-bold text-ink-950">
            Built to be trusted
          </h2>
          <div className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line-200">
            <TrustColumn Icon={Link2} title="Grounded in your evidence">
              Every quote is checked word for word against your resume. Scores come from documented
              formulas, not from the AI, and each one shows how it was calculated.
            </TrustColumn>
            <TrustColumn
              Icon={ShieldCheck}
              title="Private and short-lived"
              link={{ to: '/privacy', label: 'Read the privacy details' }}
            >
              No account, no email. Your session expires within 24 hours, uploaded files are deleted
              after processing, and you can delete everything yourself at any time.
            </TrustColumn>
            <TrustColumn
              Icon={Scale}
              title="Honest, fair AI"
              link={{ to: '/ethics', label: 'Read our ethical AI approach' }}
            >
              The AI never invents experience, and you approve every change. Feedback judges what
              you say, never your accent, fluency, or personality.
            </TrustColumn>
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="bg-paper-50 pb-16 lg:pb-20">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <Card
            tone="dark"
            padding="lg"
            className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex max-w-[52ch] flex-col gap-2">
              <h2 id="cta-title" className="text-h3 font-bold">
                See what your resume already proves.
              </h2>
              <p className="text-small text-line-200">
                It takes a job description and your resume. You can try a fictional profile first,
                with nothing to sign up for.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className={focusRingOnDark}>
                <Link to="/prepare">Start with your resume</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className={cn(
                  'border-ink-800 bg-ink-900 text-paper-0 hover:bg-ink-800',
                  focusRingOnDark,
                )}
              >
                <Link to="/demo">Explore a sample first</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}

function WeightRow({
  Icon,
  label,
  percent,
  barClass,
}: {
  Icon: LucideIcon;
  label: string;
  percent: number;
  barClass: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-small">
        <span className="flex items-center gap-2 font-medium text-ink-950">
          <Icon aria-hidden="true" className="size-4 text-ink-700" strokeWidth={1.75} />
          {label}
        </span>
        <span className="font-semibold text-ink-950">{percent}%</span>
      </div>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TrustColumn({
  Icon,
  title,
  link,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  link?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 md:px-8 md:first:pl-0 md:last:pr-0">
      <IconTile icon={Icon} tone="emerald" size="md" />
      <h3 className="text-h4 font-bold text-ink-950">{title}</h3>
      <p className="max-w-[48ch] text-small text-ink-700">{children}</p>
      {link && (
        <Link
          to={link.to}
          className={cn(
            'mt-auto inline-flex min-h-11 items-center rounded-sm text-small font-semibold text-indigo-700 underline underline-offset-4 hover:text-indigo-600',
            focusRing,
          )}
        >
          {link.label}
        </Link>
      )}
    </article>
  );
}
