import { beforeEach, describe, expect, it } from 'vitest';
import { ClosetTraceDB } from '../schema';
import { createItem } from './items';
import { createLocation, deleteLocation, listLocations, updateLocation } from './locations';

let database: ClosetTraceDB;

beforeEach(async () => {
  database = new ClosetTraceDB('locations-test');
  await database.open();
  await Promise.all([database.locations.clear(), database.items.clear()]);
});

async function location(name = '主衣柜', parentId?: string) {
  return createLocation({ name, parentId }, database);
}

describe('location repository', () => {
  it('creates locations with sibling order and updates names', async () => {
    const first = await location('主衣柜');
    const second = await location('鞋柜');
    const rows = await listLocations(database);
    expect(rows.map((row) => row.id)).toEqual([first, second]);
    expect(rows[1].order).toBe(2);

    await updateLocation(first, { detail: '左侧挂杆' }, database);
    const updated = (await listLocations(database)).find((row) => row.id === first);
    expect(updated?.detail).toBe('左侧挂杆');
  });

  it('refuses to delete a location with children', async () => {
    const parent = await location('主衣柜');
    await location('挂杆', parent);
    await expect(deleteLocation(parent, database)).rejects.toThrow(
      '该位置下还有衣物或子位置，先清空后再删除',
    );
  });

  it('refuses to delete a location with items', async () => {
    const id = await location();
    await createItem(
      {
        name: '白衬衫',
        categoryId: 'builtin:cat:shirt',
        colorPrimaryId: 'builtin:color:white',
        warmth: 2,
        formality: 3,
        seasons: ['all'],
        locationId: id,
      },
      database,
    );
    await expect(deleteLocation(id, database)).rejects.toThrow(
      '该位置下还有衣物或子位置，先清空后再删除',
    );
  });

  it('deletes an empty location', async () => {
    const id = await location();
    await deleteLocation(id, database);
    expect(await listLocations(database)).toHaveLength(0);
  });
});
