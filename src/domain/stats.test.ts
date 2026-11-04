import { describe, expect, it } from 'vitest';
import type { Category, ColorSwatch, Item, WearLog } from './types';
import {
  categoryDistribution,
  colorDistribution,
  idleItems,
  leastWorn,
  mostWorn,
  utilization,
} from './stats';

const NOW = '2026-11-04';

function item(overrides: Partial<Item> & { id: string }): Item {
  return {
    name: '衣物',
    categoryId: 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    pattern: 'solid',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
    sceneTags: [],
    styleTags: [],
    status: 'available',
    avoidRecommend: false,
    isFavorite: false,
    wearCount: 0,
    totalCostCents: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function log(id: string, date: string, itemIds: string[]): WearLog {
  return { id, date, itemIds, items: [], createdAt: `${date}T00:00:00.000Z` };
}

describe('utilization', () => {
  it('counts items worn inside the window and ignores older wear', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    const logs = [log('l1', '2026-11-04', ['a']), log('l2', '2026-07-27', ['b'])];

    expect(utilization(items, logs, NOW)).toBeCloseTo(0.5);
  });

  it('returns zero without active items', () => {
    const items = [item({ id: 'a', status: 'retired' })];
    expect(utilization(items, [log('l1', NOW, ['a'])], NOW)).toBe(0);
  });
});

describe('idleItems', () => {
  it('does not flag recently added items', () => {
    const items = [item({ id: 'a', createdAt: '2026-10-25T00:00:00.000Z' })];
    expect(idleItems(items, NOW)).toHaveLength(0);
  });

  it('flags old items that were never worn', () => {
    const items = [item({ id: 'a', createdAt: '2026-07-20T00:00:00.000Z' })];
    expect(idleItems(items, NOW).map((entry) => entry.id)).toEqual(['a']);
  });

  it('flags items last worn long ago', () => {
    const items = [
      item({
        id: 'a',
        createdAt: '2025-01-01T00:00:00.000Z',
        lastWornAt: '2026-07-20',
        wearCount: 3,
      }),
    ];
    expect(idleItems(items, NOW).map((entry) => entry.id)).toEqual(['a']);
  });
});

describe('ranking', () => {
  const items = [
    item({ id: 'a', wearCount: 5 }),
    item({ id: 'b', wearCount: 1 }),
    item({ id: 'c', wearCount: 0, status: 'retired' }),
  ];

  it('sorts most worn first', () => {
    expect(mostWorn(items, 2).map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('sorts least worn first and ignores retired items', () => {
    expect(leastWorn(items, 2).map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('distribution', () => {
  const categories: Category[] = [
    {
      id: 'top',
      name: '上装',
      slot: 'top',
      defaultFormality: 3,
      defaultWarmth: 2,
      defaultSeasons: ['all'],
      isBuiltIn: true,
      archived: false,
      order: 1,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'shirt',
      name: '衬衫',
      parentId: 'top',
      slot: 'top',
      defaultFormality: 3,
      defaultWarmth: 2,
      defaultSeasons: ['all'],
      isBuiltIn: true,
      archived: false,
      order: 1,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];

  const colors: ColorSwatch[] = [
    {
      id: 'white',
      name: '白',
      hex: '#ffffff',
      hue: 0,
      family: 'neutral',
      isNeutral: true,
      order: 1,
    },
  ];

  it('groups leaves under their root category and excludes retired items', () => {
    const items = [
      item({ id: 'a', categoryId: 'shirt' }),
      item({ id: 'b', categoryId: 'shirt', status: 'retired' }),
    ];
    expect(categoryDistribution(items, categories)).toEqual([
      { id: 'top', label: '上装', count: 1 },
    ]);
  });

  it('counts colors without retired items', () => {
    const items = [
      item({ id: 'a', colorPrimaryId: 'white' }),
      item({ id: 'b', colorPrimaryId: 'white', status: 'retired' }),
    ];
    expect(colorDistribution(items, colors)).toEqual([
      { id: 'white', label: '白', count: 1, hex: '#ffffff' },
    ]);
  });
});
