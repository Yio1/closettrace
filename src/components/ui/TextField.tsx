import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

export function TextField({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        id={inputId}
        className={`min-h-11 w-full rounded-xl border bg-surface px-3 text-base outline-none focus:border-accent ${
          error ? 'border-danger' : 'border-field-line'
        } ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-hint`} className="mt-1 block text-xs text-danger-text">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
