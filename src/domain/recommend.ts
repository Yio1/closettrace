import { outfitColorScore } from './color';
import { diffDays, todayISO } from './date';
import { OUTFIT_SLOT_ORDER, OUTDOOR_SCENE_ID, SLOT_LABELS, outfitSignature } from './outfit';
import { hashSeed, mulberry32 } from './random';
import { tempBand } from './weather';
import type {
  Category,
  ColorSwatch,
  ISODate,
  Item,
  Outfit,
  OutfitFeedback,
  Scene,
  Season,
  Slot,
} from './types';
import type { StyleProfile } from './profile';

export interface RecommendationInput {
  scene: Scene;
  tempC: number;
  items: Item[];
  categories: Category[];
  colors: ColorSwatch[];
  outfits: Array<{ outfit: Outfit; items: Item[] }>;
  feedback: OutfitFeedback[];
  styleProfile: StyleProfile;
  seed: number;
}

export interface Recommendation {
  signature: string;
  items: Item[];
  score: number;
  reasons: string[];
  savedOutfitId?: string;
  relaxed: string[];
}

type RelaxLevel = 'strict' | 'warmth' | 'season' | 'formality' | 'freshness';

interface CandidateRules {
  warmthTolerance: number;
  ignoreSeason: boolean;
  formalityTolerance: number;
  allowRecent: boolean;
}

const RELAX_LEVELS: Array<{
  level: RelaxLevel;
  rules: CandidateRules;
  message?: string;
}> = [
  {
    level: 'strict',
    rules: {
      warmthTolerance: 2,
      ignoreSeason: false,
      formalityTolerance: 0,
      allowRecent: false,
    },
  },
  {
    level: 'warmth',
    rules: {
      warmthTolerance: 3,
      ignoreSeason: false,
      formalityTolerance: 0,
      allowRecent: false,
    },
    message: '可选单品较少，已放宽保暖要求。',
  },
  {
    level: 'season',
    rules: {
      warmthTolerance: 3,
      ignoreSeason: true,
      formalityTolerance: 0,
      allowRecent: false,
    },
    message: '当季单品较少，已忽略季节标签。',
  },
  {
    level: 'formality',
    rules: {
      warmthTolerance: 3,
      ignoreSeason: true,
      formalityTolerance: 1,
      allowRecent: false,
    },
    message: '正式度合适的单品较少，已扩大正式度范围。',
  },
  {
    level: 'freshness',
    rules: {
      warmthTolerance: 3,
      ignoreSeason: true,
      formalityTolerance: 1,
      allowRecent: true,
    },
    message: '最近穿过的单品也重新加入推荐。',
  },
];

const RECENT_DAYS = 2;
const PER_SLOT = 8;
const MAX_EVALUATE = 512;
const RESULT_LIMIT = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function activeSeasons(tempC: number): Season[] {
  if (tempC >= 25) return ['summer'];
  if (tempC >= 13) return ['spring', 'autumn'];
  return ['winter'];
}

function needsOuter(scene: Scene, tempC: number): boolean {
  return tempC <= 12 || (scene.id === OUTDOOR_SCENE_ID && tempC <= 18);
}

function requiredSlots(scene: Scene, tempC: number): Slot[] {
  const required = [...scene.requiredSlots];
  if (needsOuter(scene, tempC) && !required.includes('outer')) required.push('outer');
  return required;
}

function slotMap(categories: Category[]): Map<string, Slot[]> {
  const map = new Map<string, Slot[]>();
  for (const category of categories) {
    const slots = category.slots && category.slots.length > 0 ? category.slots : [category.slot];
    map.set(category.id, slots);
  }
  return map;
}

function itemSlots(item: Item, categorySlots: Map<string, Slot[]>): Slot[] {
  return categorySlots.get(item.categoryId) ?? [];
}

function daysSince(date: ISODate | undefined, today: ISODate): number | undefined {
  if (!date) return undefined;
  return diffDays(date, today);
}

