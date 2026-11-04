import { describe, expect, it } from 'vitest';
import type { Item } from './types';
import { filterItems } from './itemFilter';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: '米白衬衫',
    categoryId: 'builtin:cat:shirt',
    brand: 'Uniqlo',
    colorPrimaryId: 'builtin:color:off-white',
    pattern: 'solid',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
    sceneTags: ['builtin:scene:commute'],
    styleTags: ['builtin:style:minimal'],
    status: 'available',
    avoidRecommend: false,
    isFavorite: false,
    wearCount: 0,
    totalCostCents: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterItems', () => {
  it('matches Chinese substrings in name, brand, note, and tags', () => {
    const items = [
      makeItem({ id: 'a', name: '藏青风衣', brand: undefined }),
      makeItem({ id: 'b', name: '白衬衫', brand: 'Uniqlo' }),
      makeItem({ id: 'c', name: '牛仔裤', note: '版型偏宽松', brand: undefined }),
      makeItem({ id: 'd', name: 'T 恤', material: '纯棉', brand: undefined }),
    ];
    expect(filterItems(items, { query: '风衣' }).map((item) => item.id)).toEqual(['a']);
    expect(filterItems(items, { query: 'uniqlo' }).map((item) => item.id)).toEqual(['b']);
    expect(filterItems(items, { query: '宽松' }).map((item) => item.id)).toEqual(['c']);
    expect(filterItems(items, { query: '纯棉' }).map((item) => item.id)).toEqual(['d']);
  });

  it('combines category and status filters', () => {
    const items = [
      makeItem({ id: 'a', categoryId: 'cat-shirt', status: 'available' }),
      makeItem({ id: 'b', categoryId: 'cat-shirt', status: 'laundry' }),
      makeItem({ id: 'c', categoryId: 'cat-pants', status: 'laundry' }),
    ];
    expect(
      filterItems(items, { categoryId: 'cat-shirt', status: 'laundry' }).map((item) => item.id),
    ).toEqual(['b']);
    expect(filterItems(items, { status: 'all' })).toHaveLength(3);
  });

  it('treats all-season tags as matching any season', () => {
    const items = [
      makeItem({ id: 'a', seasons: ['summer'] }),
      makeItem({ id: 'b', seasons: ['winter'] }),
      makeItem({ id: 'c', seasons: ['all'] }),
    ];
    expect(filterItems(items, { season: 'summer' }).map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('filters by location, primary or secondary color, scene, and style', () => {
    const items = [
      makeItem({
        id: 'a',
        locationId: 'closet',
        colorPrimaryId: 'white',
        sceneTags: ['commute'],
        styleTags: ['minimal'],
      }),
      makeItem({
        id: 'b',
        locationId: 'shoe-cabinet',
        colorPrimaryId: 'black',
        colorSecondaryId: 'white',
        sceneTags: ['sport'],
        styleTags: ['sport'],
      }),
    ];
    expect(filterItems(items, { locationId: 'closet' }).map((item) => item.id)).toEqual(['a']);
    expect(filterItems(items, { colorId: 'white' }).map((item) => item.id)).toEqual(['a', 'b']);
    expect(filterItems(items, { sceneId: 'sport' }).map((item) => item.id)).toEqual(['b']);
    expect(filterItems(items, { styleTag: 'minimal' }).map((item) => item.id)).toEqual(['a']);
  });

  it('hides retired items unless included or explicitly requested', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b', status: 'retired', archivedAt: '2026-10-03T00:00:00.000Z' }),
    ];
    expect(filterItems(items, {}).map((item) => item.id)).toEqual(['a']);
    expect(filterItems(items, { includeRetired: true }).map((item) => item.id)).toEqual(['a', 'b']);
    expect(filterItems(items, { status: 'retired' }).map((item) => item.id)).toEqual(['b']);
  });

  it('sorts by updatedAt descending, then name', () => {
    const items = [
      makeItem({ id: 'old', name: 'A', updatedAt: '2026-10-01T00:00:00.000Z' }),
      makeItem({ id: 'new-b', name: 'B', updatedAt: '2026-10-05T00:00:00.000Z' }),
      makeItem({ id: 'new-a', name: 'A', updatedAt: '2026-10-05T00:00:00.000Z' }),
    ];
    expect(filterItems(items, {}).map((item) => item.id)).toEqual(['new-a', 'new-b', 'old']);
  });
});
