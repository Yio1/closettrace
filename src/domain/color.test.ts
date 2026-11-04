import { describe, expect, it } from 'vitest';
import type { ColorSwatch } from './types';
import { colorPairScore, outfitColorScore } from './color';

function swatch(
  name: string,
  hue: number,
  family: ColorSwatch['family'],
  isNeutral = false,
): ColorSwatch {
  return { id: name, name, hex: '#000000', hue, family, isNeutral, order: 0 };
}

const white = swatch('white', 0, 'neutral', true);
const black = swatch('black', 0, 'neutral', true);
const brown = swatch('brown', 25, 'neutral', true);
const red = swatch('red', 6, 'warm');
const wine = swatch('wine', 351, 'warm');
const orange = swatch('orange', 26, 'warm');
const blue = swatch('blue', 213, 'cool');
const green = swatch('green', 143, 'cool');
const purple = swatch('purple', 258, 'warm');

describe('color', () => {
  it('scores neutral pairs highest', () => {
    expect(colorPairScore(white, black)).toBe(100);
  });

  it('scores neutral + color high', () => {
    expect(colorPairScore(white, red)).toBe(92);
  });

  it('scores same-family near hues above unrelated hues', () => {
    expect(colorPairScore(red, wine)).toBe(82);
    expect(colorPairScore(red, orange)).toBe(82);
    expect(colorPairScore(red, green)).toBe(45);
  });

  it('scores near-identical hues highest among colors', () => {
    expect(colorPairScore(red, swatch('red2', 10, 'warm'))).toBe(88);
  });

  it('scores complementary hues', () => {
    expect(colorPairScore(red, blue)).toBe(72);
    expect(colorPairScore(swatch('c1', 20, 'warm'), swatch('c2', 200, 'cool'))).toBe(72);
  });

  it('maps an all-neutral outfit to full color score', () => {
    expect(outfitColorScore([white, black, brown], 0)).toBe(30);
  });

  it('penalizes more than one pattern', () => {
    expect(outfitColorScore([white, black, brown], 2)).toBeLessThan(
      outfitColorScore([white, black, brown], 1),
    );
  });

  it('penalizes four or more non-neutral hues', () => {
    const threeHues = outfitColorScore([white, red, blue, green], 0);
    const fourHues = outfitColorScore([white, red, blue, green, purple], 0);
    expect(fourHues).toBeLessThan(threeHues);
  });

  it('clamps to 0-30', () => {
    expect(outfitColorScore([red, blue, green, purple], 5)).toBeGreaterThanOrEqual(0);
    expect(outfitColorScore([white, black], 0)).toBeLessThanOrEqual(30);
  });
});
