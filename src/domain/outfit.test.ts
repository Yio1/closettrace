import { describe, expect, it } from 'vitest';
import type { ColorSwatch, Item, Scene, Slot } from './types';
import { autoOutfitName, outfitCompleteness, outfitSignature } from './outfit';

function scene(id: string, requiredSlots: Slot[]): Scene {
  return {
    id,
    name: id,
    formalityMin: 2,
    formalityMax: 3,
    requiredSlots,
    optionalSlots: ['outer', 'bag', 'accessory'],
    styleTags: [],
    isBuiltIn: true,
    archived: false,
    order: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function color(id: string, name: string): ColorSwatch {
  return {
    id,
    name,
    hex: '#000000',
    hue: 0,
    family: 'neutral',
    isNeutral: true,
    order: 1,
  };
}

function item(id: string, name: string, colorPrimaryId: string): Item {
  return {
    id,
    name,
    categoryId: `cat-${id}`,
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
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const commute = scene('builtin:scene:commute', ['top', 'bottom', 'shoes']);
const outdoor = scene('builtin:scene:outdoor', ['top', 'bottom', 'shoes']);

describe('outfitSignature', () => {
  it('is order-insensitive', () => {
    expect(outfitSignature(['b', 'a', 'c'])).toBe(outfitSignature(['c', 'b', 'a']));
    expect(outfitSignature(['b', 'a'])).toBe('a|b');
  });

  it('ignores duplicate ids', () => {
    expect(outfitSignature(['a', 'a', 'b'])).toBe('a|b');
    expect(outfitSignature([])).toBe('');
  });
});

describe('outfitCompleteness', () => {
  it('is complete with top, bottom, and shoes', () => {
    expect(outfitCompleteness(['top', 'bottom', 'shoes'], commute)).toEqual({
      complete: true,
      missing: [],
    });
  });

  it('reports missing required slots in scene order', () => {
    expect(outfitCompleteness(['top'], commute)).toEqual({
      complete: false,
      missing: ['bottom', 'shoes'],
    });
  });

  it('lets a dress replace top and bottom', () => {
    expect(outfitCompleteness(['dress', 'shoes'], commute)).toEqual({
      complete: true,
      missing: [],
    });
  });

  it('requires an outer layer outdoors at 18 degrees or below', () => {
    expect(outfitCompleteness(['top', 'bottom', 'shoes'], outdoor, 18)).toEqual({
      complete: false,
      missing: ['outer'],
    });
    expect(outfitCompleteness(['top', 'bottom', 'shoes', 'outer'], outdoor, 12).complete).toBe(
      true,
    );
  });

  it('does not require an outer layer outdoors above 18 degrees', () => {
    expect(outfitCompleteness(['top', 'bottom', 'shoes'], outdoor, 19).complete).toBe(true);
    expect(outfitCompleteness(['top', 'bottom', 'shoes'], outdoor).complete).toBe(true);
  });
});

describe('autoOutfitName', () => {
  const colors = [color('c-cream', '米白'), color('c-black', '黑'), color('c-brown', '棕色')];

  it('joins color and item names in slot order', () => {
    const items = [
      item('top', '衬衫', 'c-cream'),
      item('bottom', '西裤', 'c-black'),
      item('shoes', '乐福鞋', 'c-brown'),
    ];
    expect(autoOutfitName(items, colors)).toBe('米白衬衫 + 黑西裤 + 棕色乐福鞋');
  });

  it('does not repeat a color the item name already includes', () => {
    const items = [item('top', '米白衬衫', 'c-cream'), item('bottom', '黑西裤', 'c-black')];
    expect(autoOutfitName(items, colors)).toBe('米白衬衫 + 黑西裤');
  });

  it('falls back to item names when the color is unknown', () => {
    expect(autoOutfitName([item('top', '旧衬衫', 'missing')], colors)).toBe('旧衬衫');
  });
});
