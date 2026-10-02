import { Info } from 'lucide-react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router';
import { loadSession } from '../lib/session';

/** Location state set when a guarded route redirects home. */
export interface RedirectNoticeState {
  notice: 'session_missing';
}

export const SESSION_MISSING_MESSAGE =
  'Your session has ended or is not available in this tab. Start a new one to continue.';

const isNoticeState = (s: unknown): s is RedirectNoticeState =>
  typeof s === 'object' && s !== null && (s as { notice?: unknown }).notice === 'session_missing';

/**
 * Guard for `/s/:id/*` (design §10). Without a stored token for this session ID, redirect
 * to `/` with a message. The token lives in sessionStorage, so a reload in the same tab
 * keeps the user in place (Req 2.3, 2.6).
 */
export function RequireSession() {
  const { id } = useParams();
  const session = loadSession();
  if (!session || session.sessionId !== id) {
    const state: RedirectNoticeState = { notice: 'session_missing' };
    return <Navigate to="/" replace state={state} />;
  }
  return <Outlet />;
}

/** Shows the guard's message on the page it redirected to. Cleared by the next navigation. */
export function RedirectNotice() {
  const { state } = useLocation();
  if (!isNoticeState(state)) return null;
  return (
    <div role="status" className="border-b border-line-200 bg-indigo-50">
      <p className="mx-auto flex max-w-content items-start gap-2 px-4 py-3 text-small text-ink-950 sm:px-6">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-indigo-700" />
        {SESSION_MISSING_MESSAGE}
      </p>
    </div>
  );
}
