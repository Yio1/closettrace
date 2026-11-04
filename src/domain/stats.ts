import { diffDays } from './date';
import type { Category, ColorSwatch, ISODate, Item, WearLog } from './types';

export interface DistributionEntry {
  id: string;
  label: string;
  count: number;
  hex?: string;
}

function shiftISO(date: ISODate, days: number): ISODate {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function createdDate(item: Item): ISODate {
  return item.createdAt.slice(0, 10);
}

function activeItems(items: Item[]): Item[] {
  return items.filter((item) => item.status !== 'retired');
}

export function utilization(
  items: Item[],
  wearLogs: WearLog[],
  nowISO: ISODate,
  windowDays = 90,
): number {
  const active = activeItems(items);
  if (active.length === 0) return 0;
  const windowStart = shiftISO(nowISO, -windowDays);
  const activeIds = new Set(active.map((item) => item.id));
  const worn = new Set<string>();
  for (const log of wearLogs) {
    if (log.date < windowStart || log.date > nowISO) continue;
    for (const itemId of log.itemIds) {
      if (activeIds.has(itemId)) worn.add(itemId);
    }
  }
  return worn.size / active.length;
}

export function idleItems(
  items: Item[],
  nowISO: ISODate,
  idleDays = 90,
  minAgeDays = 30,
): Item[] {
  return activeItems(items)
    .map((item) => ({
      item,
      since: item.lastWornAt ?? createdDate(item),
      age: diffDays(createdDate(item), nowISO),
    }))
    .filter(
      ({ since, age }) => age >= minAgeDays && diffDays(since, nowISO) >= idleDays,
    )
    .sort((a, b) => diffDays(b.since, nowISO) - diffDays(a.since, nowISO))
    .map(({ item }) => item);
}

export function mostWorn(items: Item[], limit = 10): Item[] {
  return activeItems(items)
    .slice()
    .sort(
      (a, b) =>
        b.wearCount - a.wearCount ||
        (b.lastWornAt ?? '').localeCompare(a.lastWornAt ?? ''),
    )
    .slice(0, limit);
}

export function leastWorn(items: Item[], limit = 10): Item[] {
  return activeItems(items)
    .slice()
    .sort(
      (a, b) =>
        a.wearCount - b.wearCount ||
        (a.lastWornAt ?? '').localeCompare(b.lastWornAt ?? ''),
    )
    .slice(0, limit);
}

function rootCategory(category: Category, byId: Map<string, Category>): Category {
  let current = category;
  const seen = new Set<string>([current.id]);
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    current = parent;
  }
  return current;
}

export function categoryDistribution(items: Item[], categories: Category[]): DistributionEntry[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const counts = new Map<string, DistributionEntry>();
  for (const item of activeItems(items)) {
    const category = byId.get(item.categoryId);
    const root = category ? rootCategory(category, byId) : undefined;
    const entry = counts.get(root?.id ?? 'unknown') ?? {
      id: root?.id ?? 'unknown',
      label: root?.name ?? '未分类',
      count: 0,
    };
    entry.count += 1;
    counts.set(entry.id, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'),
  );
}

export function colorDistribution(items: Item[], colors: ColorSwatch[]): DistributionEntry[] {
  const byId = new Map(colors.map((color) => [color.id, color]));
  const counts = new Map<string, DistributionEntry>();
  for (const item of activeItems(items)) {
    const color = byId.get(item.colorPrimaryId);
    const entry = counts.get(item.colorPrimaryId) ?? {
      id: item.colorPrimaryId || 'unknown',
      label: color?.name ?? '未知',
      count: 0,
      hex: color?.hex,
    };
    entry.count += 1;
    counts.set(entry.id, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'),
  );
}
