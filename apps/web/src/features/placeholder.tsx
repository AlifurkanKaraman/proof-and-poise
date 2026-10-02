import { Construction } from 'lucide-react';
import { Link } from 'react-router';
import { Page } from '../app/Page';
import { EmptyState } from '../components/states/EmptyState';
import { Button } from '../components/ui/Button';

/** Temporary screen for routes whose UI lands in a later task. */
export function PlaceholderPage({ title, task }: { title: string; task: string }) {
  return (
    <Page title={title}>
      <EmptyState
        icon={Construction}
        title="Coming soon"
        description={`This screen is built in ${task}.`}
        action={
          <Button asChild variant="secondary">
            <Link to="/">Go to the home page</Link>
          </Button>
        }
      />
    </Page>
  );
}
