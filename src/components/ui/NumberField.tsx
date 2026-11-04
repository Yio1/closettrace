import { useId } from 'react';

export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, Number(next.toFixed(2))));
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="减少"
          onClick={() => onChange(clamp(value - step))}
          className="min-h-11 min-w-11 rounded-xl border border-line bg-surface text-lg"
        >
          −
        </button>
        <div className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-field-line bg-surface px-3">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            value={Number.isFinite(value) ? value : ''}
            min={Number.isFinite(min) ? min : undefined}
            max={Number.isFinite(max) ? max : undefined}
            step={step}
            onChange={(event) => onChange(clamp(Number(event.target.value)))}
            className="tabular w-full bg-transparent text-center text-base outline-none"
          />
          {suffix ? <span className="text-sm text-muted">{suffix}</span> : null}
        </div>
        <button
          type="button"
          aria-label="增加"
          onClick={() => onChange(clamp(value + step))}
          className="min-h-11 min-w-11 rounded-xl border border-line bg-surface text-lg"
        >
          +
        </button>
      </div>
    </div>
  );
}
