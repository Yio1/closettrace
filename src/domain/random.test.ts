import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32 } from './random';

describe('random', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces different streams for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays within [0, 1)', () => {
    const next = mulberry32(7);
    for (let i = 0; i < 100; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('hashes the same parts to the same unsigned seed', () => {
    expect(hashSeed('2026-11-04', 'commute', '12')).toBe(
      hashSeed('2026-11-04', 'commute', '12'),
    );
    expect(hashSeed('a', 'b')).not.toBe(hashSeed('ab', ''));
    expect(hashSeed('a', 'b')).toBeGreaterThanOrEqual(0);
  });
});
