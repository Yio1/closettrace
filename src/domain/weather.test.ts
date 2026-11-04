import { describe, expect, it } from 'vitest';
import { tempBand } from './weather';

describe('tempBand', () => {
  it.each([
    [30, 1.0, false],
    [29, 1.5, false],
    [24, 2.0, false],
    [18, 3.0, false],
    [12, 4.0, true],
    [5, 5.0, true],
  ])('%i°C maps to warmth %f', (temp, warmth, outer) => {
    expect(tempBand(temp, 'normal')).toMatchObject({ targetWarmth: warmth, needsOuter: outer });
  });

  it('shifts for cold sensitivity', () => {
    expect(tempBand(12, 'cold').targetWarmth).toBe(4.5);
  });

  it('shifts for hot sensitivity', () => {
    expect(tempBand(12, 'hot').targetWarmth).toBe(3.5);
  });

  it('clamps the adjusted target to 1-5', () => {
    expect(tempBand(-10, 'cold').targetWarmth).toBe(5);
    expect(tempBand(35, 'hot').targetWarmth).toBe(1);
  });

  it('returns a human label', () => {
    expect(tempBand(12, 'normal').label).toBe('冷');
    expect(tempBand(22, 'normal').label).toBe('舒适');
  });
});
