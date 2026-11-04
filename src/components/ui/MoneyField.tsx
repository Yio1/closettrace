import { useEffect, useId, useState } from 'react';
import { parseYuanToCents } from '../../domain/money';

export function MoneyField({
  label,
  valueCents,
  onChange,
  error,
}: {
  label: string;
  valueCents: number | null;
  onChange: (cents: number) => void;
  error?: string;
}) {
  const id = useId();
  const [text, setText] = useState(valueCents == null ? '' : formatInput(valueCents));

  useEffect(() => {
    setText(valueCents == null ? '' : formatInput(valueCents));
  }, [valueCents]);

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex items-center rounded-xl border border-field-line bg-surface px-3">
        <span className="text-muted">¥</span>
        <input
          id={id}
          inputMode="decimal"
          value={text}
          placeholder="0"
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            if (next === '') {
              onChange(0);
              return;
            }
            const cents = parseYuanToCents(next);
            if (cents !== null) onChange(cents);
          }}
          className="tabular min-h-11 w-full bg-transparent px-2 text-base outline-none"
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error ? <span className="mt-1 block text-xs text-danger-text">{error}</span> : null}
    </label>
  );
}

function formatInput(cents: number) {
  return (cents / 100).toString();
}
