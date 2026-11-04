import type { BackupData, BackupManifest } from '../../domain/backup';
import { makeItem } from './wardrobe';

export function emptyBackupData(): BackupData {
  return {
    items: [],
    itemPhotos: [],
    categories: [],
    locations: [],
    outfits: [],
    outfitItems: [],
    wearLogs: [],
    scenes: [],
    outfitFeedback: [],
    purchases: [],
    wishlistItems: [],
    priceQuotes: [],
    colors: [],
    styleTags: [],
    settings: [],
  };
}

export function manifestFor(
  data: BackupData,
  overrides: Partial<BackupManifest> = {},
): BackupManifest {
  return {
    app: 'closettrace',
    appVersion: '0.1.0',
    schemaVersion: 1,
    seedVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    includesPhotos: false,
    counts: Object.fromEntries(
      Object.entries(data).map(([key, rows]) => [key, Array.isArray(rows) ? rows.length : 0]),
    ),
    totalBytes: 0,
    ...overrides,
  };
}

export function backupV1Data(): BackupData {
  const data = emptyBackupData();
  data.items = [
    makeItem({
      id: 'item-1',
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
    }),
  ];
  return data;
}
