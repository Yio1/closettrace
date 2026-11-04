import categoriesContent from '../../content/categories.json';
import colorsContent from '../../content/colors.json';
import scenesContent from '../../content/scenes.json';
import { toISODate } from '../../domain/date';
import { DEFAULT_STYLE_PROFILE, type StyleProfile } from '../../domain/profile';
import type {
  Category,
  CategoryContent,
  ColorSwatch,
  ISODate,
  Item,
  Outfit,
  Scene,
  SceneContent,
  Slot,
} from '../../domain/types';

const NOW = '2026-01-01T00:00:00.000Z';

export const fixtureCategories: Category[] = (
  categoriesContent as unknown as CategoryContent[]
).map((category) => ({
  ...category,
  isBuiltIn: true,
  archived: category.archived ?? false,
  createdAt: NOW,
  updatedAt: NOW,
}));

export const fixtureScenes: Scene[] = (scenesContent as unknown as SceneContent[]).map(
  (scene) => ({
    ...scene,
    isBuiltIn: true,
    archived: scene.archived ?? false,
    createdAt: NOW,
    updatedAt: NOW,
  }),
);

export const fixtureColors = colorsContent as unknown as ColorSwatch[];

export function scene(id: string): Scene {
  const found = fixtureScenes.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown fixture scene: ${id}`);
  return found;
}

export function category(id: string): Category {
  const found = fixtureCategories.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown fixture category: ${id}`);
  return found;
}

export function color(id: string): ColorSwatch {
  const found = fixtureColors.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown fixture color: ${id}`);
  return found;
}

export function slotCategory(slot: Slot): string {
  const ids: Record<Slot, string> = {
    top: 'builtin:cat:shirt',
    bottom: 'builtin:cat:dress-pants',
    dress: 'builtin:cat:one-piece-dress',
    outer: 'builtin:cat:jacket',
    shoes: 'builtin:cat:loafers',
    bag: 'builtin:cat:shoulder-bag',
    accessory: 'builtin:cat:belt',
  };
  return ids[slot];
}

export function makeItem(
  overrides: Partial<Item> & Pick<Item, 'name' | 'categoryId' | 'colorPrimaryId'>,
): Item {
  const { id, name, categoryId, colorPrimaryId, ...rest } = overrides;
  return {
    id: id ?? name,
    name,
    categoryId,
    colorPrimaryId,
    pattern: 'solid',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
    sceneTags: [],
    styleTags: [],
    status: 'available',
    avoidRecommend: false,
    isFavorite: false,
    wearCount: 0,
    totalCostCents: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...rest,
  };
}

export function makeOutfit(input: {
  id?: string;
  name?: string;
  sceneIds?: string[];
  items: Array<{ item: Item; slot: Slot }>;
  lastWornAt?: ISODate;
}): { outfit: Outfit; items: Item[] } {
  const id = input.id ?? input.name ?? 'outfit';
  return {
    outfit: {
      id,
      name: input.name ?? id,
      sceneIds: input.sceneIds ?? [],
      isFavorite: false,
      source: 'manual',
      wearCount: 0,
      lastWornAt: input.lastWornAt,
      createdAt: NOW,
      updatedAt: NOW,
    },
    items: input.items.map((entry) => entry.item),
  };
}

export function styleProfile(overrides: Partial<StyleProfile> = {}): StyleProfile {
  return { ...DEFAULT_STYLE_PROFILE, ...overrides };
}

export function daysAgo(days: number): ISODate {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISODate(date);
}