function isRecent(item: Item, today: ISODate): boolean {
  const days = daysSince(item.lastWornAt, today);
  return days !== undefined && days >= 0 && days <= RECENT_DAYS;
}

function freshnessScore(item: Item, today: ISODate): number {
  const days = daysSince(item.lastWornAt, today);
  if (days === undefined) return 10;
  if (days <= 2) return 0;
  if (days <= 7) return 7;
  return 10;
}

function itemFits(
  item: Item,
  input: RecommendationInput,
  rules: CandidateRules,
  targetWarmth: number,
  seasons: Season[],
  today: ISODate,
): boolean {
  if (item.status !== 'available') return false;
  if (item.avoidRecommend) return false;
  if (Math.abs(item.warmth - targetWarmth) > rules.warmthTolerance) return false;

  if (!rules.ignoreSeason) {
    const seasonal = item.seasons.some(
      (season) => season === 'all' || seasons.includes(season),
    );
    if (!seasonal) return false;
  }

  if (!item.sceneTags.includes(input.scene.id)) {
    const minimum = input.scene.formalityMin - rules.formalityTolerance;
    const maximum = input.scene.formalityMax + rules.formalityTolerance;
    if (item.formality < minimum || item.formality > maximum) return false;
  }

  if (!rules.allowRecent && isRecent(item, today)) return false;
  return true;
}

function groupCandidates(
  input: RecommendationInput,
  rules: CandidateRules,
  targetWarmth: number,
  seasons: Season[],
  categorySlots: Map<string, Slot[]>,
  today: ISODate,
): Map<Slot, Item[]> {
  const bySlot = new Map<Slot, Item[]>();
  for (const item of input.items) {
    if (!itemFits(item, input, rules, targetWarmth, seasons, today)) continue;
    for (const slot of itemSlots(item, categorySlots)) {
      const existing = bySlot.get(slot);
      if (existing) existing.push(item);
      else bySlot.set(slot, [item]);
    }
  }
  return bySlot;
}

function buildTemplates(
  scene: Scene,
  tempC: number,
  bySlot: Map<Slot, Item[]>,
): Slot[][] {
  const slots = requiredSlots(scene, tempC);
  const templates: Slot[][] = [];
  if (slots.every((slot) => (bySlot.get(slot)?.length ?? 0) > 0)) {
    templates.push(slots);
  }

  const replacesTopBottom = slots.includes('top') && slots.includes('bottom');
  if (replacesTopBottom && (bySlot.get('dress')?.length ?? 0) > 0) {
    const dressTemplate = slots.filter((slot) => slot !== 'top' && slot !== 'bottom');
    if (!dressTemplate.includes('dress')) dressTemplate.push('dress');
    if (dressTemplate.every((slot) => (bySlot.get(slot)?.length ?? 0) > 0)) {
      templates.push(dressTemplate);
    }
  }

  return templates;
}

function styleScore(item: Item, input: RecommendationInput): number {
  const preferred = input.styleProfile.styleTags;
  if (preferred.length === 0) return 6;
  return item.styleTags.some((tag) => preferred.includes(tag)) ? 10 : 0;
}

function baseItemScore(
  item: Item,
  input: RecommendationInput,
  targetWarmth: number,
  today: ISODate,
): number {
  const formalityTarget = (input.scene.formalityMin + input.scene.formalityMax) / 2;
  return (
    20 -
    Math.abs(item.formality - formalityTarget) * 8 +
    (20 - Math.abs(item.warmth - targetWarmth) * 8) +
    freshnessScore(item, today) +
    styleScore(item, input)
  );
}

