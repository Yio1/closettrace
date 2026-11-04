import type { ItemPhoto } from '../../domain/types';
import { compressImage, type CompressedPhoto } from '../../lib/image';
import { db, type ClosetTraceDB } from '../schema';

export const MAX_PHOTOS = 5;

function nowISO(): string {
  return new Date().toISOString();
}

export async function savePhoto(
  itemId: string,
  photo: CompressedPhoto,
  database: ClosetTraceDB = db,
): Promise<ItemPhoto> {
  return database.transaction('rw', [database.items, database.itemPhotos], async () => {
    const existing = await database.itemPhotos.where('itemId').equals(itemId).toArray();
    if (existing.length >= MAX_PHOTOS) throw new Error(`最多 ${MAX_PHOTOS} 张照片`);

    const order = existing.reduce((max, row) => Math.max(max, row.order), -1) + 1;
    const row: ItemPhoto = {
      id: crypto.randomUUID(),
      itemId,
      blob: photo.blob,
      thumbBlob: photo.thumbBlob,
      width: photo.width,
      height: photo.height,
      bytes: photo.bytes,
      order,
      createdAt: nowISO(),
    };
    await database.itemPhotos.add(row);

    await database.items.where('id').equals(itemId).modify((item) => {
      if (item.coverPhotoId) return;
      item.coverPhotoId = row.id;
      item.thumbPhotoId = row.id;
      item.updatedAt = nowISO();
    });

    return row;
  });
}

export async function addPhoto(
  itemId: string,
  file: File,
  database: ClosetTraceDB = db,
): Promise<ItemPhoto> {
  return savePhoto(itemId, await compressImage(file), database);
}

export async function removePhoto(photoId: string, database: ClosetTraceDB = db): Promise<void> {
  const photo = await database.itemPhotos.get(photoId);
  if (!photo) return;

  await database.transaction('rw', [database.items, database.itemPhotos], async () => {
    await database.itemPhotos.delete(photoId);
    const remaining = await database.itemPhotos
      .where('itemId')
      .equals(photo.itemId)
      .sortBy('order');
    const fallback = remaining[0];

    await database.items.where('id').equals(photo.itemId).modify((item) => {
      if (item.coverPhotoId !== photoId && item.thumbPhotoId !== photoId) return;
      if (fallback) {
        item.coverPhotoId = fallback.id;
        item.thumbPhotoId = fallback.id;
      } else {
        delete item.coverPhotoId;
        delete item.thumbPhotoId;
      }
      item.updatedAt = nowISO();
    });
  });
}

export async function setCover(
  itemId: string,
  photoId: string,
  database: ClosetTraceDB = db,
): Promise<void> {
  const photo = await database.itemPhotos.get(photoId);
  if (!photo || photo.itemId !== itemId) return;
  await database.items.update(itemId, {
    coverPhotoId: photoId,
    thumbPhotoId: photoId,
    updatedAt: nowISO(),
  });
}

export async function getPhoto(
  id: string,
  database: ClosetTraceDB = db,
): Promise<ItemPhoto | undefined> {
  return database.itemPhotos.get(id);
}

export async function getThumb(
  id: string,
  database: ClosetTraceDB = db,
): Promise<Blob | undefined> {
  return (await database.itemPhotos.get(id))?.thumbBlob;
}

export async function listPhotos(
  itemId: string,
  database: ClosetTraceDB = db,
): Promise<ItemPhoto[]> {
  return database.itemPhotos.where('itemId').equals(itemId).sortBy('order');
}
