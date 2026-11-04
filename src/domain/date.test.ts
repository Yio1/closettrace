import { describe, expect, it } from 'vitest';
import { diffDays, formatDateZh, toISODate, todayISO, weekStart } from './date';

describe('date', () => {
  it('formats a local Date without UTC drift', () => {
    expect(toISODate(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01');
  });

  it('returns today in YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('starts weeks on Monday', () => {
    expect(weekStart('2026-11-04')).toBe('2026-11-02');
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
  });

  it('starts weeks across month and year boundaries', () => {
    expect(weekStart('2026-01-01')).toBe('2025-12-29');
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
  });

  it('counts calendar days in both directions', () => {
    expect(diffDays('2026-10-27', '2026-11-04')).toBe(8);
    expect(diffDays('2026-11-04', '2026-10-27')).toBe(-8);
    expect(diffDays('2026-11-04', '2026-11-04')).toBe(0);
  });

  it('formats Chinese dates with weekday', () => {
    expect(formatDateZh('2026-11-04')).toBe('11月4日 周三');
    expect(formatDateZh('2026-01-01')).toBe('1月1日 周四');
  });
});