function sampleCombos(
  templates: Slot[][],
  bySlot: Map<Slot, Item[]>,
  input: RecommendationInput,
  targetWarmth: number,
  today: ISODate,
): Item[][] {
  const pools = new Map<Slot, Item[]>();
  for (const [slot, items] of bySlot) {
    const ranked = items.slice().sort((a, b) => {
      const score = baseItemScore(b, input, targetWarmth, today) -
        baseItemScore(a, input, targetWarmth, today);
      if (score !== 0) return score;
      return hashSeed(String(input.seed), a.id) - hashSeed(String(input.seed), b.id);
    });
    pools.set(slot, ranked.slice(0, PER_SLOT));
  }

  const random = mulberry32(input.seed);
  const combos = new Map<string, Item[]>();
  const perTemplate = Math.max(1, Math.floor(MAX_EVALUATE / templates.length));

  for (const template of templates) {
    const templatePools = template.map((slot) => pools.get(slot)).filter((pool): pool is Item[] => Boolean(pool));
    if (templatePools.length !== template.length) continue;

    const total = templatePools.reduce((product, pool) => product * pool.length, 1);
    const draws = Math.min(perTemplate, total);
    for (let index = 0; index < draws; index += 1) {
      const picked = templatePools.map(
        (pool) => pool[Math.floor(random() * pool.length)],
      );
      const signature = outfitSignature(picked.map((item) => item.id));
      if (!combos.has(signature)) combos.set(signature, picked);
    }
  }

  return [...combos.values()];
}

function sortBySlot(items: Item[], categorySlots: Map<string, Slot[]>): Item[] {
  return items.slice().sort((a, b) => {
    const rank = (item: Item): number => {
      const ranks = itemSlots(item, categorySlots)
        .map((slot) => OUTFIT_SLOT_ORDER.indexOf(slot))
        .filter((value) => value >= 0);
      return ranks.length > 0 ? Math.min(...ranks) : OUTFIT_SLOT_ORDER.length;
    };
    return rank(a) - rank(b);
  });
}

function savedCombos(
  input: RecommendationInput,
  rules: CandidateRules,
  targetWarmth: number,
  seasons: Season[],
  categorySlots: Map<string, Slot[]>,
  today: ISODate,
): Array<{ items: Item[]; outfit: Outfit }> {
  const required = requiredSlots(input.scene, input.tempC);
  const results: Array<{ items: Item[]; outfit: Outfit }> = [];

  for (const entry of input.outfits) {
    if (!entry.outfit.sceneIds.includes(input.scene.id)) continue;
    if (entry.items.length === 0) continue;
    if (new Set(entry.items.map((item) => item.id)).size !== entry.items.length) continue;
    if (!entry.items.every((item) =>
      itemFits(item, input, rules, targetWarmth, seasons, today),
    )) {
      continue;
    }

    const present = new Set<Slot>();
    for (const item of entry.items) {
      for (const slot of itemSlots(item, categorySlots)) present.add(slot);
    }
    const complete = required.every(
      (slot) =>
        present.has(slot) ||
        ((slot === 'top' || slot === 'bottom') && present.has('dress')),
    );
    if (!complete) continue;

    results.push({
      items: sortBySlot(entry.items, categorySlots),
      outfit: entry.outfit,
    });
  }

  return results;
}

function colorReason(palette: ColorSwatch[], colorScore: number): string {
  const names = palette.map((color) => color.name).join('、');
  const colored = palette.filter((color) => !color.isNeutral);
  if (colored.length === 0) {
    return names ? `中性色组合（${names}），搭配稳定。` : '中性色组合，搭配稳定。';
  }
  if (colorScore < 18) return '颜色对比偏强。';
  const hueBands = new Set(colored.map((color) => Math.round(color.hue / 30)));
  if (hueBands.size <= 2) return '同色系层次，整体协调。';
  return '颜色搭配协调。';
}

