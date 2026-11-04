import { describe, expect, it } from 'vitest';
import type { Item } from './types';
import {
  recommend,
  missingSlots,
  setupGaps,
  type RecommendationInput,
} from './recommend';
import {
  fixtureCategories,
  fixtureColors,
  makeItem,
  makeOutfit,
  scene,
  slotCategory,
  daysAgo,
  styleProfile as makeStyleProfile,
} from '../test/fixtures/wardrobe';

const COMMUTE = 'builtin:scene:commute';
const CASUAL = 'builtin:scene:casual';
const OUTDOOR = 'builtin:scene:outdoor';

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    scene: scene(COMMUTE),
    tempC: 20,
    items: [],
    categories: fixtureCategories,
    colors: fixtureColors,
    outfits: [],
    feedback: [],
    styleProfile: makeStyleProfile(),
    seed: 7,
    ...overrides,
  };
}

function item(
  id: string,
  slot: 'top' | 'bottom' | 'shoes' | 'outer' | 'dress',
  overrides: Partial<Item> = {},
): Item {
  return makeItem({
    id,
    name: id,
    categoryId: slotCategory(slot),
    colorPrimaryId: 'builtin:color:black',
    ...overrides,
  });
}

function commuteWardrobe(): Item[] {
  return [
    item('top', 'top', { colorPrimaryId: 'builtin:color:white' }),
    item('bottom', 'bottom'),
    item('shoes', 'shoes', { colorPrimaryId: 'builtin:color:brown' }),
    item('outer', 'outer', { warmth: 4 }),
  ];
}

function idsOf(items: Item[]): string[] {
  return items.map((entry) => entry.id).sort();
}

