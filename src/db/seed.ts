import categoriesContent from '../content/categories.json';
import colorsContent from '../content/colors.json';
import scenesContent from '../content/scenes.json';
import styleTagsContent from '../content/style-tags.json';
import type {
  Category,
  CategoryContent,
  ColorSwatch,
  Scene,
  SceneContent,
  StyleTag,
} from '../domain/types';
import { db as defaultDb, type ClosetTraceDB } from './schema';

export const SEED_VERSION = 1;
const SEED_VERSION_KEY = 'seedVersion';

export async function seedDatabase(target: ClosetTraceDB = defaultDb): Promise<void> {
  await target.open();

  const stored = await target.settings.get(SEED_VERSION_KEY);
  if (typeof stored?.value === 'number' && stored.value >= SEED_VERSION) return;

  const now = new Date().toISOString();

  const categories: Category[] = (categoriesContent as unknown as CategoryContent[]).map(
    (category) => ({
      ...category,
      isBuiltIn: true,
      archived: category.archived ?? false,
      createdAt: now,
      updatedAt: now,
    }),
  );

  const scenes: Scene[] = (scenesContent as unknown as SceneContent[]).map((scene) => ({
    ...scene,
    isBuiltIn: true,
    archived: scene.archived ?? false,
    createdAt: now,
    updatedAt: now,
  }));

  const colors = colorsContent as unknown as ColorSwatch[];
  const styleTags = styleTagsContent as StyleTag[];

  await target.transaction(
    'rw',
    [
      target.categories,
      target.scenes,
      target.colors,
      target.styleTags,
      target.settings,
    ],
    async () => {
      await target.categories.bulkPut(categories);
      await target.scenes.bulkPut(scenes);
      await target.colors.bulkPut(colors);
      await target.styleTags.bulkPut(styleTags);
      await target.settings.put({ key: SEED_VERSION_KEY, value: SEED_VERSION, updatedAt: now });
    },
  );
}
