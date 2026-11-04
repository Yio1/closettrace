import { beforeEach, describe, expect, it } from 'vitest';
import { ClosetTraceDB } from '../schema';
import { createItem } from './items';
import { getPhoto, getThumb, listPhotos, removePhoto, savePhoto, setCover } from './photos';

let database: ClosetTraceDB;
let itemId: string;

const compressed = {
  blob: new Blob(['full'], { type: 'image/jpeg' }),
  thumbBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
  bytes: 4,
};

beforeEach(async () => {
  database = new ClosetTraceDB('photos-test');
  await database.open();
  await Promise.all([database.items.clear(), database.itemPhotos.clear()]);
  itemId = await createItem(
    {
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
      warmth: 2,
      formality: 3,
      seasons: ['all'],
    },
    database,
  );
});

describe('photo repository', () => {
  it('adds photos and uses the first as cover and thumb', async () => {
    const first = await savePhoto(itemId, compressed, database);
    const second = await savePhoto(itemId, compressed, database);

    const item = await database.items.get(itemId);
    expect(item?.coverPhotoId).toBe(first.id);
    expect(item?.thumbPhotoId).toBe(first.id);
    expect(second.order).toBe(1);
    expect(await listPhotos(itemId, database)).toHaveLength(2);
  });

  it('returns photo and thumbnail blobs', async () => {
    const photo = await savePhoto(itemId, compressed, database);
    expect((await getPhoto(photo.id, database))?.itemId).toBe(itemId);
    expect(await getThumb(photo.id, database)).toBeDefined();
  });

  it('changes the cover photo', async () => {
    const first = await savePhoto(itemId, compressed, database);
    const second = await savePhoto(itemId, compressed, database);
    await setCover(itemId, second.id, database);

    const item = await database.items.get(itemId);
    expect(item?.coverPhotoId).toBe(second.id);
    expect(item?.thumbPhotoId).toBe(second.id);
    expect(item?.coverPhotoId).not.toBe(first.id);
  });

  it('falls back to the next photo when the cover is removed', async () => {
    const first = await savePhoto(itemId, compressed, database);
    const second = await savePhoto(itemId, compressed, database);
    await removePhoto(first.id, database);

    const item = await database.items.get(itemId);
    expect(item?.coverPhotoId).toBe(second.id);
    expect(await database.itemPhotos.count()).toBe(1);
  });

  it('clears cover fields when the last photo is removed', async () => {
    const photo = await savePhoto(itemId, compressed, database);
    await removePhoto(photo.id, database);

    const item = await database.items.get(itemId);
    expect(item?.coverPhotoId).toBeUndefined();
    expect(item?.thumbPhotoId).toBeUndefined();
  });

  it('refuses more than five photos', async () => {
    for (let index = 0; index < 5; index += 1) {
      await savePhoto(itemId, compressed, database);
    }
    await expect(savePhoto(itemId, compressed, database)).rejects.toThrow('最多 5 张照片');
  });

  it('lists photos in display order', async () => {
    const first = await savePhoto(itemId, compressed, database);
    const second = await savePhoto(itemId, compressed, database);
    const photos = await listPhotos(itemId, database);
    expect(photos.map((photo) => photo.id)).toEqual([first.id, second.id]);
  });
});
