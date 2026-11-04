import type { ColorSwatch } from './types';

export function hueDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return Math.min(raw, 360 - raw);
}

export function colorPairScore(a: ColorSwatch, b: ColorSwatch): number {
  if (a.isNeutral && b.isNeutral) return 100;
  if (a.isNeutral !== b.isNeutral) return 92;

  const distance = hueDistance(a.hue, b.hue);
  if (a.family === b.family) {
    if (distance <= 8) return 88;
    if (distance <= 30) return 82;
  }
  if (distance >= 150 && distance <= 210) return 72;
  return 45;
}

export function outfitColorScore(colors: ColorSwatch[], patternCount: number): number {
  let base = 100;
  if (colors.length > 1) {
    let minimum = Infinity;
    let total = 0;
    let pairs = 0;
    for (let i = 0; i < colors.length; i += 1) {
      for (let j = i + 1; j < colors.length; j += 1) {
        const score = colorPairScore(colors[i], colors[j]);
        minimum = Math.min(minimum, score);
        total += score;
        pairs += 1;
      }
    }
    base = 0.6 * minimum + 0.4 * (total / pairs);
  }

  let score = (base / 100) * 30;
  if (patternCount > 1) score -= 10;
  const distinctHues = new Set(
    colors.filter((color) => !color.isNeutral).map((color) => Math.round(color.hue)),
  );
  if (distinctHues.size > 3) score -= 8;

  return Math.max(0, Math.min(30, Math.round(score)));
}
