import { ShieldCheck } from 'lucide-react';
import { Link, Outlet, ScrollRestoration } from 'react-router';
import { cn, focusRing, focusRingOnDark } from '../lib/cn';
import { JourneyNav } from './JourneyNav';
import { RedirectNotice } from './RequireSession';
import { SiteNav } from './SiteNav';

const footerLink = cn(
  'inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline',
  focusRingOnDark,
);

/** App frame: skip link, dark header with responsive navigation, journey bar, main, footer. */
export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* New navigations start at the top; back/forward restore the saved position. */}
      <ScrollRestoration />
      <a
        href="#main"
        className={cn(
          'sr-only rounded-md bg-paper-0 px-4 py-2 text-ink-950 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50',
          focusRing,
        )}
      >
        Skip to content
      </a>
      <header className="relative bg-ink-950 text-paper-0">
        <div className="mx-auto flex min-h-16 max-w-content items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className={cn(
              'inline-flex min-h-11 items-center gap-2.5 rounded-sm font-heading text-h4 font-bold',
              focusRingOnDark,
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-indigo-600"
            >
              <ShieldCheck className="size-[18px]" strokeWidth={2} />
            </span>
            Proof &amp; Poise
          </Link>
          <SiteNav />
        </div>
      </header>
      <JourneyNav />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <RedirectNotice />
        <Outlet />
      </main>
      <footer className="bg-ink-950 text-paper-0">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 text-small sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="max-w-reading text-line-300">
            Your experience, checked against the job. Nothing is invented, and you approve every
            change.
          </p>
          <div className="flex flex-wrap gap-6">
            <Link to="/privacy" className={footerLink}>
              Privacy
            </Link>
            <Link to="/ethics" className={footerLink}>
              Ethical AI
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
