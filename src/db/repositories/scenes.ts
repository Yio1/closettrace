import type { Scene, Slot } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';

export interface NewSceneInput {
  name: string;
  formalityMin: number;
  formalityMax: number;
  requiredSlots: Slot[];
  optionalSlots: Slot[];
  styleTags: string[];
  order?: number;
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function listScenes(
  includeArchived = false,
  database: ClosetTraceDB = db,
): Promise<Scene[]> {
  const scenes = await database.scenes.orderBy('order').toArray();
  return includeArchived ? scenes : scenes.filter((scene) => !scene.archived);
}

export async function createScene(
  input: NewSceneInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const siblings = await database.scenes.toArray();
  const order = input.order ?? siblings.reduce((max, scene) => Math.max(max, scene.order), 0) + 10;
  const now = nowISO();
  const id = crypto.randomUUID();

  const scene: Scene = {
    id,
    name: input.name.trim(),
    formalityMin: input.formalityMin,
    formalityMax: input.formalityMax,
    requiredSlots: input.requiredSlots,
    optionalSlots: input.optionalSlots,
    styleTags: input.styleTags,
    isBuiltIn: false,
    archived: false,
    order,
    createdAt: now,
    updatedAt: now,
  };
  await database.scenes.add(scene);
  return id;
}

export async function updateScene(
  id: string,
  patch: Partial<Scene>,
  database: ClosetTraceDB = db,
): Promise<void> {
  const existing = await database.scenes.get(id);
  if (!existing) return;
  if (existing.isBuiltIn) throw new Error('内置场景不可修改');
  await database.scenes.update(id, { ...patch, id, updatedAt: nowISO() });
}

export async function archiveScene(id: string, database: ClosetTraceDB = db): Promise<void> {
  const existing = await database.scenes.get(id);
  if (!existing) return;
  if (existing.isBuiltIn) throw new Error('内置场景不可归档');
  await database.scenes.update(id, { archived: true, updatedAt: nowISO() });
}