describe('recommend', () => {
  it('fills the required slots for a scene', () => {
    const results = recommend(input({ items: commuteWardrobe(), tempC: 20 }));

    expect(results.length).toBeGreaterThan(0);
    expect(idsOf(results[0].items)).toEqual(['bottom', 'shoes', 'top']);
    expect(results[0].relaxed).toEqual([]);
  });

  it('adds an outer layer at 12°C or below', () => {
    const results = recommend(input({ items: commuteWardrobe(), tempC: 8 }));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].items.map((entry) => entry.id)).toContain('outer');
    expect(results[0].relaxed).toEqual([]);
  });

  it('adds an outer layer outdoors at 18°C but not at 19°C', () => {
    const items = ['top', 'bottom', 'shoes', 'outer'].map((id) =>
      item(id, id as 'top' | 'bottom' | 'shoes' | 'outer', {
        formality: 2,
        warmth: 2,
      }),
    );

    const cold = recommend(input({ scene: scene(OUTDOOR), items, tempC: 18 }));
    const mild = recommend(input({ scene: scene(OUTDOOR), items, tempC: 19 }));

    expect(cold[0].items.map((entry) => entry.id)).toContain('outer');
    expect(mild[0].items.map((entry) => entry.id)).not.toContain('outer');
  });

  it('lets a dress replace the top and bottom', () => {
    const items = [item('dress', 'dress'), item('shoes', 'shoes')];
    const results = recommend(input({ items }));

    expect(results.length).toBeGreaterThan(0);
    expect(idsOf(results[0].items)).toEqual(['dress', 'shoes']);
  });

  it('excludes unavailable, retired, and avoid-recommend items', () => {
    const items = [
      item('topAvailable', 'top'),
      item('bottomAvailable', 'bottom'),
      item('shoesAvailable', 'shoes'),
      item('topLaundry', 'top', { status: 'laundry' }),
      item('bottomRepair', 'bottom', { status: 'repair' }),
      item('shoesStored', 'shoes', { status: 'stored' }),
      item('topRetired', 'top', { status: 'retired' }),
      item('topAvoid', 'top', { avoidRecommend: true }),
    ];
    const results = recommend(input({ items }));

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      for (const entry of result.items) {
        expect(entry.status).toBe('available');
        expect(entry.avoidRecommend).toBe(false);
      }
    }
    expect(idsOf(results[0].items)).toEqual([
      'bottomAvailable',
      'shoesAvailable',
      'topAvailable',
    ]);
  });

  it('filters items outside the scene formality range', () => {
    const items = [
      item('topCasual', 'top', { formality: 2 }),
      item('bottomCasual', 'bottom', { formality: 2 }),
      item('shoesCasual', 'shoes', { formality: 2 }),
      item('topFormal', 'top', { formality: 5 }),
      item('bottomFormal', 'bottom', { formality: 5 }),
      item('shoesFormal', 'shoes', { formality: 5 }),
    ];
    const results = recommend(input({ scene: scene(CASUAL), items }));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].relaxed).toEqual([]);
    expect(idsOf(results[0].items)).toEqual([
      'bottomCasual',
      'shoesCasual',
      'topCasual',
    ]);
  });

  it('accepts an item explicitly tagged for the scene', () => {
    const items = ['top', 'bottom', 'shoes'].map((id) =>
      item(id, id as 'top' | 'bottom' | 'shoes', {
        formality: 5,
        sceneTags: [CASUAL],
      }),
    );
    const results = recommend(input({ scene: scene(CASUAL), items }));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].relaxed).toEqual([]);
  });

  it('prefers items that match the style profile', () => {
    const items = [
      item('styledTop', 'top', { styleTags: ['builtin:style:minimal'] }),
      item('plainTop', 'top'),
      item('bottom', 'bottom'),
      item('shoes', 'shoes'),
    ];
    const results = recommend(
      input({
        items,
        styleProfile: makeStyleProfile({ styleTags: ['builtin:style:minimal'] }),
      }),
    );

    expect(results[0].items.map((entry) => entry.id)).toContain('styledTop');
  });

  it('scores warmer items lower in warm weather', () => {
    const items = [
      item('topClose', 'top', { warmth: 2 }),
      item('topWarm', 'top', { warmth: 3 }),
      item('bottom', 'bottom', { warmth: 2 }),
      item('shoes', 'shoes', { warmth: 2 }),
    ];
    const results = recommend(input({ items, tempC: 27 }));

    expect(results[0].items.map((entry) => entry.id)).toContain('topClose');
  });

  it('shifts the warmth target for cold-sensitive users', () => {
    const items = [
      item('top', 'top', { warmth: 3 }),
      item('bottom', 'bottom', { warmth: 3 }),
      item('shoes', 'shoes', { warmth: 3 }),
      item('outer', 'outer', { warmth: 4 }),
    ];
    const cold = recommend(
      input({
        items,
        tempC: 12,
        styleProfile: makeStyleProfile({ tempSensitivity: 'cold' }),
      }),
    );
    const hot = recommend(
      input({
        items,
        tempC: 12,
        styleProfile: makeStyleProfile({ tempSensitivity: 'hot' }),
      }),
    );

    expect(cold[0].score).toBeGreaterThan(hot[0].score);
  });

  it('ranks a neutral color combination above a clashing one', () => {
    const neutral = [
      item('neutralTop', 'top', { colorPrimaryId: 'builtin:color:white' }),
      item('neutralBottom', 'bottom', { colorPrimaryId: 'builtin:color:black' }),
      item('neutralShoes', 'shoes', { colorPrimaryId: 'builtin:color:light-gray' }),
    ];
    const clash = [
      item('clashTop', 'top', { colorPrimaryId: 'builtin:color:red' }),
      item('clashBottom', 'bottom', { colorPrimaryId: 'builtin:color:green' }),
      item('clashShoes', 'shoes', { colorPrimaryId: 'builtin:color:yellow' }),
    ];
    const results = recommend(input({ items: [...neutral, ...clash] }));

    expect(idsOf(results[0].items)).toEqual(['neutralBottom', 'neutralShoes', 'neutralTop']);
  });

  it('avoids an item worn yesterday when a fresh alternative exists', () => {
    const items = [
      item('freshTop', 'top'),
      item('recentTop', 'top', { lastWornAt: daysAgo(1) }),
      item('bottom', 'bottom'),
      item('shoes', 'shoes'),
    ];
    const results = recommend(input({ items }));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].relaxed).toEqual([]);
    expect(results.flatMap((result) => result.items.map((entry) => entry.id))).not.toContain(
      'recentTop',
    );
  });

  it('excludes a disliked signature', () => {
    const items = commuteWardrobe();
    const [first] = recommend(input({ items }));
    const results = recommend(
      input({
        items,
        feedback: [
          {
            id: 'feedback-dislike',
            signature: first.signature,
            rating: 'dislike',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    expect(results).toEqual([]);
  });

  it('boosts a saved outfit that the user liked', () => {
    const items = commuteWardrobe();
    const saved = makeOutfit({
      id: 'saved-outfit',
      sceneIds: [COMMUTE],
      items: [
        { item: items[0], slot: 'top' },
        { item: items[1], slot: 'bottom' },
        { item: items[2], slot: 'shoes' },
      ],
    });
    const neutral = recommend(input({ items, outfits: [saved] }));
    const liked = recommend(
      input({
        items,
        outfits: [saved],
        feedback: [
          {
            id: 'feedback-like',
            signature: neutral[0].signature,
            rating: 'like',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    expect(neutral[0].savedOutfitId).toBe('saved-outfit');
    expect(liked[0].score).toBeGreaterThan(neutral[0].score);
  });

  it('is deterministic for a seed and varies with a new seed', () => {
    const items = Array.from({ length: 5 }, (_, index) => [
      item(`top${index}`, 'top'),
      item(`bottom${index}`, 'bottom'),
      item(`shoes${index}`, 'shoes'),
    ]).flat();
    const first = recommend(input({ items, seed: 11 }));
    const repeat = recommend(input({ items, seed: 11 }));
    const other = recommend(input({ items, seed: 12 }));

    expect(repeat.map((entry) => entry.signature)).toEqual(
      first.map((entry) => entry.signature),
    );
    expect(other.map((entry) => entry.signature)).not.toEqual(
      first.map((entry) => entry.signature),
    );
  });

  it('relaxes warmth tolerance before season and formality', () => {
    const warmItems = [
      item('top', 'top', { warmth: 5 }),
      item('bottom', 'bottom', { warmth: 5 }),
      item('shoes', 'shoes', { warmth: 5 }),
    ];
    const seasonItems = [
      item('top', 'top', { seasons: ['winter'] }),
      item('bottom', 'bottom', { seasons: ['winter'] }),
      item('shoes', 'shoes', { seasons: ['winter'] }),
    ];
    const formalityItems = [
      item('top', 'top', { formality: 3 }),
      item('bottom', 'bottom', { formality: 3 }),
      item('shoes', 'shoes', { formality: 3 }),
    ];

    expect(
      recommend(input({ items: warmItems, tempC: 20 }))[0].relaxed.join(''),
    ).toContain('保暖');
    expect(
      recommend(input({ items: seasonItems, tempC: 22 }))[0].relaxed.join(''),
    ).toContain('季节');
    expect(
      recommend(input({ scene: scene(CASUAL), items: formalityItems }))[0].relaxed.join(''),
    ).toContain('正式度');
  });

  it('relaxes freshness last and never relaxes availability', () => {
    const recentItems = [
      item('top', 'top', { lastWornAt: daysAgo(1) }),
      item('bottom', 'bottom', { lastWornAt: daysAgo(1) }),
      item('shoes', 'shoes', { lastWornAt: daysAgo(1) }),
    ];
    const relaxed = recommend(input({ items: recentItems }));

    expect(relaxed.length).toBeGreaterThan(0);
    expect(relaxed[0].relaxed.join('')).toContain('最近穿过');

    const laundry = recentItems.map((entry) => ({ ...entry, status: 'laundry' as const }));
    expect(recommend(input({ items: laundry }))).toEqual([]);
  });

  it('returns no results and reports missing slots for an incomplete wardrobe', () => {
    const items = [
      item('top', 'top'),
      item('bottom', 'bottom'),
    ];
    const request = input({ items });

    expect(recommend(request)).toEqual([]);
    expect(missingSlots(request)).toEqual(['shoes']);
    expect(setupGaps(request)).toEqual(['还缺鞋']);
  });

  it('lists every required slot when the wardrobe is empty', () => {
    expect(setupGaps(input({ items: [] }))).toEqual(['还缺上装', '还缺下装', '还缺鞋']);
  });

  it('gives every recommendation at least one explanation', () => {
    const results = recommend(input({ items: commuteWardrobe() }));

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.every((reason) => reason.trim().length > 0)).toBe(true);
    }
  });

  it('includes saved outfits that fit the scene', () => {
    const items = commuteWardrobe();
    const saved = makeOutfit({
      id: 'saved-outfit',
      sceneIds: [COMMUTE],
      items: [
        { item: items[0], slot: 'top' },
        { item: items[1], slot: 'bottom' },
        { item: items[2], slot: 'shoes' },
      ],
    });
    const results = recommend(input({ items, outfits: [saved] }));

    expect(results.some((result) => result.savedOutfitId === 'saved-outfit')).toBe(true);
  });
});
