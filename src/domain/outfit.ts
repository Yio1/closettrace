import type { ColorSwatch, Item, Scene, Slot } from './types';

export const OUTDOOR_SCENE_ID = 'builtin:scene:outdoor';

export const OUTFIT_SLOT_ORDER: Slot[] = [
  'top',
  'bottom',
  'dress',
  'outer',
  'shoes',
  'bag',
  'accessory',
];

export const SLOT_LABELS: Record<Slot, string> = {
  top: '上装',
  bottom: '下装',
  dress: '连衣裙',
  outer: '外套',
  shoes: '鞋',
  bag: '包',
  accessory: '配饰',
};

export interface OutfitCompleteness {
  complete: boolean;
  missing: Slot[];
}

export function outfitSignature(itemIds: string[]): string {
  return [...new Set(itemIds)].sort().join('|');
}

export function outfitCompleteness(
  itemSlots: Slot[],
  scene: Scene,
  tempC?: number,
): OutfitCompleteness {
  const present = new Set(itemSlots);
  const required = new Set<Slot>(scene.requiredSlots);
  if (scene.id === OUTDOOR_SCENE_ID && typeof tempC === 'number' && tempC <= 18) {
    required.add('outer');
  }

  const missing = [...required].filter((slot) => {
    if (present.has(slot)) return false;
    if (present.has('dress') && (slot === 'top' || slot === 'bottom')) return false;
    return true;
  });

  return { complete: missing.length === 0, missing };
}

export function autoOutfitName(items: Item[], colors: ColorSwatch[]): string {
  const colorNames = new Map(colors.map((color) => [color.id, color.name.trim()]));
  return items
    .map((item) => {
      const name = item.name.trim();
      const color = colorNames.get(item.colorPrimaryId);
      if (!color || name.includes(color)) return name;
      return `${color}${name}`;
    })
    .filter(Boolean)
    .join(' + ');
}
