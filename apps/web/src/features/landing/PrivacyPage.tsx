import type { ReactNode } from 'react';
import { Page } from '../../app/Page';

/**
 * Privacy page (Req 15.8): what is stored, where, for how long, and how to delete it.
 * Retention facts mirror the spec: DynamoDB TTL 24 h (Req 2.4), S3 1-day lifecycle
 * (Req 4.2, 10.6), CloudWatch logs 14 days (design §2), rate-limit counters 2 h (design §5).
 */
export default function PrivacyPage() {
  return (
    <Page
      title="Privacy"
      lead="Proof & Poise works without an account or email. Here is exactly what we keep, where, for how long, and how to remove it."
    >
      <div className="flex max-w-reading flex-col gap-10">
        <Section title="What we store">
          <ul className="list-disc space-y-2 pl-6">
            <li>The resume text, job description, company, role, and interview type you enter.</li>
            <li>
              The results of your session: the evidence map, your decisions on recommendations, any
              experience you confirm, your interview answers, their feedback, and your report.
            </li>
            <li>
              A one-way hash of your session token, never the token itself. The token stays in your
              browser tab (session storage), not in cookies or local storage.
            </li>
            <li>
              A salted hash of your IP address, never the address itself, used only to limit how
              many sessions can be created per hour.
            </li>
            <li>
              Uploaded resume PDFs and interview recordings, only briefly while they are processed.
            </li>
          </ul>
          <p>
            Application logs record request metadata only (request ID, route, status, timing, error
            code, and token counts). They never contain your resume, job description, answers,
            transcripts, or AI prompts and responses.
          </p>
        </Section>

        <Section title="Where it is stored">
          <p>
            Everything is stored in Amazon Web Services in the US East (N. Virginia) region
            (us-east-1). Session data lives in an encrypted Amazon DynamoDB table. Uploaded files
            live in a private, encrypted Amazon S3 bucket that blocks all public access and accepts
            only encrypted (TLS) connections. Text is analyzed by Amazon Bedrock, called only from
            our server, never from your browser. This version takes typed answers only; it doesn't
            record or transcribe audio. Bedrock uses a US cross-region inference profile, so a
            request may be processed in another AWS region in the United States.
          </p>
        </Section>

        <Section title="How long we keep it">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Session data expires 24 hours after the session is created and is then removed
              automatically by DynamoDB time-to-live.
            </li>
            <li>
              Resume PDFs are deleted right after text extraction, whether it succeeds or fails.
            </li>
            <li>
              As a safety net, any uploaded file or transcript left in storage expires after 1 day.
            </li>
            <li>Rate-limit counters based on the IP hash expire after 2 hours.</li>
            <li>Application logs, which contain no personal content, are kept for 14 days.</li>
          </ul>
        </Section>

        <Section title="How to delete it">
          <p>
            Select &ldquo;Delete my data&rdquo; in your session. It deletes all of your session
            records and any related files immediately, and your session token stops working. If you
            do nothing, everything expires on the schedule above. Closing the browser tab removes
            the session token from your device.
          </p>
        </Section>

        <Section title="Demo data">
          <p>
            The public demo uses a fictional candidate and a fictional company. Do not enter
            personal information into the demo.
          </p>
        </Section>
      </div>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-body text-ink-700">
      <h2 className="text-h3 font-bold text-ink-950">{title}</h2>
      {children}
    </section>
  );
}
