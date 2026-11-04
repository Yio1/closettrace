import type { OutfitFeedback } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export interface RecordFeedbackInput {
  signature: string;
  sceneId?: string;
  rating: OutfitFeedback['rating'];
  reason?: string;
}

export async function recordFeedback(
  input: RecordFeedbackInput,
  database: ClosetTraceDB = db,
): Promise<void> {
  const now = new Date().toISOString();
  await database.transaction('rw', database.outfitFeedback, async () => {
    await database.outfitFeedback.where('signature').equals(input.signature).delete();
    await database.outfitFeedback.add({
      id: crypto.randomUUID(),
      signature: input.signature,
      sceneId: input.sceneId,
      rating: input.rating,
      reason: input.reason,
      createdAt: now,
    });
  });
}

export async function listFeedback(database: ClosetTraceDB = db): Promise<OutfitFeedback[]> {
  const rows = await database.outfitFeedback.toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
