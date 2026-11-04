import { beforeEach, describe, expect, it } from 'vitest';
import { ClosetTraceDB } from '../schema';
import type { ItemPhoto, Purchase, WearLog } from '../../domain/types';
import {
  createItem,
  getItem,
  listItems,
  moveItems,
  purgeItem,
  recalcItemStats,
  restoreItem,
  retireItem,
  setItemsStatus,
  updateItem,
} from './items';

let database: ClosetTraceDB;

beforeEach(async () => {
  database = new ClosetTraceDB('items-test');
  await database.open();
  await Promise.all([
    database.items.clear(),
    database.itemPhotos.clear(),
    database.purchases.clear(),
    database.outfitItems.clear(),
    database.wearLogs.clear(),
    database.outfits.clear(),
  ]);
});

async function newItem(name = '白衬衫'): Promise<string> {
  return createItem(
    {
      name,
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
      warmth: 2,
      formality: 3,
      seasons: ['all'],
    },
    database,
  );
}

describe('item repository', () => {
  it('creates an item with defaults', async () => {
    const id = await newItem();
    const item = await getItem(id, database);
    expect(item).toMatchObject({
      id,
      name: '白衬衫',
      status: 'available',
      wearCount: 0,
      totalCostCents: 0,
      avoidRecommend: false,
      isFavorite: false,
      pattern: 'solid',
    });
    expect(item?.createdAt).toBeTruthy();
  });

  it('updates fields and stamps updatedAt', async () => {
    const id = await newItem();
    const before = await getItem(id, database);
    await updateItem(id, { name: '蓝衬衫', isFavorite: true }, database);
    const after = await getItem(id, database);
    expect(after).toMatchObject({ id, name: '蓝衬衫', isFavorite: true });
    expect(after!.updatedAt >= before!.updatedAt).toBe(true);
  });

  it('hides retired items unless asked', async () => {
    const activeId = await newItem('在穿');
    const retiredId = await newItem('移出');
    await retireItem(retiredId, database);

    const visible = await listItems({}, database);
    expect(visible.map((item) => item.id)).toEqual([activeId]);

    const all = await listItems({ includeRetired: true }, database);
    expect(all.map((item) => item.id).sort()).toEqual([activeId, retiredId].sort());
  });

  it('batch updates status', async () => {
    const first = await newItem('一');
    const second = await newItem('二');
    await setItemsStatus([first, second], 'laundry', database);
    const items = await listItems({ status: 'laundry' }, database);
    expect(items.map((item) => item.id).sort()).toEqual([first, second].sort());
  });

  it('batch moves items', async () => {
    const first = await newItem('一');
    const second = await newItem('二');
    await moveItems([first, second], 'loc-a', database);
    expect((await getItem(first, database))?.locationId).toBe('loc-a');
    expect((await getItem(second, database))?.locationId).toBe('loc-a');

    await moveItems([first], undefined, database);
    expect((await getItem(first, database))?.locationId).toBeUndefined();
  });

  it('retires and restores an item', async () => {
    const id = await newItem();
    await retireItem(id, database);
    const retired = await getItem(id, database);
    expect(retired?.status).toBe('retired');
    expect(retired?.archivedAt).toBeTruthy();

    await restoreItem(id, database);
    const restored = await getItem(id, database);
    expect(restored?.status).toBe('available');
    expect(restored?.archivedAt).toBeUndefined();
  });

  it('purges item data but keeps wear history', async () => {
    const id = await newItem();
    const photo: ItemPhoto = {
      id: 'photo-1',
      itemId: id,
      blob: new Blob(['full']),
      thumbBlob: new Blob(['thumb']),
      width: 10,
      height: 10,
      bytes: 4,
      order: 0,
      createdAt: new Date().toISOString(),
    };
    const purchase: Purchase = {
      id: 'purchase-1',
      itemId: id,
      channel: '线下',
      priceCents: 19900,
      shippingCents: 0,
      discountCents: 0,
      purchasedAt: '2026-10-01',
      createdAt: new Date().toISOString(),
    };
    const wearLog: WearLog = {
      id: 'wear-1',
      date: '2026-11-01',
      itemIds: [id],
      items: [
        {
          itemId: id,
          name: '白衬衫',
          categoryId: 'builtin:cat:shirt',
          slot: 'top',
          colorPrimaryId: 'builtin:color:white',
        },
      ],
      createdAt: new Date().toISOString(),
    };
    await database.itemPhotos.add(photo);
    await database.purchases.add(purchase);
    await database.wearLogs.add(wearLog);
    await database.outfitItems.add({
      id: 'oi-1',
      outfitId: 'outfit-1',
      itemId: id,
      slot: 'top',
      order: 0,
    });

    await purgeItem(id, database);

    expect(await database.items.get(id)).toBeUndefined();
    expect(await database.itemPhotos.count()).toBe(0);
    expect(await database.purchases.count()).toBe(0);
    expect(await database.outfitItems.count()).toBe(0);
    expect(await database.wearLogs.count()).toBe(1);
  });

  it('recalculates wear count, last worn date, and total cost', async () => {
    const id = await newItem();
    await database.purchases.bulkAdd([
      {
        id: 'p1',
        itemId: id,
        channel: '淘宝',
        priceCents: 10000,
        shippingCents: 1000,
        discountCents: 500,
        purchasedAt: '2026-09-01',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'p2',
        itemId: id,
        channel: '线下',
        priceCents: 5000,
        shippingCents: 0,
        discountCents: 0,
        purchasedAt: '2026-10-01',
        createdAt: new Date().toISOString(),
      },
    ]);
    const snapshot = {
      itemId: id,
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      slot: 'top' as const,
      colorPrimaryId: 'builtin:color:white',
    };
    await database.wearLogs.bulkAdd([
      {
        id: 'w1',
        date: '2026-10-30',
        itemIds: [id],
        items: [snapshot],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'w2',
        date: '2026-10-30',
        itemIds: [id],
        items: [snapshot],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'w3',
        date: '2026-11-02',
        itemIds: [id],
        items: [snapshot],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'w4',
        date: '2026-11-02',
        itemIds: ['other'],
        items: [],
        createdAt: new Date().toISOString(),
      },
    ]);

    await recalcItemStats(id, database);

    const item = await getItem(id, database);
    expect(item?.wearCount).toBe(2);
    expect(item?.lastWornAt).toBe('2026-11-02');
    expect(item?.totalCostCents).toBe(15500);
  });
});
