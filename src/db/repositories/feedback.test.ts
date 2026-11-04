import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { listFeedback, recordFeedback } from './feedback';

beforeEach(async () => {
  await db.outfitFeedback.clear();
});

describe('feedback repository', () => {
  it('records a rating for a signature', async () => {
    await recordFeedback({
      signature: 'a|b|c',
      sceneId: 'builtin:scene:commute',
      rating: 'like',
    });

    const rows = await listFeedback();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      signature: 'a|b|c',
      sceneId: 'builtin:scene:commute',
      rating: 'like',
    });
    expect(rows[0].createdAt).toBeTruthy();
  });

  it('replaces an earlier rating for the same signature', async () => {
    await recordFeedback({ signature: 'a|b|c', rating: 'dislike' });
    await recordFeedback({ signature: 'a|b|c', rating: 'like' });

    const rows = await listFeedback();
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe('like');
  });

  it('keeps ratings for different signatures', async () => {
    await recordFeedback({ signature: 'a|b|c', rating: 'like' });
    await recordFeedback({ signature: 'a|b|d', rating: 'dislike' });

    expect(await listFeedback()).toHaveLength(2);
  });
});
