import { beforeEach, describe, expect, it } from 'vitest';
import { ClosetTraceDB } from '../schema';
import { seedDatabase } from '../seed';
import { saveOutfit } from './outfits';
import { archiveScene, createScene, listScenes, updateScene } from './scenes';

let database: ClosetTraceDB;

beforeEach(async () => {
  database = new ClosetTraceDB('scenes-test');
  await database.open();
  await Promise.all([
    database.scenes.clear(),
    database.outfits.clear(),
    database.outfitItems.clear(),
    database.settings.clear(),
  ]);
  await seedDatabase(database);
});

async function customScene(name = '周末露营') {
  return createScene(
    {
      name,
      formalityMin: 1,
      formalityMax: 2,
      requiredSlots: ['top', 'bottom', 'shoes'],
      optionalSlots: ['outer'],
      styleTags: ['休闲'],
    },
    database,
  );
}

describe('scene repository', () => {
  it('lists built-in scenes sorted by order', async () => {
    const scenes = await listScenes(false, database);
    expect(scenes[0].id).toBe('builtin:scene:commute');
    expect(scenes.every((scene) => scene.isBuiltIn)).toBe(true);
  });

  it('creates, updates, and archives a custom scene', async () => {
    const id = await customScene();
    const created = (await listScenes(false, database)).find((scene) => scene.id === id);
    expect(created).toMatchObject({
      name: '周末露营',
      formalityMin: 1,
      formalityMax: 2,
      isBuiltIn: false,
      archived: false,
    });

    await updateScene(id, { name: '郊野露营' }, database);
    expect((await listScenes(false, database)).find((scene) => scene.id === id)?.name).toBe(
      '郊野露营',
    );

    await archiveScene(id, database);
    expect((await listScenes(false, database)).some((scene) => scene.id === id)).toBe(false);
    expect((await listScenes(true, database)).find((scene) => scene.id === id)?.archived).toBe(true);
  });

  it('keeps outfit history when a referenced scene is archived', async () => {
    const id = await customScene();
    const outfitId = await saveOutfit(
      {
        name: '露营套装',
        sceneIds: [id],
        items: [
          { itemId: 'item-top', slot: 'top', order: 0 },
          { itemId: 'item-bottom', slot: 'bottom', order: 1 },
        ],
      },
      database,
    );

    await archiveScene(id, database);

    const outfit = await database.outfits.get(outfitId);
    expect(outfit?.sceneIds).toEqual([id]);
    expect((await listScenes(false, database)).some((scene) => scene.id === id)).toBe(false);
  });

  it('refuses to modify or archive a built-in scene', async () => {
    await expect(
      updateScene('builtin:scene:casual', { name: '随便' }, database),
    ).rejects.toThrow('内置场景不可修改');
    await expect(archiveScene('builtin:scene:casual', database)).rejects.toThrow(
      '内置场景不可归档',
    );
  });
});
