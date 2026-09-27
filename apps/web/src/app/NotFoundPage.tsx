import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '../components/states/EmptyState';
import { Button } from '../components/ui/Button';
import { Page } from './Page';

export default function NotFoundPage() {
  return (
    <Page title="Page not found">
      <EmptyState
        icon={SearchX}
        title="We couldn't find that page"
        description="The link may be out of date, or the session may have expired."
        action={
          <Button asChild>
            <Link to="/">Go to the home page</Link>
          </Button>
        }
      />
    </Page>
  );
}
