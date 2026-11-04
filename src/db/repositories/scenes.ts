import type { Scene } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export async function listScenes(
  includeArchived = false,
  database: ClosetTraceDB = db,
): Promise<Scene[]> {
  const scenes = await database.scenes.orderBy('order').toArray();
  return includeArchived ? scenes : scenes.filter((scene) => !scene.archived);
}
