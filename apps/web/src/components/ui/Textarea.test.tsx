import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('counts characters as the user types (uncontrolled)', async () => {
    render(<Textarea label="Answer" maxLength={3000} />);
    const field = screen.getByLabelText('Answer');
    expect(screen.getByText('0 / 3,000 characters')).toBeInTheDocument();
    await userEvent.type(field, 'hello');
    expect(screen.getByText('5 / 3,000 characters')).toBeInTheDocument();
  });

  it('counts characters for controlled values and shows the minimum', () => {
    render(
      <Textarea label="Answer" value="abc" onChange={() => {}} minLength={20} maxLength={3000} />,
    );
    expect(screen.getByText(/3 \/ 3,000 characters/)).toHaveTextContent('(minimum 20)');
  });

  it('links hint, error and counter via aria-describedby and sets aria-invalid', () => {
    render(<Textarea label="Answer" hint="Be specific." error="Too short." maxLength={100} />);
    const field = screen.getByLabelText('Answer');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/Be specific\..*Too short\..*0 \/ 100 characters/);
  });
});

describe('Input', () => {
  it('links the error message and marks the field invalid', () => {
    render(<Input label="Target role" error="Target role is required." />);
    const field = screen.getByLabelText('Target role');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Target role is required.');
  });

  it('is valid with no describedby when there is no hint or error', () => {
    render(<Input label="Company" />);
    const field = screen.getByLabelText('Company');
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');
  });
});
