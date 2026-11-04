import { landedCents } from './money';
import type { Category, Item, PriceQuote, Purchase } from './types';

export function cpw(totalCostCents: number, wearCount: number): number | null {
  if (wearCount <= 0) return null;
  return Math.round((totalCostCents / wearCount) * 100) / 100;
}

export function sortQuotesByLanded(quotes: PriceQuote[]): PriceQuote[] {
  return quotes.slice().sort((a, b) => {
    const landedA = landedCents(a.priceCents, a.shippingCents, a.discountCents);
    const landedB = landedCents(b.priceCents, b.shippingCents, b.discountCents);
    return landedA - landedB || b.observedAt.localeCompare(a.observedAt);
  });
}

export function lowestQuote(quotes: PriceQuote[]): PriceQuote | null {
  return sortQuotesByLanded(quotes)[0] ?? null;
}

export type PriceDeltaKind = 'below' | 'above' | 'equal' | 'none';

export function priceDelta(
  quote: PriceQuote,
  targetCents?: number,
): { kind: PriceDeltaKind; cents: number } {
  if (targetCents === undefined) return { kind: 'none', cents: 0 };
  const landed = landedCents(quote.priceCents, quote.shippingCents, quote.discountCents);
  if (landed < targetCents) return { kind: 'below', cents: targetCents - landed };
  if (landed > targetCents) return { kind: 'above', cents: landed - targetCents };
  return { kind: 'equal', cents: 0 };
}

export interface SpendingGroup {
  key: string;
  cents: number;
}

export function groupSpending(
  purchases: Purchase[],
  key: 'month' | 'category' | 'channel',
  data: { items?: Item[]; categories?: Category[] } = {},
): SpendingGroup[] {
  const itemById = new Map((data.items ?? []).map((item) => [item.id, item]));
  const categoryNameById = new Map(
    (data.categories ?? []).map((category) => [category.id, category.name]),
  );
  const groups = new Map<string, number>();

  for (const purchase of purchases) {
    let groupKey: string;
    if (key === 'month') {
      groupKey = purchase.purchasedAt.slice(0, 7);
    } else if (key === 'channel') {
      groupKey = purchase.channel;
    } else {
      const item = itemById.get(purchase.itemId);
      if (!item) continue;
      groupKey = categoryNameById.get(item.categoryId) ?? item.categoryId;
    }
    const landed = landedCents(purchase.priceCents, purchase.shippingCents, purchase.discountCents);
    groups.set(groupKey, (groups.get(groupKey) ?? 0) + landed);
  }

  const entries = [...groups.entries()].map(([groupKey, cents]) => ({ key: groupKey, cents }));
  if (key === 'month') {
    return entries.sort((a, b) => b.key.localeCompare(a.key));
  }
  return entries.sort((a, b) => b.cents - a.cents || a.key.localeCompare(b.key, 'zh-CN'));
}
