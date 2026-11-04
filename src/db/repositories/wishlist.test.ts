import { beforeEach, describe, expect, it } from 'vitest';
import { ClosetTraceDB } from '../schema';
import { seedDatabase } from '../seed';
import { createItem } from './items';
import { listPurchases } from './purchases';
import {
  addQuote,
  addWishlist,
  convertWishlistToPurchase,
  deleteQuote,
  getWishlist,
  listQuotes,
  listWishlist,
  updateWishlist,
} from './wishlist';

let database: ClosetTraceDB;

beforeEach(async () => {
  database = new ClosetTraceDB('wishlist-test');
  await database.open();
  await Promise.all([
    database.wishlistItems.clear(),
    database.priceQuotes.clear(),
    database.purchases.clear(),
    database.items.clear(),
    database.wearLogs.clear(),
    database.settings.clear(),
  ]);
  await seedDatabase(database);
});

async function newWishlist() {
  return addWishlist(
    {
      name: '羊毛大衣',
      brand: '无印',
      categoryId: 'builtin:cat:coat',
      size: 'M',
      targetPriceCents: 80000,
      priority: 3,
    },
    database,
  );
}

describe('wishlist repository', () => {
  it('creates a wishlist item that is watching by default', async () => {
    const id = await newWishlist();
    expect(await getWishlist(id, database)).toMatchObject({
      name: '羊毛大衣',
      status: 'watching',
      priority: 3,
      targetPriceCents: 80000,
    });
  });

  it('updates a wishlist item and hides dropped entries by default', async () => {
    const id = await newWishlist();
    await updateWishlist(id, { status: 'dropped' }, database);

    expect(await listWishlist(false, database)).toHaveLength(0);
    expect(await listWishlist(true, database)).toHaveLength(1);
    expect((await getWishlist(id, database))?.status).toBe('dropped');
  });

  it('lists quotes newest first and deletes them', async () => {
    const id = await newWishlist();
    const older = await addQuote(
      id,
      { channel: '淘宝', priceCents: 90000, observedAt: '2026-01-10' },
      database,
    );
    await addQuote(
      id,
      { channel: '京东', priceCents: 85000, shippingCents: 1000, observedAt: '2026-02-10' },
      database,
    );

    const quotes = await listQuotes(id, database);
    expect(quotes).toHaveLength(2);
    expect(quotes[0].channel).toBe('京东');

    await deleteQuote(older, database);
    expect(await listQuotes(id, database)).toHaveLength(1);
  });

  it('converts a wishlist item into an item purchase and keeps quote history', async () => {
    const wishlistId = await newWishlist();
    const quoteId = await addQuote(
      wishlistId,
      {
        channel: '天猫',
        priceCents: 76000,
        shippingCents: 0,
        discountCents: 2000,
        observedAt: '2026-02-01',
      },
      database,
    );
    const itemId = await createItem(
      {
        name: '羊毛大衣',
        categoryId: 'builtin:cat:coat',
        colorPrimaryId: 'builtin:color:caramel',
        warmth: 4,
        formality: 3,
        seasons: ['winter'],
      },
      database,
    );

    const purchaseId = await convertWishlistToPurchase(
      wishlistId,
      quoteId,
      itemId,
      { purchasedAt: '2026-03-01' },
      database,
    );

    const purchases = await listPurchases(itemId, database);
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({
      id: purchaseId,
      channel: '天猫',
      priceCents: 76000,
      discountCents: 2000,
      purchasedAt: '2026-03-01',
    });
    expect((await database.items.get(itemId))?.totalCostCents).toBe(74000);

    expect(await getWishlist(wishlistId, database)).toMatchObject({
      status: 'bought',
      convertedItemId: itemId,
    });
    expect(await listQuotes(wishlistId, database)).toHaveLength(1);
  });

  it('refuses a quote from another wishlist item', async () => {
    const wishlistId = await newWishlist();
    const otherId = await addWishlist(
      { name: '跑鞋', categoryId: 'builtin:cat:sneakers', priority: 2 },
      database,
    );
    const otherQuote = await addQuote(
      otherId,
      { channel: '淘宝', priceCents: 30000, observedAt: '2026-02-01' },
      database,
    );
    const itemId = await createItem(
      {
        name: '跑鞋',
        categoryId: 'builtin:cat:sneakers',
        colorPrimaryId: 'builtin:color:white',
        warmth: 2,
        formality: 1,
        seasons: ['all'],
      },
      database,
    );

    await expect(
      convertWishlistToPurchase(wishlistId, otherQuote, itemId, {}, database),
    ).rejects.toThrow('报价不属于该想买项');
  });
});
