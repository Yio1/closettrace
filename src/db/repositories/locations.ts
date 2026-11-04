import type { Location } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export interface NewLocationInput {
  name: string;
  parentId?: string;
  detail?: string;
  note?: string;
  order?: number;
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function listLocations(database: ClosetTraceDB = db): Promise<Location[]> {
  const rows = await database.locations.toArray();
  return rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'));
}

export async function createLocation(
  input: NewLocationInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const siblings = await database.locations
    .filter((location: Location) => location.parentId === input.parentId)
    .toArray();
  const order = input.order ?? siblings.reduce((max, location) => Math.max(max, location.order), 0) + 1;
  const now = nowISO();
  const id = crypto.randomUUID();

  await database.locations.add({
    id,
    name: input.name.trim(),
    parentId: input.parentId,
    detail: input.detail,
    note: input.note,
    order,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateLocation(
  id: string,
  patch: Partial<Location>,
  database: ClosetTraceDB = db,
): Promise<void> {
  await database.locations.update(id, { ...patch, id, updatedAt: nowISO() });
}

export async function deleteLocation(id: string, database: ClosetTraceDB = db): Promise<void> {
  const [itemCount, childCount] = await Promise.all([
    database.items.where('locationId').equals(id).count(),
    database.locations.where('parentId').equals(id).count(),
  ]);
  if (itemCount > 0 || childCount > 0) {
    throw new Error('该位置下还有衣物或子位置，先清空后再删除');
  }
  await database.locations.delete(id);
}
