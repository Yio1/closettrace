import { beforeEach, describe, expect, it } from 'vitest';
import type { Item } from '../../domain/types';
import { ClosetTraceDB } from '../schema';
import { seedDatabase } from '../seed';
import { createItem, purgeItem } from './items';
import { getOutfit, saveOutfit } from './outfits';
import { deleteWearLog, logWear, wearDaysForItem } from './wearLogs';

let database: ClosetTraceDB;

beforeEach(async () => {
  database = new ClosetTraceDB('wear-logs-test');
  await database.open();
  await Promise.all(database.tables.map((table) => table.clear()));
  await seedDatabase(database);
});

async function makeItem(name = '白衬衫', categoryId = 'builtin:cat:shirt'): Promise<Item> {
  const id = await createItem(
    {
      name,
      categoryId,
      colorPrimaryId: 'builtin:color:white',
      warmth: 2,
      formality: 3,
      seasons: ['all'],
    },
    database,
  );
  const item = await database.items.get(id);
  if (!item) throw new Error('missing item');
  return item;
}

describe('wear log repository', () => {
  it('does not double count the same item on the same date', async () => {
    const shirt = await makeItem();

    await logWear({ date: '2026-11-01', items: [shirt] }, database);
    await logWear({ date: '2026-11-01', items: [shirt] }, database);

    expect((await database.items.get(shirt.id))?.wearCount).toBe(1);
    expect(await database.wearLogs.count()).toBe(2);
    expect(await wearDaysForItem(shirt.id, database)).toBe(1);
  });

  it('counts distinct dates and keeps the latest worn date', async () => {
    const shirt = await makeItem();

    await logWear({ date: '2026-11-03', items: [shirt] }, database);
    await logWear({ date: '2026-11-01', items: [shirt] }, database);

    const updated = await database.items.get(shirt.id);
    expect(updated?.wearCount).toBe(2);
    expect(updated?.lastWornAt).toBe('2026-11-03');
  });

  it('recomputes caches when a log is deleted', async () => {
    const shirt = await makeItem();
    await logWear({ date: '2026-11-01', items: [shirt] }, database);
    await logWear({ date: '2026-11-02', items: [shirt] }, database);
    const latestId = await logWear({ date: '2026-11-03', items: [shirt] }, database);

    await deleteWearLog(latestId, database);

    const updated = await database.items.get(shirt.id);
    expect(updated?.wearCount).toBe(2);
    expect(updated?.lastWornAt).toBe('2026-11-02');
  });

  it('keeps item snapshots after the item is purged', async () => {
    const shirt = await makeItem();
    const logId = await logWear({ date: '2026-11-01', items: [shirt] }, database);

    await purgeItem(shirt.id, database);

    expect(await database.items.get(shirt.id)).toBeUndefined();
    const log = await database.wearLogs.get(logId);
    expect(log?.itemIds).toEqual([shirt.id]);
    expect(log?.items[0]).toMatchObject({
      itemId: shirt.id,
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      slot: 'top',
      colorPrimaryId: 'builtin:color:white',
    });
  });

  it('counts outfit wears by distinct date', async () => {
    const shirt = await makeItem();
    const outfitId = await saveOutfit(
      {
        name: '通勤基础',
        sceneIds: ['builtin:scene:commute'],
        items: [{ itemId: shirt.id, slot: 'top', order: 0 }],
      },
      database,
    );

    await logWear({ date: '2026-11-01', outfitId, items: [shirt] }, database);
    await logWear({ date: '2026-11-01', outfitId, items: [shirt] }, database);
    const secondDay = await logWear({ date: '2026-11-02', outfitId, items: [shirt] }, database);

    let outfit = await getOutfit(outfitId, database);
    expect(outfit?.wearCount).toBe(2);
    expect(outfit?.lastWornAt).toBe('2026-11-02');

    await deleteWearLog(secondDay, database);
    outfit = await getOutfit(outfitId, database);
    expect(outfit?.wearCount).toBe(1);
    expect(outfit?.lastWornAt).toBe('2026-11-01');
  });
});
