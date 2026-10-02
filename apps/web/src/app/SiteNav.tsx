import { Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { Button } from '../components/ui/Button';
import { cn, focusRingOnDark } from '../lib/cn';

const links = [
  { to: '/demo', label: 'Try the demo' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/ethics', label: 'Ethical AI' },
] as const;

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center rounded-sm px-2 text-small font-medium text-line-200 hover:text-paper-0',
    isActive && 'text-paper-0 underline underline-offset-4',
    focusRingOnDark,
  );

/**
 * Responsive site navigation (Req 1.3). At ≥768px (`md`) links sit inline. Below that they
 * collapse behind a disclosure button (aria-expanded/aria-controls); Escape closes the menu and
 * returns focus to the toggle.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <nav aria-label="Main" className="flex items-center">
      <ul className="hidden items-center gap-4 md:flex">
        {links.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          </li>
        ))}
        <li>
          <Button asChild size="sm" className={focusRingOnDark}>
            <Link to="/prepare">Prepare for a job</Link>
          </Button>
        </li>
      </ul>

      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-small font-medium text-paper-0 hover:bg-ink-900 md:hidden',
          focusRingOnDark,
        )}
      >
        {open ? (
          <X aria-hidden="true" className="size-5" />
        ) : (
          <Menu aria-hidden="true" className="size-5" />
        )}
        Menu
      </button>

      <div
        id={menuId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 border-t border-ink-900 bg-ink-950 px-4 pb-6 shadow-md sm:px-6 md:hidden"
      >
        <ul className="flex flex-col gap-1 pt-2">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} className={linkClass} onClick={close}>
                {l.label}
              </NavLink>
            </li>
          ))}
          <li className="pt-2">
            <Button asChild className={cn('w-full', focusRingOnDark)}>
              <Link to="/prepare" onClick={close}>
                Prepare for a job
              </Link>
            </Button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
