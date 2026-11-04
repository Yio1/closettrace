import { beforeEach, describe, expect, it } from 'vitest';
import type { WearLog } from '../../domain/types';
import { ClosetTraceDB } from '../schema';
import {
  deleteOutfit,
  getOutfit,
  listOutfitItems,
  listOutfits,
  listOutfitsUsingItem,
  saveOutfit,
  toggleOutfitFavorite,
  updateOutfit,
} from './outfits';

let database: ClosetTraceDB;

beforeEach(async () => {
  database = new ClosetTraceDB('outfits-test');
  await database.open();
  await Promise.all([
    database.outfits.clear(),
    database.outfitItems.clear(),
    database.wearLogs.clear(),
  ]);
});

async function save(name = '通勤一号') {
  return saveOutfit(
    {
      name,
      sceneIds: ['builtin:scene:commute'],
      items: [
        { itemId: 'shirt', slot: 'top', order: 0 },
        { itemId: 'trousers', slot: 'bottom', order: 1 },
        { itemId: 'loafers', slot: 'shoes', order: 2 },
      ],
    },
    database,
  );
}

describe('outfit repository', () => {
  it('saves an outfit with ordered join rows in one transaction', async () => {
    const id = await save();

    const outfit = await getOutfit(id, database);
    expect(outfit?.name).toBe('通勤一号');
    expect(outfit?.source).toBe('manual');
    expect(outfit?.sceneIds).toEqual(['builtin:scene:commute']);
    expect(outfit?.wearCount).toBe(0);

    const items = await listOutfitItems(id, database);
    expect(items.map((row) => row.itemId)).toEqual(['shirt', 'trousers', 'loafers']);
    expect(items.map((row) => row.slot)).toEqual(['top', 'bottom', 'shoes']);
    expect(items.map((row) => row.order)).toEqual([0, 1, 2]);
  });

  it('falls back to a placeholder name when none is given', async () => {
    const id = await saveOutfit(
      { sceneIds: [], items: [{ itemId: 'shirt', slot: 'top', order: 0 }] },
      database,
    );
    expect((await getOutfit(id, database))?.name).toBe('未命名搭配');
  });

  it('replaces join rows and bumps updatedAt on update', async () => {
    const id = await save();
    const before = await getOutfit(id, database);

    await updateOutfit(
      id,
      { name: '周末', sceneIds: ['builtin:scene:casual'] },
      [
        { itemId: 'tee', slot: 'top', order: 0 },
        { itemId: 'jeans', slot: 'bottom', order: 1 },
      ],
      database,
    );

    const updated = await getOutfit(id, database);
    expect(updated?.name).toBe('周末');
    expect(updated?.sceneIds).toEqual(['builtin:scene:casual']);
    expect(updated && before && updated.updatedAt >= before.updatedAt).toBe(true);

    const items = await listOutfitItems(id, database);
    expect(items.map((row) => row.itemId)).toEqual(['tee', 'jeans']);
  });

  it('deletes join rows but keeps wear history', async () => {
    const id = await save();
    const log: WearLog = {
      id: crypto.randomUUID(),
      date: '2026-11-01',
      outfitId: id,
      outfitName: '通勤一号',
      itemIds: ['shirt', 'trousers', 'loafers'],
      items: [],
      createdAt: '2026-11-01T08:00:00.000Z',
    };
    await database.wearLogs.add(log);

    await deleteOutfit(id, database);

    expect(await getOutfit(id, database)).toBeUndefined();
    expect(await listOutfitItems(id, database)).toHaveLength(0);
    expect(await database.wearLogs.get(log.id)).toBeDefined();
  });

  it('toggles favorite state and returns the new value', async () => {
    const id = await save();
    expect(await toggleOutfitFavorite(id, database)).toBe(true);
    expect((await getOutfit(id, database))?.isFavorite).toBe(true);
    expect(await toggleOutfitFavorite(id, database)).toBe(false);
  });

  it('lists outfits by recency and finds the ones using an item', async () => {
    const first = await save('第一套');
    const second = await saveOutfit(
      {
        name: '第二套',
        sceneIds: [],
        items: [
          { itemId: 'shirt', slot: 'top', order: 0 },
          { itemId: 'skirt', slot: 'bottom', order: 1 },
        ],
      },
      database,
    );

    await database.outfits.update(first, { updatedAt: '2026-10-01T00:00:00.000Z' });
    const all = await listOutfits(database);
    expect(all.map((outfit) => outfit.id)).toEqual([second, first]);

    const usingShirt = await listOutfitsUsingItem('shirt', database);
    expect(usingShirt.map((outfit) => outfit.id).sort()).toEqual([first, second].sort());

    const usingLoafers = await listOutfitsUsingItem('loafers', database);
    expect(usingLoafers.map((outfit) => outfit.id)).toEqual([first]);
  });
});
