import type { Category, Season, Slot } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export interface NewCategoryInput {
  name: string;
  parentId?: string;
  slot: Slot;
  slots?: Slot[];
  defaultFormality: number;
  defaultWarmth: number;
  defaultSeasons: Season[];
  order?: number;
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function listCategories(
  includeArchived = false,
  database: ClosetTraceDB = db,
): Promise<Category[]> {
  const rows = await database.categories.toArray();
  return rows
    .filter((category) => includeArchived || !category.archived)
    .sort((a, b) => {
      const aRoot = !a.parentId;
      const bRoot = !b.parentId;
      if (aRoot !== bRoot) return aRoot ? -1 : 1;
      return a.order - b.order || a.name.localeCompare(b.name, 'zh-CN');
    });
}

export async function createCategory(
  input: NewCategoryInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const siblings = await database.categories
    .filter((category) => category.parentId === input.parentId)
    .toArray();
  const order = input.order ?? siblings.reduce((max, category) => Math.max(max, category.order), 0) + 10;
  const now = nowISO();
  const id = crypto.randomUUID();

  const category: Category = {
    id,
    name: input.name.trim(),
    parentId: input.parentId,
    slot: input.slot,
    slots: input.slots,
    defaultFormality: input.defaultFormality,
    defaultWarmth: input.defaultWarmth,
    defaultSeasons: input.defaultSeasons,
    isBuiltIn: false,
    archived: false,
    order,
    createdAt: now,
    updatedAt: now,
  };
  await database.categories.add(category);
  return id;
}

export async function updateCategory(
  id: string,
  patch: Partial<Category>,
  database: ClosetTraceDB = db,
): Promise<void> {
  const existing = await database.categories.get(id);
  if (!existing) return;
  if (existing.isBuiltIn) throw new Error('内置类型不可修改');
  await database.categories.update(id, { ...patch, id, updatedAt: nowISO() });
}

export async function deleteCategory(id: string, database: ClosetTraceDB = db): Promise<void> {
  const existing = await database.categories.get(id);
  if (!existing) return;
  if (existing.isBuiltIn) throw new Error('内置类型不可删除');

  const [itemCount, childCount] = await Promise.all([
    database.items.where('categoryId').equals(id).count(),
    database.categories.where('parentId').equals(id).count(),
  ]);
  if (itemCount > 0) throw new Error('该类型下还有衣物，先迁移后再删除');
  if (childCount > 0) throw new Error('该类型下还有子类型，先迁移后再删除');

  await database.categories.delete(id);
}
