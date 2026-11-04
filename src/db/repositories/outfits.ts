import type { Outfit } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export async function listOutfitsUsingItem(
  itemId: string,
  database: ClosetTraceDB = db,
): Promise<Outfit[]> {
  const links = await database.outfitItems.where('itemId').equals(itemId).toArray();
  const outfits = await database.outfits.bulkGet([...new Set(links.map((link) => link.outfitId))]);
  return outfits.filter((outfit): outfit is Outfit => outfit != null);
}
