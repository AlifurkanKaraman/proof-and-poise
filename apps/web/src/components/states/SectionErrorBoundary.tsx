import { Component, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { ErrorState } from './ErrorState';

interface SectionErrorBoundaryProps {
  title: string;
  message?: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  failed: boolean;
}

/**
 * Keeps a section's render failure local instead of the route boundary (Req 14.2). Shows a
 * recoverable error with "Try again", which remounts the section. Never renders the raw
 * error message, which could echo user content or internals.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  override state: SectionErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorState
        title={this.props.title}
        message={this.props.message}
        action={<Button onClick={() => this.setState({ failed: false })}>Try again</Button>}
      />
    );
  }
}
