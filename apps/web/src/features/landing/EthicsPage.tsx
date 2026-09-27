import type { ReactNode } from 'react';
import { Page } from '../../app/Page';

/** Ethical AI statement (Req 1.1). Mirrors the rules in Req 7, 8, 11 and design §7, §11. */
export default function EthicsPage() {
  return (
    <Page
      title="Ethical AI"
      lead="Proof & Poise uses AI to write language. It never decides your scores, and it never invents experience for you."
    >
      <div className="flex max-w-reading flex-col gap-10">
        <Section title="The AI writes words; code does the math">
          <p>
            Scores, evidence checks, follow-up decisions, and limits are fixed, documented code.
            Every score shows its formula and the inputs behind it. The AI drafts competencies,
            questions, feedback, and summaries, and everything it returns is validated before we use
            it.
          </p>
        </Section>

        <Section title="Nothing is invented">
          <p>
            Every resume quote is checked word for word against your resume, and quotes that do not
            match are discarded. Suggested changes that add a number, a percentage, an amount, or a
            skill your resume and your confirmations do not support are thrown out. Each suggestion
            is labeled, for example &ldquo;Rewording only&rdquo;, so you know what kind of change it
            is.
          </p>
        </Section>

        <Section title="You stay in control">
          <p>
            Nothing changes without your explicit approval, one suggestion at a time. We never
            rewrite your whole resume. If you have real experience your resume does not show, you
            can confirm it in your own words, and it is labeled &ldquo;Confirmed by you&rdquo;.
          </p>
        </Section>

        <Section title="Fair feedback">
          <p>
            Interview feedback judges only the content of your answer. It does not judge accent,
            fluency, non-native phrasing, or grammar that does not change the meaning. Every rating
            comes with a reason that points to what you said.
          </p>
        </Section>

        <Section title="What we never infer">
          <p>
            Proof &amp; Poise never outputs or displays guesses about your emotions, honesty,
            personality, disability, or employability. There is no place in our data for them.
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
