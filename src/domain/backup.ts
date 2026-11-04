import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import type {
  Category,
  ColorSwatch,
  Item,
  ItemPhoto,
  Location,
  Outfit,
  OutfitFeedback,
  OutfitItem,
  PriceQuote,
  Purchase,
  Scene,
  Setting,
  StyleTag,
  WearLog,
  WishlistItem,
} from './types';

export const BACKUP_APP = 'closettrace';
export const BACKUP_SCHEMA_VERSION = 1;

export type BackupPhoto = Omit<ItemPhoto, 'blob' | 'thumbBlob'> & {
  fileName?: string;
  thumbName?: string;
};

export interface BackupData {
  items: Item[];
  itemPhotos: BackupPhoto[];
  categories: Category[];
  locations: Location[];
  outfits: Outfit[];
  outfitItems: OutfitItem[];
  wearLogs: WearLog[];
  scenes: Scene[];
  outfitFeedback: OutfitFeedback[];
  purchases: Purchase[];
  wishlistItems: WishlistItem[];
  priceQuotes: PriceQuote[];
  colors: ColorSwatch[];
  styleTags: StyleTag[];
  settings: Setting[];
}

export const BACKUP_DATA_KEYS = [
  'items',
  'itemPhotos',
  'categories',
  'locations',
  'outfits',
  'outfitItems',
  'wearLogs',
  'scenes',
  'outfitFeedback',
  'purchases',
  'wishlistItems',
  'priceQuotes',
  'colors',
  'styleTags',
  'settings',
] as const satisfies ReadonlyArray<keyof BackupData>;

export interface BackupManifest {
  app: string;
  appVersion: string;
  schemaVersion: number;
  seedVersion: number;
  exportedAt: string;
  includesPhotos: boolean;
  counts: Record<string, number>;
  totalBytes: number;
}

export interface BackupBundle {
  manifest: BackupManifest;
  data: BackupData;
  photos: Map<string, Uint8Array>;
}

const idRow = z.object({ id: z.string().min(1) }).loose();
const idRows = z.array(idRow);
const settingRow = z.object({ key: z.string().min(1) }).loose();

export const BackupManifestSchema = z.object({
  app: z.literal(BACKUP_APP),
  appVersion: z.string(),
  schemaVersion: z.number().int().positive(),
  seedVersion: z.number().int().nonnegative(),
  exportedAt: z.string(),
  includesPhotos: z.boolean(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  totalBytes: z.number().int().nonnegative(),
});

export const BackupDataSchema = z.object({
  items: idRows,
  itemPhotos: idRows,
  categories: idRows,
  locations: idRows,
  outfits: idRows,
  outfitItems: idRows,
  wearLogs: idRows,
  scenes: idRows,
  outfitFeedback: idRows,
  purchases: idRows,
  wishlistItems: idRows,
  priceQuotes: idRows,
  colors: idRows,
  styleTags: idRows,
  settings: z.array(settingRow),
});

export function photoFileName(photoId: string): string {
  return `photos/${photoId}.jpg`;
}

export function thumbFileName(photoId: string): string {
  return `thumbs/${photoId}.jpg`;
}

export function exportBackupZip(
  bundle: BackupBundle,
  includePhotos = bundle.manifest.includesPhotos,
): Uint8Array {
  const manifest: BackupManifest = { ...bundle.manifest, includesPhotos: includePhotos };
  const entries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'data.json': strToU8(JSON.stringify(bundle.data)),
  };
  if (includePhotos) {
    for (const [path, bytes] of bundle.photos) entries[path] = bytes;
  }
  return zipSync(entries);
}

export async function validateBackup(zipBytes: Uint8Array): Promise<BackupBundle> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes);
  } catch {
    throw new Error('备份文件损坏');
  }

  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw new Error('备份缺少 manifest.json');

  const manifest = parseJsonFile(manifestBytes);
  const manifestResult = BackupManifestSchema.safeParse(manifest);
  if (!manifestResult.success) throw new Error('备份清单格式不正确');
  if (manifestResult.data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('备份版本过新，请升级衣迹');
  }

  const dataBytes = files['data.json'];
  if (!dataBytes) throw new Error('备份缺少 data.json');

  const data = parseJsonFile(dataBytes);
  const dataResult = BackupDataSchema.safeParse(data);
  if (!dataResult.success) throw new Error('备份数据格式不正确');

  const photos = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith('photos/') || path.startsWith('thumbs/')) photos.set(path, bytes);
  }

  return {
    manifest: manifestResult.data,
    data: dataResult.data as unknown as BackupData,
    photos,
  };
}

function parseJsonFile(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new Error('备份文件格式不正确');
  }
}
