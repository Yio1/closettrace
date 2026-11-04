import type { WearLog } from './types';

export function distinctWearDates(logs: WearLog[], itemId: string): number {
  const dates = new Set<string>();
  for (const log of logs) {
    if (log.itemIds.includes(itemId)) dates.add(log.date);
  }
  return dates.size;
}
