import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listItems } from '../../db/repositories/items';
import { listCategories } from '../../db/repositories/categories';
import { listColors } from '../../db/repositories/dictionaries';
import { listAllOutfitItems, listOutfits } from '../../db/repositories/outfits';
import { listScenes } from '../../db/repositories/scenes';
import { listFeedback } from '../../db/repositories/feedback';
import { getSetting } from '../../db/repositories/settings';
import { DEFAULT_STYLE_PROFILE, type StyleProfile } from '../../domain/profile';
import { todayISO } from '../../domain/date';
import { hashSeed } from '../../domain/random';
import {
  recommend,
  setupGaps,
  type Recommendation,
  type RecommendationInput,
} from '../../domain/recommend';
import type {
  Category,
  ColorSwatch,
  Item,
  Outfit,
  OutfitFeedback,
  Scene,
} from '../../domain/types';

export interface RecommendationData {
  items: Item[];
  categories: Category[];
  colors: ColorSwatch[];
  scenes: Scene[];
  outfits: Array<{ outfit: Outfit; items: Item[] }>;
  feedback: OutfitFeedback[];
  styleProfile: StyleProfile;
}

export function useRecommendationData(): RecommendationData | undefined {
  const items = useLiveQuery(() => listItems({ includeRetired: true }), []);
  const categories = useLiveQuery(() => listCategories(true), []);
  const colors = useLiveQuery(() => listColors(), []);
  const scenes = useLiveQuery(() => listScenes(), []);
  const outfits = useLiveQuery(() => listOutfits(), []);
  const links = useLiveQuery(() => listAllOutfitItems(), []);
  const feedback = useLiveQuery(() => listFeedback(), []);
  const styleProfile = useLiveQuery(
    () => getSetting<StyleProfile>('styleProfile', DEFAULT_STYLE_PROFILE),
    [],
  );

  return useMemo(() => {
    if (
      items === undefined ||
      categories === undefined ||
      colors === undefined ||
      scenes === undefined ||
      outfits === undefined ||
      links === undefined ||
      feedback === undefined ||
      styleProfile === undefined
    ) {
      return undefined;
    }

    const itemById = new Map(items.map((item) => [item.id, item]));
    const outfitEntries = outfits.map((outfit) => ({
      outfit,
      items: links
        .filter((link) => link.outfitId === outfit.id)
        .flatMap((link) => {
          const item = itemById.get(link.itemId);
          return item ? [item] : [];
        }),
    }));

    return {
      items,
      categories,
      colors,
      scenes,
      outfits: outfitEntries,
      feedback,
      styleProfile,
    };
  }, [items, categories, colors, scenes, outfits, links, feedback, styleProfile]);
}

export function useRecommendations({
  sceneId,
  tempC,
  nonce = 0,
}: {
  sceneId: string;
  tempC: number;
  nonce?: number;
}) {
  const data = useRecommendationData();
  const selectedScene =
    data?.scenes.find((entry) => entry.id === sceneId) ?? data?.scenes[0];
  const seed = hashSeed(todayISO(), sceneId, String(nonce));

  const input = useMemo<RecommendationInput | undefined>(() => {
    if (!data || !selectedScene) return undefined;
    return {
      scene: selectedScene,
      tempC,
      items: data.items,
      categories: data.categories,
      colors: data.colors,
      outfits: data.outfits,
      feedback: data.feedback,
      styleProfile: data.styleProfile,
      seed,
    };
  }, [data, selectedScene, tempC, seed]);

  const results = useMemo<Recommendation[]>(
    () => (input ? recommend(input) : []),
    [input],
  );
  const gaps = useMemo(() => (input ? setupGaps(input) : []), [input]);

  return { data, scene: selectedScene, input, results, gaps, seed };
}
