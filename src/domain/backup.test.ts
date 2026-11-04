import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { backupV1Data, emptyBackupData, manifestFor } from '../test/fixtures/backup-v1';
import {
  BACKUP_SCHEMA_VERSION,
  exportBackupZip,
  photoFileName,
  thumbFileName,
  validateBackup,
  type BackupBundle,
} from './backup';

function bundleFrom(
  data = backupV1Data(),
  photos = new Map<string, Uint8Array>(),
): BackupBundle {
  return {
    manifest: manifestFor(data, { includesPhotos: photos.size > 0 }),
    data,
    photos,
  };
}

describe('backup zip', () => {
  it('writes manifest with schema version, seed version and counts', () => {
    const data = backupV1Data();
    const zip = exportBackupZip(bundleFrom(data));
    const files = unzipSync(zip);
    const manifest = JSON.parse(strFromU8(files['manifest.json'])) as Record<string, unknown>;

    expect(manifest.app).toBe('closettrace');
    expect(manifest.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(manifest.seedVersion).toBe(1);
    expect(manifest.counts).toMatchObject({ items: 1, wearLogs: 0, wishlistItems: 0 });
    expect(files['data.json']).toBeTruthy();
  });

  it('never writes diagnostics into the archive', () => {
    const zip = exportBackupZip(bundleFrom());
    const files = unzipSync(zip);
    const payload = JSON.parse(strFromU8(files['data.json'])) as Record<string, unknown>;

    expect(payload).not.toHaveProperty('diagnostics');
    expect(Object.keys(payload).sort()).toEqual(
      [
        'categories',
        'colors',
        'items',
        'itemPhotos',
        'locations',
        'outfitFeedback',
        'outfitItems',
        'outfits',
        'priceQuotes',
        'purchases',
        'scenes',
        'settings',
        'styleTags',
        'wearLogs',
        'wishlistItems',
      ].sort(),
    );
  });

  it('omits photo bytes when includePhotos is false', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const bundle = bundleFrom(emptyBackupData(), new Map([['photos/p1.jpg', bytes]]));
    const files = unzipSync(exportBackupZip(bundle, false));

    expect(files['photos/p1.jpg']).toBeUndefined();
    const manifest = JSON.parse(strFromU8(files['manifest.json'])) as { includesPhotos: boolean };
    expect(manifest.includesPhotos).toBe(false);
  });

  it('round-trips photo bytes', async () => {
    const data = emptyBackupData();
    const bytes = new Uint8Array([9, 8, 7]);
    const thumb = new Uint8Array([4, 5]);
    const bundle = bundleFrom(
      data,
      new Map([
        [photoFileName('photo-1'), bytes],
        [thumbFileName('photo-1'), thumb],
      ]),
    );

    const restored = await validateBackup(exportBackupZip(bundle));

    expect(Array.from(restored.photos.get(photoFileName('photo-1')) ?? [])).toEqual([9, 8, 7]);
    expect(Array.from(restored.photos.get(thumbFileName('photo-1')) ?? [])).toEqual([4, 5]);
    expect(restored.manifest.includesPhotos).toBe(true);
    expect(restored.data.items).toHaveLength(0);
  });

  it('rejects a zip without a manifest', async () => {
    const zip = zipSync({ 'data.json': strToU8(JSON.stringify(emptyBackupData())) });
    await expect(validateBackup(zip)).rejects.toThrow('备份缺少 manifest.json');
  });

  it('rejects invalid manifest JSON', async () => {
    const zip = zipSync({
      'manifest.json': strToU8('{not json'),
      'data.json': strToU8(JSON.stringify(emptyBackupData())),
    });
    await expect(validateBackup(zip)).rejects.toThrow('备份文件格式不正确');
  });

  it('rejects a manifest with a newer schema version', async () => {
    const data = emptyBackupData();
    const manifest = manifestFor(data, { schemaVersion: BACKUP_SCHEMA_VERSION + 1 });
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'data.json': strToU8(JSON.stringify(data)),
    });
    await expect(validateBackup(zip)).rejects.toThrow('备份版本过新，请升级衣迹');
  });

  it('rejects a zip without data.json', async () => {
    const zip = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifestFor(emptyBackupData()))) });
    await expect(validateBackup(zip)).rejects.toThrow('备份缺少 data.json');
  });

  it('rejects malformed data rows', async () => {
    const manifest = manifestFor(emptyBackupData());
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'data.json': strToU8(JSON.stringify({ ...emptyBackupData(), items: [{ name: '无 id' }] })),
    });
    await expect(validateBackup(zip)).rejects.toThrow('备份数据格式不正确');
  });

  it('rejects bytes that are not a zip archive', async () => {
    await expect(validateBackup(strToU8('not a zip'))).rejects.toThrow('备份文件损坏');
  });
});
