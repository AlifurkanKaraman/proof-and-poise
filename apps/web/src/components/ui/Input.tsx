import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { controlClasses, describedBy, FieldShell } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Error message. Sets aria-invalid and links the message via aria-describedby. */
  error?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ id, label, hint, error, required, className, ref, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const invalid = Boolean(error);
  return (
    <FieldShell id={inputId} label={label} required={required} hint={hint} error={error}>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(
          hint !== undefined && `${inputId}-hint`,
          invalid && `${inputId}-error`,
        )}
        className={controlClasses(invalid, `min-h-11 ${className ?? ''}`)}
        {...props}
      />
    </FieldShell>
  );
}
