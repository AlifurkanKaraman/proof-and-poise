import { Link, Outlet } from 'react-router';
import { cn, focusRing, focusRingOnDark } from '../lib/cn';

/** App frame: skip link, dark header, main landmark, footer. Full navigation arrives in task 5. */
export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className={cn(
          'sr-only rounded-md bg-paper-0 px-4 py-2 text-ink-950 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50',
          focusRing,
        )}
      >
        Skip to content
      </a>
      <header className="bg-ink-950 text-paper-0">
        <div className="mx-auto flex min-h-16 max-w-content items-center justify-between px-4 sm:px-6">
          <Link to="/" className={cn('rounded-sm font-heading text-h4 font-bold', focusRingOnDark)}>
            Proof &amp; Poise
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="bg-ink-950 text-paper-0">
        <div className="mx-auto flex max-w-content flex-wrap gap-6 px-4 py-8 text-small sm:px-6">
          <Link
            to="/privacy"
            className={cn('rounded-sm underline-offset-4 hover:underline', focusRingOnDark)}
          >
            Privacy
          </Link>
          <Link
            to="/ethics"
            className={cn('rounded-sm underline-offset-4 hover:underline', focusRingOnDark)}
          >
            Ethical AI
          </Link>
        </div>
      </footer>
    </div>
  );
}
