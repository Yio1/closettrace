export function cpw(totalCostCents: number, wearCount: number): number | null {
  if (wearCount <= 0) return null;
  return Math.round(totalCostCents / wearCount);
}
