import { describe, expect, it } from 'vitest';
import { fitDimensions } from './image';

describe('fitDimensions', () => {
  it('scales landscape to max edge', () => {
    expect(fitDimensions(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales portrait to max edge', () => {
    expect(fitDimensions(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('keeps small images unchanged', () => {
    expect(fitDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('never produces zero dimensions', () => {
    expect(fitDimensions(10, 4000, 1600)).toEqual({ width: 4, height: 1600 });
  });
});
