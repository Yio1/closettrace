import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BackupBundle } from '../../domain/backup';
import { photoFileName, thumbFileName } from '../../domain/backup';
import { backupV1Data, emptyBackupData, manifestFor } from '../../test/fixtures/backup-v1';
import { makeItem } from '../../test/fixtures/wardrobe';
import type { Outfit, OutfitItem, WearLog } from '../../domain/types';
import { ClosetTraceDB } from '../schema';
import { SEED_VERSION, seedDatabase } from '../seed';
import { buildBackup, importBackup } from './backup';
import { savePhoto } from './photos';

// fake-indexeddb clones with structuredClone, which cannot serialize jsdom's Blob.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

let database: ClosetTraceDB;

const compressed = {
  blob: new Blob(['full'], { type: 'image/jpeg' }),
  thumbBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
  bytes: 4,
};

function bundle(
  data = emptyBackupData(),
  photos = new Map<string, Uint8Array>(),
): BackupBundle {
  return { manifest: manifestFor(data, { includesPhotos: photos.size > 0 }), data, photos };
}

function makeOutfitRow(overrides: Partial<Outfit> & Pick<Outfit, 'id' | 'name'>): Outfit {
  return {
    sceneIds: [],
    isFavorite: false,
    source: 'manual',
    wearCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeWearLog(overrides: Partial<WearLog> & Pick<WearLog, 'id' | 'date'>): WearLog {
  return {
    itemIds: [],
    items: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  database = new ClosetTraceDB('backup-test');
  await database.open();
  await Promise.all(database.tables.map((table) => table.clear()));
  await seedDatabase(database);
});

describe('backup repository', () => {
  it('builds a manifest with versions and counts while excluding diagnostics', async () => {
    await database.items.put(
      makeItem({
        id: 'item-1',
        name: '白衬衫',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
      }),
    );
    await database.diagnostics.put({
      id: 'diag-1',
      at: '2026-01-01T00:00:00.000Z',
      level: 'warn',
      message: '测试',
    });

    const backup = await buildBackup(database);

    expect(backup.manifest.schemaVersion).toBe(1);
    expect(backup.manifest.seedVersion).toBe(SEED_VERSION);
    expect(backup.manifest.exportedAt).toMatch(/T/);
    expect(backup.manifest.counts.items).toBe(1);
    expect(backup.manifest.counts.diagnostics).toBeUndefined();
    expect(backup.data.items).toHaveLength(1);
    expect(backup.data).not.toHaveProperty('diagnostics');
  });

  it('collects photo bytes when includePhotos is on', async () => {
    const item = makeItem({
      id: 'item-1',
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
    });
    await database.items.put(item);
    const photo = await savePhoto(item.id, compressed, database);

    const backup = await buildBackup(database, { includePhotos: true });

    expect(backup.manifest.includesPhotos).toBe(true);
    expect(backup.manifest.totalBytes).toBe(compressed.bytes);
    const bytes = backup.photos.get(photoFileName(photo.id));
    expect(bytes && new TextDecoder().decode(bytes)).toBe('full');
    const thumb = backup.photos.get(thumbFileName(photo.id));
    expect(thumb && new TextDecoder().decode(thumb)).toBe('thumb');
  });

  it('merge keeps newer local items and appends missing ones', async () => {
    await database.items.bulkPut([
      makeItem({
        id: 'item-older',
        name: '本地旧版',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      makeItem({
        id: 'item-newer',
        name: '本地新版',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
        updatedAt: '2026-03-01T00:00:00.000Z',
      }),
    ]);
    const originalCategory = await database.categories.get('builtin:cat:shirt');

    const data = emptyBackupData();
    data.items = [
      makeItem({
        id: 'item-older',
        name: '备份版',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
        updatedAt: '2026-02-01T00:00:00.000Z',
      }),
      makeItem({
        id: 'item-newer',
        name: '备份旧版',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
        updatedAt: '2026-02-01T00:00:00.000Z',
      }),
      makeItem({
        id: 'item-added',
        name: '备份新增',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
        updatedAt: '2026-02-01T00:00:00.000Z',
      }),
    ];
    data.categories = [
      {
        ...originalCategory!,
        name: '被篡改',
        updatedAt: '2027-01-01T00:00:00.000Z',
      },
    ];

    const summary = await importBackup(database, bundle(data), 'merge');

    expect((await database.items.get('item-older'))?.name).toBe('备份版');
    expect((await database.items.get('item-newer'))?.name).toBe('本地新版');
    expect((await database.items.get('item-added'))?.name).toBe('备份新增');
    expect((await database.categories.get('builtin:cat:shirt'))?.name).toBe(
      originalCategory?.name,
    );
    expect(summary.mode).toBe('merge');
    expect(summary.items).toBe(2);
  });

  it('merge dedupes wear logs by id and appends new ones', async () => {
    await database.wearLogs.put(
      makeWearLog({ id: 'wear-1', date: '2026-01-01', note: '本地记录' }),
    );

    const data = emptyBackupData();
    data.wearLogs = [
      makeWearLog({ id: 'wear-1', date: '2026-01-01', note: '备份记录' }),
      makeWearLog({ id: 'wear-2', date: '2026-01-02' }),
    ];

    const summary = await importBackup(database, bundle(data), 'merge');

    expect(await database.wearLogs.count()).toBe(2);
    expect((await database.wearLogs.get('wear-1'))?.note).toBe('本地记录');
    expect(summary.wearLogs).toBe(1);
  });

  it('merge replaces child rows only for updated outfits', async () => {
    await database.outfits.bulkPut([
      makeOutfitRow({ id: 'outfit-1', name: '通勤搭配', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeOutfitRow({ id: 'outfit-2', name: '本地搭配', updatedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    const oldRow: OutfitItem = {
      id: 'outfit-item-old',
      outfitId: 'outfit-1',
      itemId: 'item-old',
      slot: 'top',
      order: 0,
    };
    const keptRow: OutfitItem = {
      id: 'outfit-item-kept',
      outfitId: 'outfit-2',
      itemId: 'item-kept',
      slot: 'top',
      order: 0,
    };
    await database.outfitItems.bulkPut([oldRow, keptRow]);

    const data = emptyBackupData();
    data.outfits = [
      makeOutfitRow({ id: 'outfit-1', name: '通勤搭配', updatedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    data.outfitItems = [
      { id: 'outfit-item-new', outfitId: 'outfit-1', itemId: 'item-new', slot: 'top', order: 0 },
    ];

    const summary = await importBackup(database, bundle(data), 'merge');

    const outfit1Rows = await database.outfitItems.where('outfitId').equals('outfit-1').toArray();
    expect(outfit1Rows.map((row) => row.id)).toEqual(['outfit-item-new']);
    expect(await database.outfitItems.get('outfit-item-kept')).toBeTruthy();
    expect(summary.outfits).toBe(1);
  });

  it('replace clears data tables, restores the backup and keeps diagnostics', async () => {
    await database.items.put(
      makeItem({
        id: 'local-only',
        name: '本地衣物',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
      }),
    );
    await database.wearLogs.put(makeWearLog({ id: 'local-wear', date: '2026-02-01' }));
    await database.diagnostics.put({
      id: 'diag-1',
      at: '2026-01-01T00:00:00.000Z',
      level: 'warn',
      message: '保留我',
    });

    const data = backupV1Data();
    data.wearLogs = [makeWearLog({ id: 'backup-wear', date: '2026-01-05' })];

    const summary = await importBackup(database, bundle(data), 'replace');

    expect((await database.items.toArray()).map((item) => item.id)).toEqual(['item-1']);
    expect((await database.wearLogs.toArray()).map((log) => log.id)).toEqual(['backup-wear']);
    expect(await database.diagnostics.count()).toBe(1);
    expect(await database.categories.get('builtin:cat:shirt')).toBeTruthy();
    expect(summary).toMatchObject({ mode: 'replace', items: 1, wearLogs: 1 });
  });

  it('restores photo bytes on import', async () => {
    const item = makeItem({
      id: 'item-1',
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
    });
    await database.items.put(item);
    const photo = await savePhoto(item.id, compressed, database);
    const exported = await buildBackup(database, { includePhotos: true });

    const target = new ClosetTraceDB('backup-photos');
    await target.open();
    await Promise.all(target.tables.map((table) => table.clear()));
    await seedDatabase(target);

    try {
      const summary = await importBackup(target, exported, 'replace');
      const restored = await target.itemPhotos.get(photo.id);
      expect(restored).toBeTruthy();
      expect(await restored?.blob.text()).toBe('full');
      expect(await restored?.thumbBlob.text()).toBe('thumb');
      expect((await target.items.get('item-1'))?.coverPhotoId).toBe(photo.id);
      expect(summary.photos).toBe(1);
      expect(summary.missingPhotos).toBe(0);
    } finally {
      target.close();
      await target.delete();
    }
  });

  it('reports missing photos on a data-only import without dropping refs', async () => {
    await database.items.put(
      makeItem({
        id: 'item-1',
        name: '白衬衫',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
        coverPhotoId: 'photo-missing',
        thumbPhotoId: 'photo-missing',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const data = emptyBackupData();
    data.items = [
      makeItem({
        id: 'item-1',
        name: '白衬衫（新）',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
        coverPhotoId: 'photo-missing',
        thumbPhotoId: 'photo-missing',
        updatedAt: '2026-02-01T00:00:00.000Z',
      }),
    ];
    data.itemPhotos = [
      {
        id: 'photo-missing',
        itemId: 'item-1',
        width: 800,
        height: 600,
        bytes: 100,
        order: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const summary = await importBackup(database, bundle(data), 'merge');

    expect((await database.items.get('item-1'))?.coverPhotoId).toBe('photo-missing');
    expect(await database.itemPhotos.count()).toBe(0);
    expect(summary.missingPhotos).toBe(1);
  });

  it('leaves the database untouched when the backup is invalid', async () => {
    await database.items.put(
      makeItem({
        id: 'local',
        name: '本地衣物',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
      }),
    );

    const data = emptyBackupData();
    data.items = [{ name: '缺少 id' } as never];

    await expect(importBackup(database, bundle(data), 'merge')).rejects.toThrow(
      '备份数据格式不正确',
    );
    expect(await database.items.get('local')).toBeTruthy();
    expect(await database.items.count()).toBe(1);
  });
});
