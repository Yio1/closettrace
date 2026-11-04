import type { ItemFilter } from '../../domain/itemFilter';
import { filterItems } from '../../domain/itemFilter';
import { landedCents } from '../../domain/money';
import type { Item, ItemStatus, NewItemInput } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export type { NewItemInput } from '../../domain/types';

function nowISO(): string {
  return new Date().toISOString();
}

export async function createItem(
  input: NewItemInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const now = nowISO();
  const id = crypto.randomUUID();
  const item: Item = {
    id,
    name: input.name.trim(),
    categoryId: input.categoryId,
    brand: input.brand,
    size: input.size,
    colorPrimaryId: input.colorPrimaryId,
    colorSecondaryId: input.colorSecondaryId,
    pattern: input.pattern ?? 'solid',
    material: input.material,
    warmth: input.warmth,
    formality: input.formality,
    seasons: input.seasons,
    sceneTags: input.sceneTags ?? [],
    styleTags: input.styleTags ?? [],
    locationId: input.locationId,
    locationDetail: input.locationDetail,
    status: input.status ?? 'available',
    avoidRecommend: input.avoidRecommend ?? false,
    isFavorite: input.isFavorite ?? false,
    note: input.note,
    wearCount: 0,
    totalCostCents: 0,
    createdAt: now,
    updatedAt: now,
  };
  await database.items.add(item);
  return id;
}

export async function updateItem(
  id: string,
  patch: Partial<Item>,
  database: ClosetTraceDB = db,
): Promise<void> {
  await database.items.update(id, { ...patch, id, updatedAt: nowISO() });
}

export async function getItem(
  id: string,
  database: ClosetTraceDB = db,
): Promise<Item | undefined> {
  return database.items.get(id);
}

export async function listItems(
  filter: ItemFilter = {},
  database: ClosetTraceDB = db,
): Promise<Item[]> {
  return filterItems(await database.items.toArray(), filter);
}

export async function setItemsStatus(
  ids: string[],
  status: ItemStatus,
  database: ClosetTraceDB = db,
): Promise<void> {
  if (ids.length === 0) return;
  const now = nowISO();
  await database.items.where('id').anyOf(ids).modify((item) => {
    item.status = status;
    item.updatedAt = now;
    if (status === 'retired') item.archivedAt = now;
    else delete item.archivedAt;
  });
}

export async function moveItems(
  ids: string[],
  locationId?: string,
  database: ClosetTraceDB = db,
): Promise<void> {
  if (ids.length === 0) return;
  const now = nowISO();
  await database.items.where('id').anyOf(ids).modify((item) => {
    if (locationId) item.locationId = locationId;
    else delete item.locationId;
    delete item.locationDetail;
    item.updatedAt = now;
  });
}

export async function retireItem(id: string, database: ClosetTraceDB = db): Promise<void> {
  await setItemsStatus([id], 'retired', database);
}

export async function restoreItem(id: string, database: ClosetTraceDB = db): Promise<void> {
  await database.items.where('id').equals(id).modify((item) => {
    item.status = 'available';
    item.updatedAt = nowISO();
    delete item.archivedAt;
  });
}

export async function purgeItem(id: string, database: ClosetTraceDB = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.items, database.itemPhotos, database.purchases, database.outfitItems],
    async () => {
      await database.itemPhotos.where('itemId').equals(id).delete();
      await database.purchases.where('itemId').equals(id).delete();
      await database.outfitItems.where('itemId').equals(id).delete();
      await database.items.delete(id);
    },
  );
}

export async function recalcItemStats(
  itemId: string,
  database: ClosetTraceDB = db,
): Promise<void> {
  const [logs, purchases] = await Promise.all([
    database.wearLogs.where('itemIds').equals(itemId).toArray(),
    database.purchases.where('itemId').equals(itemId).toArray(),
  ]);

  const dates = new Set(logs.map((log) => log.date));
  const lastWornAt = dates.size > 0 ? [...dates].sort().at(-1) : undefined;
  const totalCostCents = purchases.reduce(
    (sum, purchase) =>
      sum + landedCents(purchase.priceCents, purchase.shippingCents, purchase.discountCents),
    0,
  );

  await database.items.where('id').equals(itemId).modify((item) => {
    item.wearCount = dates.size;
    item.totalCostCents = totalCostCents;
    if (lastWornAt) item.lastWornAt = lastWornAt;
    else delete item.lastWornAt;
  });
}
