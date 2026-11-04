import type { ItemPhoto, OutfitItem } from '../../domain/types';
import {
  BACKUP_APP,
  BACKUP_DATA_KEYS,
  BACKUP_SCHEMA_VERSION,
  BackupDataSchema,
  BackupManifestSchema,
  photoFileName,
  thumbFileName,
  type BackupBundle,
  type BackupData,
  type BackupPhoto,
} from '../../domain/backup';
import { SEED_VERSION, seedDatabase } from '../seed';
import { db, type ClosetTraceDB } from '../schema';

export const APP_VERSION = '0.1.0';

export type BackupMode = 'merge' | 'replace';

export interface ImportSummary {
  mode: BackupMode;
  items: number;
  outfits: number;
  wearLogs: number;
  photos: number;
  missingPhotos: number;
}

export interface BuildBackupOptions {
  includePhotos?: boolean;
}

const MAIN_KEYS = [
  'items',
  'categories',
  'locations',
  'outfits',
  'scenes',
  'wishlistItems',
  'settings',
] as const;

const LOG_KEYS = ['wearLogs', 'purchases', 'priceQuotes', 'outfitFeedback'] as const;

export async function buildBackup(
  database: ClosetTraceDB = db,
  options: BuildBackupOptions = {},
): Promise<BackupBundle> {
  const includePhotos = options.includePhotos ?? false;
  const results = await Promise.all(
    BACKUP_DATA_KEYS.map((key) => database.table(key).toArray()),
  );
  const data = Object.fromEntries(
    BACKUP_DATA_KEYS.map((key, index) => [key, results[index]]),
  ) as unknown as BackupData;

  const photos = new Map<string, Uint8Array>();
  const rawPhotos = data.itemPhotos as unknown as ItemPhoto[];
  data.itemPhotos = await Promise.all(
    rawPhotos.map(async (photo) => {
      if (includePhotos) {
        photos.set(photoFileName(photo.id), await blobToBytes(photo.blob));
        photos.set(thumbFileName(photo.id), await blobToBytes(photo.thumbBlob));
      }
      const rest: BackupPhoto = {
        id: photo.id,
        itemId: photo.itemId,
        width: photo.width,
        height: photo.height,
        bytes: photo.bytes,
        order: photo.order,
        createdAt: photo.createdAt,
        fileName: photoFileName(photo.id),
        thumbName: thumbFileName(photo.id),
      };
      return rest;
    }),
  );

  const counts = Object.fromEntries(BACKUP_DATA_KEYS.map((key) => [key, data[key].length]));
  const totalBytes = rawPhotos.reduce((sum, photo) => sum + photo.bytes, 0);

  return {
    manifest: {
      app: BACKUP_APP,
      appVersion: APP_VERSION,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      seedVersion: SEED_VERSION,
      exportedAt: new Date().toISOString(),
      includesPhotos: includePhotos,
      counts,
      totalBytes,
    },
    data,
    photos,
  };
}

export async function importBackup(
  database: ClosetTraceDB,
  backup: BackupBundle,
  mode: BackupMode,
): Promise<ImportSummary> {
  const manifestResult = BackupManifestSchema.safeParse(backup.manifest);
  if (!manifestResult.success) throw new Error('备份清单格式不正确');
  if (manifestResult.data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('备份版本过新，请升级衣迹');
  }

  const dataResult = BackupDataSchema.safeParse(backup.data);
  if (!dataResult.success) throw new Error('备份数据格式不正确');
  const data = dataResult.data as unknown as BackupData;

  const summary: ImportSummary = {
    mode,
    items: 0,
    outfits: 0,
    wearLogs: 0,
    photos: 0,
    missingPhotos: 0,
  };

  const dataTables = database.tables.filter((table) => table.name !== 'diagnostics');
  await database.transaction('rw', dataTables, async () => {
    if (mode === 'replace') {
      await restoreAll(database, data, backup.photos, summary);
      return;
    }
    await mergeAll(database, data, backup.photos, summary);
  });

  await database.settings.delete('seedVersion');
  await seedDatabase(database);

  return summary;
}

