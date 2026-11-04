export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
}

export function BarList({ data, max }: { data: BarDatum[]; max?: number }) {
  const maxValue = max ?? Math.max(1, ...data.map((entry) => entry.value));
  return (
    <ul className="space-y-2">
      {data.map((entry) => (
        <li key={entry.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{entry.label}</span>
            <span className="tabular shrink-0 text-muted">{entry.hint ?? entry.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, (entry.value / maxValue) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
