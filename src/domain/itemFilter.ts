import type { Item, ItemStatus, Season } from './types';

export interface ItemFilter {
  query?: string;
  categoryId?: string;
  status?: ItemStatus | 'all';
  season?: Season;
  locationId?: string;
  colorId?: string;
  sceneId?: string;
  styleTag?: string;
  includeRetired?: boolean;
}

function matchesQuery(item: Item, query: string): boolean {
  const haystack = [
    item.name,
    item.brand,
    item.note,
    item.material,
    item.size,
    ...item.sceneTags,
    ...item.styleTags,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function filterItems(items: Item[], filter: ItemFilter = {}): Item[] {
  const includeRetired = filter.includeRetired ?? filter.status === 'retired';
  const query = filter.query?.trim();

  return items
    .filter((item) => {
      if (!includeRetired && item.status === 'retired') return false;
      if (filter.status && filter.status !== 'all' && item.status !== filter.status) return false;
      if (filter.categoryId && item.categoryId !== filter.categoryId) return false;
      if (filter.season && !item.seasons.includes(filter.season) && !item.seasons.includes('all')) {
        return false;
      }
      if (filter.locationId && item.locationId !== filter.locationId) return false;
      if (
        filter.colorId &&
        item.colorPrimaryId !== filter.colorId &&
        item.colorSecondaryId !== filter.colorId
      ) {
        return false;
      }
      if (filter.sceneId && !item.sceneTags.includes(filter.sceneId)) return false;
      if (filter.styleTag && !item.styleTags.includes(filter.styleTag)) return false;
      if (query && !matchesQuery(item, query)) return false;
      return true;
    })
    .sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, 'zh-CN'),
    );
}