async function mergeAll(
  database: ClosetTraceDB,
  data: BackupData,
  photos: Map<string, Uint8Array>,
  summary: ImportSummary,
): Promise<void> {
  const changedItems = new Set<string>();
  const changedOutfits = new Set<string>();

  for (const key of MAIN_KEYS) {
    const table = database.table(key);
    for (const row of rowsOf(data, key)) {
      if (key === 'settings' && row.key === 'seedVersion') continue;
      if ((key === 'categories' || key === 'scenes') && row.isBuiltIn === true) continue;

      const id = String(key === 'settings' ? row.key : row.id);
      const existing = await table.get(id);
      if (!existing) {
        await table.add(row);
        if (key === 'items') {
          changedItems.add(id);
          summary.items += 1;
        }
        if (key === 'outfits') {
          changedOutfits.add(id);
          summary.outfits += 1;
        }
        continue;
      }

      if (!isNewer(row, existing)) continue;
      await table.put(row);
      if (key === 'items') {
        changedItems.add(id);
        summary.items += 1;
      }
      if (key === 'outfits') {
        changedOutfits.add(id);
        summary.outfits += 1;
      }
    }
  }

  for (const key of LOG_KEYS) {
    const table = database.table(key);
    for (const row of rowsOf(data, key)) {
      if (await table.get(String(row.id))) continue;
      await table.add(row);
      if (key === 'wearLogs') summary.wearLogs += 1;
    }
  }

  const outfitsById = groupBy(data.outfitItems, (row) => String(row.outfitId));
  for (const outfitId of changedOutfits) {
    const children = (outfitsById.get(outfitId) ?? []) as unknown as OutfitItem[];
    await database.outfitItems.where('outfitId').equals(outfitId).delete();
    if (children.length > 0) await database.outfitItems.bulkPut(children);
  }

  const photosByItem = groupBy(data.itemPhotos, (row) => String(row.itemId));
  for (const [itemId, rows] of photosByItem) {
    if (!changedItems.has(itemId)) continue;
    const restored = await restorePhotoRows(database, rows, photos, summary);
    if (restored.materialized === 0) continue;
    await database.itemPhotos.where('itemId').equals(itemId).delete();
    if (restored.rows.length > 0) await database.itemPhotos.bulkPut(restored.rows);
  }
}

async function restoreAll(
  database: ClosetTraceDB,
  data: BackupData,
  photos: Map<string, Uint8Array>,
  summary: ImportSummary,
): Promise<void> {
  for (const key of BACKUP_DATA_KEYS) {
    await database.table(key).clear();
  }

  for (const key of BACKUP_DATA_KEYS) {
    if (key === 'itemPhotos') continue;
    const rows = rowsOf(data, key).filter(
      (row) => key !== 'settings' || row.key !== 'seedVersion',
    );
    if (rows.length > 0) await database.table(key).bulkPut(rows);
  }

  const restored = await restorePhotoRows(
    database,
    data.itemPhotos as unknown as Array<Record<string, unknown>>,
    photos,
    summary,
  );
  if (restored.rows.length > 0) await database.itemPhotos.bulkPut(restored.rows);

  summary.items = data.items.length;
  summary.outfits = data.outfits.length;
  summary.wearLogs = data.wearLogs.length;
}

async function restorePhotoRows(
  database: ClosetTraceDB,
  rows: Array<Record<string, unknown>>,
  photos: Map<string, Uint8Array>,
  summary: ImportSummary,
): Promise<{ rows: ItemPhoto[]; materialized: number }> {
  const restored: ItemPhoto[] = [];
  let materialized = 0;

  for (const raw of rows) {
    const row = raw as unknown as BackupPhoto;
    const bytes = photos.get(photoFileName(row.id));
    const thumbBytes = photos.get(thumbFileName(row.id));
    if (!bytes && !thumbBytes) {
      const existing = await database.itemPhotos.get(row.id);
      if (existing) {
        restored.push(existing);
        materialized += 1;
      } else {
        summary.missingPhotos += 1;
      }
      continue;
    }

    const blobBytes = bytes ?? thumbBytes!;
    const thumb = thumbBytes ?? blobBytes;
    restored.push({
      id: row.id,
      itemId: row.itemId,
      blob: bytesToBlob(blobBytes),
      thumbBlob: bytesToBlob(thumb),
      width: row.width,
      height: row.height,
      bytes: row.bytes,
      order: row.order,
      createdAt: row.createdAt,
    });
    materialized += 1;
    summary.photos += 1;
  }

  return { rows: restored, materialized };
}

function rowsOf(
  data: BackupData,
  key: (typeof BACKUP_DATA_KEYS)[number] | (typeof MAIN_KEYS)[number] | (typeof LOG_KEYS)[number],
): Array<Record<string, unknown>> {
  return data[key] as unknown as Array<Record<string, unknown>>;
}

function groupBy<T>(
  rows: T[],
  keyOf: (row: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

function isNewer(incoming: Record<string, unknown>, existing: Record<string, unknown>): boolean {
  const incomingAt = typeof incoming.updatedAt === 'string' ? incoming.updatedAt : '';
  const existingAt = typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
  return incomingAt > existingAt;
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function bytesToBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes).buffer]);
}
