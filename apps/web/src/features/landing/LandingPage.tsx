import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { focusRingOnDark } from '../../lib/cn';

// Placeholder. The full landing page (hero, evidence-thread preview, trust sections) is task 5.
export default function LandingPage() {
  return (
    <section className="bg-ink-950 text-paper-0">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-24 sm:px-6">
        <h1 className="max-w-reading font-heading text-display font-bold">
          Turn your real experience into interview-ready evidence.
        </h1>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className={focusRingOnDark}>
            <Link to="/prepare">Prepare for a job</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className={focusRingOnDark}>
            <Link to="/demo">Try the demo</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
