import { describe, expect, it } from 'vitest';
import type { WearLog } from './types';
import { distinctWearDates } from './wear';

function log(date: string, itemIds: string[]): WearLog {
  return {
    id: `${date}-${itemIds.join('-')}`,
    date,
    itemIds,
    items: [],
    createdAt: `${date}T08:00:00.000Z`,
  };
}

describe('distinctWearDates', () => {
  it('counts unique dates for the given item', () => {
    const logs = [
      log('2026-11-01', ['shirt', 'trousers']),
      log('2026-11-01', ['shirt']),
      log('2026-11-02', ['shirt', 'shoes']),
      log('2026-11-03', ['trousers']),
    ];
    expect(distinctWearDates(logs, 'shirt')).toBe(2);
    expect(distinctWearDates(logs, 'trousers')).toBe(2);
  });

  it('returns zero when the item never appears', () => {
    expect(distinctWearDates([log('2026-11-01', ['shirt'])], 'coat')).toBe(0);
    expect(distinctWearDates([], 'shirt')).toBe(0);
  });
});
