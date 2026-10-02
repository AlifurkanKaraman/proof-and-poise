import {
  ClipboardCheck,
  FileSearch,
  Link2,
  MessageSquareText,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { cn, focusRing, focusRingOnDark } from '../../lib/cn';
import { EvidenceThreadPreview } from './EvidenceThreadPreview';

const steps: { title: string; body: string; Icon: LucideIcon }[] = [
  {
    title: 'Map your evidence',
    body: 'Paste a job description and your resume. Each requirement is linked to the exact resume line that proves it, or marked weak or missing.',
    Icon: FileSearch,
  },
  {
    title: 'Strengthen it truthfully',
    body: 'Review suggested changes one at a time. Nothing is added that your resume or your own confirmation does not support.',
    Icon: ClipboardCheck,
  },
  {
    title: 'Practice and get your report',
    body: 'Answer a five-question mock interview aimed at your weakest evidence, typed or spoken, then see an explainable readiness report.',
    Icon: MessageSquareText,
  },
];

/** Landing page (Req 1.1–1.5). Makes no network calls until the user acts. */
export default function LandingPage() {
  return (
    <>
      <section aria-labelledby="hero-title" className="bg-ink-950 text-paper-0">
        <div className="mx-auto grid max-w-content items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="flex flex-col gap-6">
            <h1 id="hero-title" className="font-heading text-display font-bold">
              Turn your real experience into interview-ready evidence.
            </h1>
            <p className="max-w-reading text-body text-line-200">
              Job descriptions ask for proof, and good experience often gets lost in a resume. Proof
              &amp; Poise shows which requirements your resume already proves, helps you fix the
              gaps honestly, and lets you practice defending them in a mock interview.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className={focusRingOnDark}>
                <Link to="/prepare">Prepare for a job</Link>
              </Button>
              {/* Req 1.4: demo session creation wired in task 6 */}
              <Button asChild size="lg" variant="secondary" className={focusRingOnDark}>
                <Link to="/demo">Try the demo</Link>
              </Button>
            </div>
            <p className="text-small text-line-200">
              No account needed. The demo uses a fictional profile.
            </p>
          </div>
          <EvidenceThreadPreview />
        </div>
      </section>

      <section aria-labelledby="steps-title" className="bg-paper-50">
        <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-16 sm:px-6">
          <h2 id="steps-title" className="text-h2 font-bold text-ink-950">
            How it works
          </h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map(({ title, body, Icon }, index) => (
              <li
                key={title}
                className="flex flex-col gap-3 rounded-lg border border-line-200 bg-paper-0 p-6"
              >
                <span className="flex items-center gap-3 text-indigo-700">
                  <Icon aria-hidden="true" className="size-6" />
                  <span className="text-small font-semibold">Step {index + 1}</span>
                </span>
                <h3 className="text-h4 font-bold text-ink-950">{title}</h3>
                <p className="text-small text-ink-700">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="trust-title" className="border-t border-line-200 bg-paper-50">
        <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-16 sm:px-6">
          <h2 id="trust-title" className="text-h2 font-bold text-ink-950">
            Built to be trusted
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <TrustCard Icon={Link2} title="Grounded in your evidence">
              Every quote is checked word for word against your resume. Scores come from documented
              formulas, not from the AI, and each one shows how it was calculated.
            </TrustCard>
            <TrustCard
              Icon={ShieldCheck}
              title="Private and short-lived"
              link={{ to: '/privacy', label: 'Read the privacy details' }}
            >
              No account, no email. Your session expires within 24 hours, uploaded files are deleted
              after processing, and you can delete everything yourself at any time.
            </TrustCard>
            <TrustCard
              Icon={Scale}
              title="Honest, fair AI"
              link={{ to: '/ethics', label: 'Read our ethical AI approach' }}
            >
              The AI never invents experience, and you approve every change. Feedback judges what
              you say, never your accent, fluency, or personality.
            </TrustCard>
          </div>
        </div>
      </section>
    </>
  );
}

function TrustCard({
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
    <article className="flex flex-col gap-3 rounded-lg border border-line-200 bg-paper-0 p-6">
      <Icon aria-hidden="true" className="size-6 text-emerald-700" />
      <h3 className="text-h4 font-bold text-ink-950">{title}</h3>
      <p className="text-small text-ink-700">{children}</p>
      {link && (
        <Link
          to={link.to}
          className={cn(
            'mt-auto inline-flex min-h-11 items-center rounded-sm text-small font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-600',
            focusRing,
          )}
        >
          {link.label}
        </Link>
      )}
    </article>
  );
}
