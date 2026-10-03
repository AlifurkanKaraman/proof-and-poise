import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionErrorBoundary } from './SectionErrorBoundary';

let shouldThrow = true;

function Flaky() {
  if (shouldThrow) throw new Error('secret internal detail');
  return <p>Section content</p>;
}

beforeEach(() => {
  shouldThrow = true;
  // React logs caught render errors; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('SectionErrorBoundary (Req 14.2)', () => {
  it('keeps a failure inside the section and recovers with Try again', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <h1>Page heading</h1>
        <SectionErrorBoundary title="Couldn't show this section" message="Try again.">
          <Flaky />
        </SectionErrorBoundary>
      </div>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't show this section");
    expect(alert).not.toHaveTextContent('secret internal detail');
    expect(screen.getByRole('heading', { name: 'Page heading' })).toBeInTheDocument();

    shouldThrow = false;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Section content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
