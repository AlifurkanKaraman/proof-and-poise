import { DEMO_LABELS } from '@proof-and-poise/shared';
import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '../../app/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { userMessage } from '../../lib/api/errors';
import { useCreateSession } from '../../lib/api/queries';

/** `/demo` creates a demo session, then redirects to its analysis (Req 1.4, 13.1, design §10). */
export default function DemoPage() {
  const navigate = useNavigate();
  const { mutate, isError, error } = useCreateSession();
  const started = useRef(false);

  const start = useCallback(() => {
    mutate('demo', {
      onSuccess: ({ sessionId }) => navigate(`/s/${sessionId}/analysis`, { replace: true }),
    });
  }, [mutate, navigate]);

  useEffect(() => {
    // StrictMode runs effects twice in development; create only one session.
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  return (
    <Page
      title="Starting the demo"
      lead={`${DEMO_LABELS.profile}: every person and company in it is invented.`}
    >
      {isError ? (
        <ErrorState
          title="We couldn't start the demo"
          message={userMessage(error)}
          action={<Button onClick={start}>Try again</Button>}
          secondaryAction={
            <Button asChild variant="secondary">
              <Link to="/">Go to the home page</Link>
            </Button>
          }
        />
      ) : (
        <p role="status" className="flex items-center gap-2 text-body text-ink-700">
          <Spinner className="text-indigo-600" />
          Creating your demo session…
        </p>
      )}
    </Page>
  );
}
