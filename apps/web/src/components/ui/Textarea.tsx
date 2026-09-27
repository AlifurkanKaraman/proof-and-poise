import {
  useId,
  useState,
  type ChangeEvent,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';
import { controlClasses, describedBy, FieldShell } from './Field';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Minimum length shown in the counter (not enforced here; validation owns that). */
  minLength?: number;
  /** Maximum length; enables the character counter. */
  maxLength?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  id,
  label,
  hint,
  error,
  required,
  className,
  minLength,
  maxLength,
  value,
  defaultValue,
  onChange,
  ref,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const invalid = Boolean(error);
  const [uncontrolledLength, setUncontrolledLength] = useState(
    typeof defaultValue === 'string' ? defaultValue.length : 0,
  );
  const length = typeof value === 'string' ? value.length : uncontrolledLength;
  const counterId = `${fieldId}-count`;
  const showCounter = maxLength !== undefined;
  const belowMin = minLength !== undefined && length > 0 && length < minLength;

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setUncontrolledLength(e.target.value.length);
    onChange?.(e);
  };

  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      hint={hint}
      error={error}
      footer={
        showCounter && (
          <p
            id={counterId}
            className={cn(
              'shrink-0 text-caption tabular-nums',
              length > maxLength ? 'text-red-700' : 'text-ink-700',
            )}
          >
            {length.toLocaleString('en-US')} / {maxLength.toLocaleString('en-US')} characters
            {belowMin && <span> (minimum {minLength.toLocaleString('en-US')})</span>}
          </p>
        )
      }
    >
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(
          hint !== undefined && `${fieldId}-hint`,
          invalid && `${fieldId}-error`,
          showCounter && counterId,
        )}
        className={controlClasses(invalid, cn('min-h-32 resize-y', className))}
        {...props}
      />
    </FieldShell>
  );
}