function buildReasons(context: {
  combo: Item[];
  input: RecommendationInput;
  palette: ColorSwatch[];
  colorScore: number;
  formalityScore: number;
  warmthScore: number;
  style: number;
  freshness: number;
  feedback: number;
  novelty: number;
  liked: boolean;
  saved: boolean;
  outer?: Item;
  today: ISODate;
}): string[] {
  const entries: Array<{ weight: number; text: string }> = [
    {
      weight: context.colorScore,
      text: colorReason(context.palette, context.colorScore),
    },
    {
      weight: context.formalityScore,
      text: `${context.input.scene.name}场景的正式度匹配。`,
    },
    {
      weight: context.warmthScore,
      text: context.outer
        ? `${context.input.tempC}°C 下上装与外套的保暖接近目标。`
        : `${context.input.tempC}°C 下保暖值接近目标。`,
    },
  ];

  if (context.input.styleProfile.styleTags.length > 0 && context.style >= 7) {
    entries.push({ weight: context.style, text: '与你偏好的风格重合。' });
  }
  if (context.freshness >= 7) {
    const oldest = context.combo
      .map((item) => ({ item, days: daysSince(item.lastWornAt, context.today) }))
      .filter((entry): entry is { item: Item; days: number } =>
        entry.days !== undefined && entry.days >= 8,
      )
      .sort((a, b) => b.days - a.days)[0];
    if (oldest) {
      entries.push({
        weight: context.freshness,
        text: `${oldest.item.name}已经 ${oldest.days} 天没穿了。`,
      });
    }
  }
  if (context.liked) {
    entries.push({ weight: context.feedback, text: '你之前喜欢过这套搭配。' });
  } else if (context.saved) {
    entries.push({ weight: context.feedback, text: '这是你保存过的搭配。' });
  }
  if (context.novelty >= 5) {
    entries.push({ weight: context.novelty, text: '最近 14 天没有穿过这套组合。' });
  }

  entries.sort((a, b) => b.weight - a.weight);
  const reasons = entries.slice(0, 2).map((entry) => entry.text);
  return reasons.length > 0 ? reasons : ['符合当前场景与温度。'];
}

function scoreCombo(
  combo: Item[],
  input: RecommendationInput,
  context: {
    targetWarmth: number;
    today: ISODate;
    categorySlots: Map<string, Slot[]>;
    colorById: Map<string, ColorSwatch>;
    liked: Set<string>;
    savedOutfit?: Outfit;
  },
): Recommendation {
  const signature = outfitSignature(combo.map((item) => item.id));
  const saved = Boolean(context.savedOutfit);
  const liked = context.liked.has(signature);

  const palette = combo
    .map((item) => context.colorById.get(item.colorPrimaryId))
    .filter((color): color is ColorSwatch => Boolean(color));
  const patternCount = combo.filter((item) => item.pattern !== 'solid').length;
  const colorScore = outfitColorScore(palette, patternCount);

  const formalityTarget = (input.scene.formalityMin + input.scene.formalityMax) / 2;
  const averageDeviation =
    combo.reduce((total, item) => total + Math.abs(item.formality - formalityTarget), 0) /
    combo.length;
  let formalityScore = 20 - averageDeviation * 8;
  if (
    combo.some(
      (item) =>
        item.formality < input.scene.formalityMin ||
        item.formality > input.scene.formalityMax,
    )
  ) {
    formalityScore -= 4;
  }
  formalityScore = clamp(formalityScore, 0, 20);

  const byItemSlot = new Map<Slot, Item>();
  for (const item of combo) {
    for (const slot of itemSlots(item, context.categorySlots)) {
      if (!byItemSlot.has(slot)) byItemSlot.set(slot, item);
    }
  }
  const upper = byItemSlot.get('top') ?? byItemSlot.get('dress');
  const outer = byItemSlot.get('outer');
  const bottom = byItemSlot.get('bottom');
  const shoes = byItemSlot.get('shoes');

  let warmthScore = upper
    ? 20 -
      Math.abs(
        upper.warmth + (outer?.warmth ?? 0) * 0.6 - context.targetWarmth,
      ) *
        8
    : 10;
  if (bottom && Math.abs(bottom.warmth - context.targetWarmth) > 1) warmthScore -= 2;
  if (shoes && Math.abs(shoes.warmth - context.targetWarmth) > 1) warmthScore -= 2;
  warmthScore = clamp(warmthScore, 0, 20);

  const preferred = input.styleProfile.styleTags;
  const style =
    preferred.length === 0
      ? 6
      : Math.round(
          (combo.filter((item) => item.styleTags.some((tag) => preferred.includes(tag)))
            .length /
            combo.length) *
            10,
        );

  const freshness = Math.round(
    combo.reduce((total, item) => total + freshnessScore(item, context.today), 0) /
      combo.length,
  );

  const feedback = liked ? 5 : saved ? 4 : 2;

  const wearDates = combo
    .map((item) => item.lastWornAt)
    .concat(context.savedOutfit?.lastWornAt)
    .filter((date): date is ISODate => Boolean(date))
    .sort();
  const lastComboWear = wearDates.at(-1);
  const novelty =
    lastComboWear && diffDays(lastComboWear, context.today) < 14 ? 0 : 5;

  const score = Math.round(
    clamp(
      colorScore + formalityScore + warmthScore + style + freshness + feedback + novelty,
      0,
      100,
    ),
  );

  return {
    signature,
    items: sortBySlot(combo, context.categorySlots),
    score,
    reasons: buildReasons({
      combo,
      input,
      palette,
      colorScore,
      formalityScore,
      warmthScore,
      style,
      freshness,
      feedback,
      novelty,
      liked,
      saved,
      outer,
      today: context.today,
    }),
    savedOutfitId: context.savedOutfit?.id,
    relaxed: [],
  };
}

