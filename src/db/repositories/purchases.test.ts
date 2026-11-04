import { beforeEach, describe, expect, it } from 'vitest';
import { ClosetTraceDB } from '../schema';
import { seedDatabase } from '../seed';
import { createItem } from './items';
import {
  addPurchase,
  deletePurchase,
  listPurchases,
  purchaseTotalCents,
  updatePurchase,
} from './purchases';

let database: ClosetTraceDB;
let itemId: string;

beforeEach(async () => {
  database = new ClosetTraceDB('purchases-test');
  await database.open();
  await Promise.all([
    database.purchases.clear(),
    database.items.clear(),
    database.wearLogs.clear(),
    database.settings.clear(),
  ]);
  await seedDatabase(database);
  itemId = await createItem(
    {
      name: '白色衬衫',
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
      warmth: 2,
      formality: 3,
      seasons: ['all'],
    },
    database,
  );
});

async function itemCost(): Promise<number> {
  return (await database.items.get(itemId))?.totalCostCents ?? -1;
}

describe('purchase repository', () => {
  it('adds purchases and rolls landed cost into the item', async () => {
    await addPurchase(
      {
        itemId,
        channel: '淘宝',
        priceCents: 19900,
        shippingCents: 1000,
        discountCents: 500,
        purchasedAt: '2026-01-10',
      },
      database,
    );
    expect(await itemCost()).toBe(20400);

    await addPurchase(
      { itemId, channel: '京东', priceCents: 5000, purchasedAt: '2026-02-01' },
      database,
    );
    expect(await itemCost()).toBe(25400);

    const purchases = await listPurchases(itemId, database);
    expect(purchases).toHaveLength(2);
    expect(purchases[0].purchasedAt).toBe('2026-02-01');
    expect(purchaseTotalCents(purchases)).toBe(25400);
  });

  it('recomputes the item cost after an update', async () => {
    const id = await addPurchase(
      {
        itemId,
        channel: '淘宝',
        priceCents: 10000,
        shippingCents: 500,
        purchasedAt: '2026-01-10',
      },
      database,
    );
    await addPurchase(
      { itemId, channel: '京东', priceCents: 5000, purchasedAt: '2026-02-01' },
      database,
    );
    expect(await itemCost()).toBe(15500);

    await updatePurchase(
      id,
      { priceCents: 8000, shippingCents: 0, discountCents: 1000 },
      database,
    );
    expect(await itemCost()).toBe(12000);
  });

  it('recomputes the item cost after a delete', async () => {
    const id = await addPurchase(
      { itemId, channel: '淘宝', priceCents: 10000, purchasedAt: '2026-01-10' },
      database,
    );
    await addPurchase(
      { itemId, channel: '京东', priceCents: 5000, purchasedAt: '2026-02-01' },
      database,
    );

    await deletePurchase(id, database);
    expect(await itemCost()).toBe(5000);
    expect(await listPurchases(itemId, database)).toHaveLength(1);
  });

  it('lists all purchases when no item is given', async () => {
    await addPurchase(
      { itemId, channel: '淘宝', priceCents: 1000, purchasedAt: '2026-01-10' },
      database,
    );
    expect(await listPurchases(undefined, database)).toHaveLength(1);
  });
});
