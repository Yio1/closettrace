export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex rounded-full border border-line bg-bg p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 flex-1 rounded-full px-3 text-sm transition ${
            value === option.value
              ? 'bg-surface font-medium text-text shadow-sm'
              : 'text-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
