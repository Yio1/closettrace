import { describe, expect, it } from 'vitest';
import { ClosetTraceDB } from './schema';
import { seedDatabase } from './seed';

describe('seedDatabase', () => {
  it('seeds dictionary content but no garments', async () => {
    const db = new ClosetTraceDB('seed-test');
    await seedDatabase(db);
    expect(await db.categories.count()).toBeGreaterThanOrEqual(50);
    expect(await db.scenes.count()).toBe(9);
    expect(await db.colors.count()).toBeGreaterThanOrEqual(20);
    expect(await db.styleTags.count()).toBe(10);
    expect(await db.items.count()).toBe(0);
    expect(await db.outfits.count()).toBe(0);
    expect(await db.wearLogs.count()).toBe(0);
    await db.delete();
  });

  it('is idempotent', async () => {
    const db = new ClosetTraceDB('seed-idempotent');
    await seedDatabase(db);
    const before = await db.categories.count();
    await seedDatabase(db);
    expect(await db.categories.count()).toBe(before);
    await db.delete();
  });
});
