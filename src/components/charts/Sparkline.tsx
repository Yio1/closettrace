export function Sparkline({
  values,
  width = 120,
  height = 32,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label: string;
}) {
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const span = max - min || 1;
  const points =
    values.length >= 2
      ? values.map((value, index) => {
          const x = (index / (values.length - 1)) * width;
          const y = height - 2 - ((value - min) / span) * (height - 4);
          return [x, y] as const;
        })
      : [];

  const path = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-accent-text"
    >
      {points.length >= 2 ? (
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
