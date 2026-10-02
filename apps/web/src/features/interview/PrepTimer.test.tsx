import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrepTimer } from './PrepTimer';

describe('PrepTimer', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('counts down from 30 seconds and completes without auto-submitting', () => {
    render(<PrepTimer onHide={() => {}} />);
    expect(screen.getByText('0:30')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.getByText('0:25')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(30_000));
    expect(screen.getByText('Preparation complete')).toBeInTheDocument();
  });

  it('pauses and resumes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PrepTimer onHide={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Pause timer' }));
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.getByText('0:30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume timer' })).toBeInTheDocument();
  });

  it('can be hidden', async () => {
    const onHide = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PrepTimer onHide={onHide} />);
    await user.click(screen.getByRole('button', { name: 'Hide timer' }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
