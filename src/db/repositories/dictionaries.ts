import type { ColorSwatch, StyleTag } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export async function listColors(database: ClosetTraceDB = db): Promise<ColorSwatch[]> {
  return database.colors.orderBy('order').toArray();
}

export async function listStyleTags(database: ClosetTraceDB = db): Promise<StyleTag[]> {
  return database.styleTags.orderBy('order').toArray();
}
