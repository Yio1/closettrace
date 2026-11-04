import { describe, expect, it } from 'vitest';
import { makeItem } from '../test/fixtures/wardrobe';
import type { Category, PriceQuote, Purchase } from './types';
import { cpw, groupSpending, lowestQuote, priceDelta, sortQuotesByLanded } from './price';

function quote(
  id: string,
  priceCents: number,
  shippingCents: number,
  discountCents: number,
  observedAt: string,
): PriceQuote {
  return {
    id,
    wishlistId: 'wish-1',
    channel: `渠道${id}`,
    priceCents,
    shippingCents,
    discountCents,
    observedAt,
    createdAt: `${observedAt}T00:00:00.000Z`,
  };
}

function purchase(
  id: string,
  itemId: string,
  channel: string,
  purchasedAt: string,
  priceCents: number,
  shippingCents = 0,
  discountCents = 0,
): Purchase {
  return {
    id,
    itemId,
    channel,
    priceCents,
    shippingCents,
    discountCents,
    purchasedAt,
    createdAt: `${purchasedAt}T00:00:00.000Z`,
  };
}

describe('cpw', () => {
  it('returns null when never worn', () => {
    expect(cpw(19900, 0)).toBeNull();
  });

  it('divides cost by wears rounded to cents', () => {
    expect(cpw(19900, 12)).toBe(1658.33);
    expect(cpw(12000, 12)).toBe(1000);
  });
});

describe('quotes', () => {
  const older = quote('old', 10000, 500, 0, '2026-01-01');
  const newer = quote('new', 10000, 500, 0, '2026-02-01');
  const pricier = quote('pricey', 9000, 2000, 0, '2026-03-01');

  it('returns null when there are no quotes', () => {
    expect(lowestQuote([])).toBeNull();
  });

  it('picks the lowest landed price and breaks ties by latest observation', () => {
    expect(lowestQuote([pricier, older, newer])?.id).toBe('new');
  });

  it('sorts quotes by landed price', () => {
    expect(sortQuotesByLanded([pricier, older, newer]).map((entry) => entry.id)).toEqual([
      'new',
      'old',
      'pricey',
    ]);
  });

  it('computes the delta against a target price', () => {
    const cheap = quote('cheap', 9000, 0, 0, '2026-01-01');
    const dear = quote('dear', 11000, 0, 0, '2026-01-01');

    expect(priceDelta(cheap, 10000)).toEqual({ kind: 'below', cents: 1000 });
    expect(priceDelta(dear, 10000)).toEqual({ kind: 'above', cents: 1000 });
    expect(priceDelta(dear, 11000)).toEqual({ kind: 'equal', cents: 0 });
    expect(priceDelta(dear)).toEqual({ kind: 'none', cents: 0 });
  });
});

describe('groupSpending', () => {
  const categories: Category[] = [
    {
      id: 'cat-fashion',
      name: '服饰',
      slot: 'top',
      defaultFormality: 3,
      defaultWarmth: 2,
      defaultSeasons: ['all'],
      isBuiltIn: false,
      archived: false,
      order: 10,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'cat-shoes',
      name: '鞋履',
      slot: 'shoes',
      defaultFormality: 2,
      defaultWarmth: 2,
      defaultSeasons: ['all'],
      isBuiltIn: false,
      archived: false,
      order: 20,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const items = [
    makeItem({ id: 'item-a', name: '衬衫', categoryId: 'cat-fashion', colorPrimaryId: 'white' }),
    makeItem({ id: 'item-b', name: '跑鞋', categoryId: 'cat-shoes', colorPrimaryId: 'white' }),
  ];
  const purchases = [
    purchase('p1', 'item-a', '淘宝', '2026-01-10', 10000, 500),
    purchase('p2', 'item-b', '淘宝', '2026-01-20', 20000),
    purchase('p3', 'item-a', '京东', '2026-02-05', 5000),
  ];

  it('groups by month using landed cost, newest first', () => {
    expect(groupSpending(purchases, 'month')).toEqual([
      { key: '2026-02', cents: 5000 },
      { key: '2026-01', cents: 30500 },
    ]);
  });

  it('groups by channel using landed cost, highest first', () => {
    expect(groupSpending(purchases, 'channel')).toEqual([
      { key: '淘宝', cents: 30500 },
      { key: '京东', cents: 5000 },
    ]);
  });

  it('groups by category name and skips unknown items', () => {
    expect(groupSpending(purchases, 'category', { items, categories })).toEqual([
      { key: '鞋履', cents: 20000 },
      { key: '服饰', cents: 15500 },
    ]);

    expect(
      groupSpending([...purchases, purchase('p4', 'missing', '淘宝', '2026-02-06', 100)], 'category', {
        items,
        categories,
      }),
    ).toEqual([
      { key: '鞋履', cents: 20000 },
      { key: '服饰', cents: 15500 },
    ]);
  });
});
