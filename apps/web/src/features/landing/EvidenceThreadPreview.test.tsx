import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvidenceThreadPreview } from './EvidenceThreadPreview';

const linkedLines = () =>
  within(screen.getByRole('list', { name: 'Resume excerpt (fictional)' }))
    .getAllByRole('listitem')
    .filter((li) => li.hasAttribute('data-linked'));

afterEach(() => vi.restoreAllMocks());

describe('EvidenceThreadPreview', () => {
  it('labels its data as fictional', () => {
    render(<EvidenceThreadPreview />);
    expect(screen.getByText(/Amara Okonkwo \(fictional\)/)).toBeInTheDocument();
    expect(screen.getByText(/Northwind Cloud \(fictional company\)/)).toBeInTheDocument();
  });

  it('highlights linked evidence on keyboard activation with no network calls (Req 1.2)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    render(<EvidenceThreadPreview />);

    const group = screen.getByRole('radiogroup', { name: 'Job requirements' });
    const radios = within(group).getAllByRole('radio');
    // Roving tabindex: only the selected option is in the tab order.
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);

    await user.tab();
    expect(radios[0]).toHaveFocus();
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(linkedLines()).toHaveLength(1);
    expect(linkedLines()[0]).toHaveTextContent('AWS Lambda functions in Python');

    await user.keyboard('{ArrowDown}');
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(linkedLines()[0]).toHaveTextContent('designed a REST API in TypeScript');

    await user.keyboard('{ArrowDown}');
    expect(linkedLines()[0]).toHaveTextContent('Terraform');
    expect(group).toHaveAccessibleDescription(/Infrastructure as code: Weak\./);

    await user.keyboard('{End}');
    expect(radios[3]).toHaveAttribute('aria-checked', 'true');
    expect(linkedLines()).toHaveLength(0);
    expect(screen.getByText('No resume line shows this yet.')).toBeInTheDocument();

    // Arrow keys wrap around.
    await user.keyboard('{ArrowDown}');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('announces the selection in a polite live region', async () => {
    const user = userEvent.setup();
    render(<EvidenceThreadPreview />);
    await user.click(screen.getByRole('radio', { name: /Kubernetes/ }));
    const status = screen.getByText(/^Kubernetes: Missing\./);
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('No resume lines highlighted.');
  });
});
