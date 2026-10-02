import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { ErrorState } from '../components/states/ErrorState';
import { Button } from '../components/ui/Button';
import NotFoundPage from './NotFoundPage';
import { Page } from './Page';

/**
 * Per-route error boundary. Never renders raw error messages, which could echo
 * user content or internals.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <Page title="Something went wrong">
      <ErrorState
        title="This screen failed to load"
        message="Your session data is safe. Try loading the screen again."
        action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        secondaryAction={
          <Button variant="secondary" asChild>
            <Link to="/">Go to the home page</Link>
          </Button>
        }
      />
    </Page>
  );
}
