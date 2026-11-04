import { describe, expect, it } from 'vitest';
import { formatCents, landedCents, parseYuanToCents } from './money';

describe('money', () => {
  it('parses yuan to cents', () => {
    expect(parseYuanToCents('199.5')).toBe(19950);
    expect(parseYuanToCents('0')).toBe(0);
    expect(parseYuanToCents('0.05')).toBe(5);
    expect(parseYuanToCents(' 12.30 ')).toBe(1230);
    expect(parseYuanToCents('abc')).toBeNull();
    expect(parseYuanToCents('-5')).toBeNull();
    expect(parseYuanToCents('1.234')).toBeNull();
    expect(parseYuanToCents('')).toBeNull();
  });

  it('formats cents as CNY', () => {
    expect(formatCents(19900)).toBe('¥199');
    expect(formatCents(19950)).toBe('¥199.50');
    expect(formatCents(0)).toBe('¥0');
    expect(formatCents(-500)).toBe('-¥5');
  });

  it('computes landed price', () => {
    expect(landedCents(19900, 1000, 500)).toBe(20400);
    expect(landedCents(1000, 0, 2000)).toBe(0);
  });
});
