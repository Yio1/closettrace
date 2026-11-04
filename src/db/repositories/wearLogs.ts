import { distinctWearDates } from '../../domain/wear';
import type { ISODate, Item, WearItemSnapshot, WearLog } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';
import { recalcItemStats } from './items';

export interface LogWearInput {
  date: ISODate;
  outfitId?: string;
  sceneId?: string;
  tempC?: number;
  items: Item[];
  note?: string;
}

export interface WearLogRange {
  from: ISODate;
  to: ISODate;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function snapshots(
  items: Item[],
  database: ClosetTraceDB,
): Promise<WearItemSnapshot[]> {
  const categories = await database.categories.bulkGet([
    ...new Set(items.map((item) => item.categoryId)),
  ]);
  const slots = new Map(
    categories.filter((category) => category != null).map((category) => [category.id, category.slot]),
  );
  return items.map((item) => ({
    itemId: item.id,
    name: item.name,
    categoryId: item.categoryId,
    slot: slots.get(item.categoryId) ?? 'top',
    colorPrimaryId: item.colorPrimaryId,
    photoId: item.coverPhotoId,
  }));
}

export async function logWear(
  input: LogWearInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const id = crypto.randomUUID();
  const uniqueItems = [...new Map(input.items.map((item) => [item.id, item])).values()];

  await database.transaction(
    'rw',
    [database.wearLogs, database.items, database.outfits, database.purchases, database.categories],
    async () => {
      const outfit = input.outfitId ? await database.outfits.get(input.outfitId) : undefined;
      const log: WearLog = {
        id,
        date: input.date,
        outfitId: input.outfitId,
        outfitName: outfit?.name,
        sceneId: input.sceneId,
        tempC: input.tempC,
        itemIds: uniqueItems.map((item) => item.id),
        items: await snapshots(uniqueItems, database),
        note: input.note,
        createdAt: nowISO(),
      };
      await database.wearLogs.add(log);
      for (const item of uniqueItems) await recalcItemStats(item.id, database);
      if (input.outfitId) await recalcOutfitStats(input.outfitId, database);
    },
  );

  return id;
}

export async function deleteWearLog(id: string, database: ClosetTraceDB = db): Promise<void> {
  const log = await database.wearLogs.get(id);
  if (!log) return;

  await database.transaction(
    'rw',
    [database.wearLogs, database.items, database.outfits, database.purchases],
    async () => {
      await database.wearLogs.delete(id);
      for (const itemId of log.itemIds) await recalcItemStats(itemId, database);
      if (log.outfitId) await recalcOutfitStats(log.outfitId, database);
    },
  );
}

export async function listWearLogs(
  range?: WearLogRange,
  database: ClosetTraceDB = db,
): Promise<WearLog[]> {
  if (!range) return database.wearLogs.orderBy('date').toArray();
  return database.wearLogs.where('date').between(range.from, range.to, true, true).toArray();
}

export async function wearDaysForItem(
  itemId: string,
  database: ClosetTraceDB = db,
): Promise<number> {
  const logs = await database.wearLogs.where('itemIds').equals(itemId).toArray();
  return distinctWearDates(logs, itemId);
}

export async function recalcOutfitStats(
  outfitId: string,
  database: ClosetTraceDB = db,
): Promise<void> {
  const logs = await database.wearLogs.where('outfitId').equals(outfitId).toArray();
  const dates = [...new Set(logs.map((log) => log.date))].sort();
  await database.outfits.where('id').equals(outfitId).modify((outfit) => {
    outfit.wearCount = dates.length;
    if (dates.length > 0) outfit.lastWornAt = dates[dates.length - 1];
    else delete outfit.lastWornAt;
  });
}