export function recommend(input: RecommendationInput): Recommendation[] {
  const targetWarmth = tempBand(
    input.tempC,
    input.styleProfile.tempSensitivity,
  ).targetWarmth;
  const seasons = activeSeasons(input.tempC);
  const today = todayISO();
  const categorySlots = slotMap(input.categories);
  const colorById = new Map(input.colors.map((color) => [color.id, color]));
  const liked = new Set(
    input.feedback
      .filter((feedback) => feedback.rating === 'like')
      .map((feedback) => feedback.signature),
  );
  const disliked = new Set(
    input.feedback
      .filter((feedback) => feedback.rating === 'dislike')
      .map((feedback) => feedback.signature),
  );

  for (const level of RELAX_LEVELS) {
    const bySlot = groupCandidates(
      input,
      level.rules,
      targetWarmth,
      seasons,
      categorySlots,
      today,
    );
    const templates = buildTemplates(input.scene, input.tempC, bySlot);
    if (templates.length === 0) continue;

    const generated = sampleCombos(templates, bySlot, input, targetWarmth, today);
    const saved = savedCombos(
      input,
      level.rules,
      targetWarmth,
      seasons,
      categorySlots,
      today,
    );

    const candidates = new Map<string, { items: Item[]; savedOutfit?: Outfit }>();
    for (const combo of generated) {
      candidates.set(outfitSignature(combo.map((item) => item.id)), { items: combo });
    }
    for (const entry of saved) {
      candidates.set(outfitSignature(entry.items.map((item) => item.id)), {
        items: entry.items,
        savedOutfit: entry.outfit,
      });
    }

    const scored: Recommendation[] = [];
    for (const candidate of candidates.values()) {
      const result = scoreCombo(candidate.items, input, {
        targetWarmth,
        today,
        categorySlots,
        colorById,
        liked,
        savedOutfit: candidate.savedOutfit,
      });
      if (disliked.has(result.signature)) continue;
      scored.push({
        ...result,
        relaxed: level.message ? [level.message] : [],
      });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        hashSeed(String(input.seed), a.signature) -
        hashSeed(String(input.seed), b.signature)
      );
    });

    if (scored.length > 0) return scored.slice(0, RESULT_LIMIT);
  }

  return [];
}

export function missingSlots(input: RecommendationInput): Slot[] {
  const categorySlots = slotMap(input.categories);
  const present = new Set<Slot>();
  for (const item of input.items) {
    if (item.status !== 'available' || item.avoidRecommend) continue;
    for (const slot of itemSlots(item, categorySlots)) present.add(slot);
  }

  return requiredSlots(input.scene, input.tempC).filter(
    (slot) =>
      !present.has(slot) &&
      !((slot === 'top' || slot === 'bottom') && present.has('dress')),
  );
}

export function setupGaps(input: RecommendationInput): string[] {
  return missingSlots(input).map((slot) => `还缺${SLOT_LABELS[slot]}`);
}
