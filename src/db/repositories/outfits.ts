import type { Outfit, OutfitItem, Slot } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export interface OutfitItemInput {
  itemId: string;
  slot: Slot;
  order: number;
}

export interface SaveOutfitInput {
  name?: string;
  sceneIds: string[];
  items: OutfitItemInput[];
  isFavorite?: boolean;
  note?: string;
  source?: Outfit['source'];
}

function nowISO(): string {
  return new Date().toISOString();
}

function joinRows(outfitId: string, items: OutfitItemInput[]): OutfitItem[] {
  return items.map((item) => ({
    id: crypto.randomUUID(),
    outfitId,
    itemId: item.itemId,
    slot: item.slot,
    order: item.order,
  }));
}

export async function saveOutfit(
  input: SaveOutfitInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = nowISO();
  const outfit: Outfit = {
    id,
    name: input.name?.trim() || '未命名搭配',
    sceneIds: input.sceneIds,
    isFavorite: input.isFavorite ?? false,
    source: input.source ?? 'manual',
    note: input.note,
    wearCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await database.transaction(
    'rw',
    [database.outfits, database.outfitItems],
    async () => {
      await database.outfits.add(outfit);
      await database.outfitItems.bulkAdd(joinRows(id, input.items));
    },
  );

  return id;
}

export async function getOutfit(
  id: string,
  database: ClosetTraceDB = db,
): Promise<Outfit | undefined> {
  return database.outfits.get(id);
}

export async function listOutfits(database: ClosetTraceDB = db): Promise<Outfit[]> {
  return database.outfits.orderBy('updatedAt').reverse().toArray();
}

export async function listOutfitItems(
  outfitId: string,
  database: ClosetTraceDB = db,
): Promise<OutfitItem[]> {
  const rows = await database.outfitItems.where('outfitId').equals(outfitId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

export async function listAllOutfitItems(database: ClosetTraceDB = db): Promise<OutfitItem[]> {
  return database.outfitItems.toArray();
}

export async function updateOutfit(
  id: string,
  patch: Partial<Outfit>,
  items?: OutfitItemInput[],
  database: ClosetTraceDB = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.outfits, database.outfitItems],
    async () => {
      const existing = await database.outfits.get(id);
      if (!existing) throw new Error('搭配不存在');

      await database.outfits.update(id, { ...patch, id, updatedAt: nowISO() });
      if (items) {
        await database.outfitItems.where('outfitId').equals(id).delete();
        await database.outfitItems.bulkAdd(joinRows(id, items));
      }
    },
  );
}

export async function deleteOutfit(id: string, database: ClosetTraceDB = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.outfits, database.outfitItems],
    async () => {
      await database.outfitItems.where('outfitId').equals(id).delete();
      await database.outfits.delete(id);
    },
  );
}

export async function toggleOutfitFavorite(
  id: string,
  database: ClosetTraceDB = db,
): Promise<boolean> {
  return database.transaction('rw', database.outfits, async () => {
    const outfit = await database.outfits.get(id);
    if (!outfit) throw new Error('搭配不存在');
    const isFavorite = !outfit.isFavorite;
    await database.outfits.update(id, { isFavorite, updatedAt: nowISO() });
    return isFavorite;
  });
}

export async function listOutfitsUsingItem(
  itemId: string,
  database: ClosetTraceDB = db,
): Promise<Outfit[]> {
  const links = await database.outfitItems.where('itemId').equals(itemId).toArray();
  const outfits = await database.outfits.bulkGet([...new Set(links.map((link) => link.outfitId))]);
  return outfits.filter((outfit): outfit is Outfit => outfit != null);
}
