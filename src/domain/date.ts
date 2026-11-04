import type { ISODate } from './types';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseISODate(date: ISODate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function weekStart(date: ISODate): ISODate {
  const value = parseISODate(date);
  const offset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - offset);
  return toISODate(value);
}

export function diffDays(from: ISODate, to: ISODate): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const end = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((end - start) / 86_400_000);
}

export function formatDateZh(date: ISODate): string {
  const value = parseISODate(date);
  return `${value.getMonth() + 1}月${value.getDate()}日 ${WEEKDAYS[value.getDay()]}`;
}
