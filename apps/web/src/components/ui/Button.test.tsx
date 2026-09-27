import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to type="button" and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('loading sets aria-busy, disables the button and blocks clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Saving' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    // Spinner is decorative.
    expect(btn.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not set aria-busy when not loading', () => {
    render(<Button>Idle</Button>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
  });

  it('asChild renders the child element with button styles', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/prepare">Prepare</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Prepare' });
    expect(link).toHaveAttribute('href', '/prepare');
    expect(link.className).toContain('border-line-200');
  });
});
