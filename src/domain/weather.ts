export type TempSensitivity = 'cold' | 'normal' | 'hot';

export interface TempBand {
  targetWarmth: number;
  needsOuter: boolean;
  label: string;
}

const BANDS: Array<{ min: number; warmth: number; label: string }> = [
  { min: 30, warmth: 1.0, label: '炎热' },
  { min: 25, warmth: 1.5, label: '热' },
  { min: 19, warmth: 2.0, label: '舒适' },
  { min: 13, warmth: 3.0, label: '凉爽' },
  { min: 6, warmth: 4.0, label: '冷' },
  { min: -Infinity, warmth: 5.0, label: '寒冷' },
];

export function tempBand(tempC: number, sensitivity: TempSensitivity): TempBand {
  const band = BANDS.find((entry) => tempC >= entry.min) ?? BANDS[BANDS.length - 1];
  const shift = sensitivity === 'cold' ? 0.5 : sensitivity === 'hot' ? -0.5 : 0;
  const targetWarmth = Math.min(5, Math.max(1, band.warmth + shift));
  return { targetWarmth, needsOuter: tempC <= 12, label: band.label };
}
