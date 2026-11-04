import { beforeEach, describe, expect, it } from 'vitest';
import { ClosetTraceDB } from '../schema';
import { seedDatabase } from '../seed';
import { createItem } from './items';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from './categories';

let database: ClosetTraceDB;

beforeEach(async () => {
  database = new ClosetTraceDB('categories-test');
  await database.open();
  await Promise.all([database.categories.clear(), database.items.clear(), database.settings.clear()]);
  await seedDatabase(database);
});

async function customCategory(name = '工装衬衫', parentId = 'builtin:cat:top') {
  return createCategory(
    {
      name,
      parentId,
      slot: 'top',
      defaultFormality: 2,
      defaultWarmth: 2,
      defaultSeasons: ['all'],
    },
    database,
  );
}

describe('category repository', () => {
  it('lists built-in categories sorted by order', async () => {
    const categories = await listCategories(false, database);
    expect(categories[0].id).toBe('builtin:cat:top');
    expect(categories.some((category) => category.name === 'T 恤')).toBe(true);
  });

  it('creates and updates a custom category', async () => {
    const id = await customCategory();
    const created = (await listCategories(false, database)).find((category) => category.id === id);
    expect(created).toMatchObject({ name: '工装衬衫', isBuiltIn: false, archived: false });

    await updateCategory(id, { name: '工装衬衣' }, database);
    const updated = (await listCategories(false, database)).find((category) => category.id === id);
    expect(updated?.name).toBe('工装衬衣');
  });

  it('refuses to delete a built-in category', async () => {
    await expect(deleteCategory('builtin:cat:shirt', database)).rejects.toThrow(
      '内置类型不可删除',
    );
  });

  it('refuses to delete a category that still has items', async () => {
    const id = await customCategory();
    await createItem(
      {
        name: '白衬衫',
        categoryId: id,
        colorPrimaryId: 'builtin:color:white',
        warmth: 2,
        formality: 3,
        seasons: ['all'],
      },
      database,
    );
    await expect(deleteCategory(id, database)).rejects.toThrow('还有衣物');
  });

  it('refuses to delete a custom category with children', async () => {
    const parent = await createCategory(
      {
        name: '工装',
        slot: 'top',
        defaultFormality: 2,
        defaultWarmth: 2,
        defaultSeasons: ['all'],
      },
      database,
    );
    await customCategory('工装衬衫', parent);
    await expect(deleteCategory(parent, database)).rejects.toThrow('还有子类型');
  });

  it('deletes an empty custom category', async () => {
    const id = await customCategory();
    await deleteCategory(id, database);
    expect((await listCategories(true, database)).some((category) => category.id === id)).toBe(
      false,
    );
  });
});
