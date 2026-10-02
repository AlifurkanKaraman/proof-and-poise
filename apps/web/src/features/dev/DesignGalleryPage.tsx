import { useState, type ReactNode } from 'react';
import { Page } from '../../app/Page';
import {
  EmptyState,
  ErrorState,
  LoadingStage,
  Skeleton,
  SuccessState,
} from '../../components/states';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Disclosure,
  Input,
  ScoreRing,
  SegmentedProgress,
  StatusBadge,
  Stepper,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '../../components/ui';
import type { EvidenceStatus } from '../../components/ui/StatusBadge';
import { colors, fontSize, radius, shadow } from '../../design/tokens';

const statuses: EvidenceStatus[] = ['verified', 'confirmed', 'weak', 'missing', 'rewording'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line-200 bg-paper-0 p-6">
      <h2 className="text-h3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Internal token and component gallery. Only routed in dev builds. */
export default function DesignGalleryPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(1);

  return (
    <Page title="Design system" lead="Internal gallery of tokens and primitives (dev builds only).">
      <Section title="Color tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(colors).flatMap(([family, shades]) =>
            Object.entries(shades).map(([shade, value]) => (
              <li key={`${family}-${shade}`} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-10 rounded-md border border-line-200"
                  style={{ backgroundColor: value }}
                />
                <span className="text-caption">
                  <span className="block font-medium text-ink-950">
                    {family}-{shade}
                  </span>
                  <span className="text-ink-700">{value}</span>
                </span>
              </li>
            )),
          )}
        </ul>
      </Section>

      <Section title="Type scale">
        {Object.entries(fontSize).map(([name, [size]]) => (
          <p key={name} style={{ fontSize: size }} className="font-heading text-ink-950">
            {name} <span className="font-body text-caption text-ink-700">({size})</span>
          </p>
        ))}
      </Section>

      <Section title="Radius and shadow">
        <div className="flex flex-wrap gap-4">
          {Object.entries(radius).map(([name, value]) => (
            <div
              key={name}
              className="flex size-20 items-center justify-center border border-line-200 bg-paper-50 text-caption"
              style={{ borderRadius: value }}
            >
              {name}
            </div>
          ))}
          {Object.entries(shadow).map(([name, value]) => (
            <div
              key={name}
              className="flex size-20 items-center justify-center rounded-md bg-paper-0 text-caption"
              style={{ boxShadow: value }}
            >
              shadow-{name}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              window.setTimeout(() => setLoading(false), 1500);
            }}
          >
            {loading ? 'Saving…' : 'Click to load'}
          </Button>
        </div>
      </Section>

      <Section title="Inputs">
        <Input label="Target role" required hint="Up to 120 characters." maxLength={120} />
        <Input label="Company" error="Company name must be 100 characters or fewer." />
        <Textarea label="Job description" required minLength={200} maxLength={8000} />
      </Section>

      <Section title="Status badges">
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Scores and progress">
        <div className="flex flex-wrap gap-6">
          <ScoreRing value={72} label="Job Match" />
          <ScoreRing value={88} label="Evidence Coverage" tone="emerald" />
          <ScoreRing value={41} label="Keyword Coverage" tone="amber" />
        </div>
        <SegmentedProgress
          summary="Question 3 of 5"
          segments={[
            { id: '1', label: 'Question 1', state: 'complete' },
            { id: '2', label: 'Question 2', state: 'complete' },
            { id: '2a', label: 'Follow-up to question 2', state: 'complete', subStep: true },
            { id: '3', label: 'Question 3', state: 'current' },
            { id: '4', label: 'Question 4', state: 'upcoming' },
            { id: '5', label: 'Question 5', state: 'upcoming' },
          ]}
        />
        <Stepper steps={['Resume', 'Target job', 'Review and analyze']} current={1} />
      </Section>

      <Section title="Tabs, disclosure, dialog, toast">
        <Tabs defaultValue="overview">
          <TabsList aria-label="Analysis sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="competencies">Competencies</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel.</TabsContent>
          <TabsContent value="competencies">Competencies panel.</TabsContent>
        </Tabs>
        <Disclosure summary="How is this calculated?">
          Job Match = 100 × Σ(importance × strength) / Σ(importance).
        </Disclosure>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent title="Confirm your experience" description="Describe what you did.">
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                title: '+6 Job Match',
                description: 'You confirmed Kubernetes experience.',
                tone: 'success',
              })
            }
          >
            Show toast
          </Button>
        </div>
      </Section>

      <Section title="States">
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <LoadingStage
          title="Analyzing your resume"
          stages={[
            'Reading resume',
            'Mapping competencies',
            'Checking evidence',
            'Drafting recommendations',
          ]}
          current={stage}
        />
        <Button variant="secondary" onClick={() => setStage((s) => (s + 1) % 5)}>
          Advance stage
        </Button>
        <EmptyState
          title="No recommendations yet"
          description="Your resume already covers this job well."
        />
        <ErrorState
          title="We couldn't read that PDF"
          message="It may be scanned. Paste the text instead."
          action={<Button onClick={() => toast.show({ title: 'Retry pressed' })}>Retry</Button>}
        />
        <SuccessState title="Analysis ready" message="8 competencies mapped." />
      </Section>
    </Page>
  );
}
