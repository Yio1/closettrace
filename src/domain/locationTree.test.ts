import { describe, expect, it } from 'vitest';
import type { Location } from './types';
import {
  buildLocationTree,
  countItemsByLocation,
  descendantLocationIds,
  locationPath,
} from './locationTree';

function location(
  id: string,
  name: string,
  order: number,
  parentId?: string,
): Location {
  return {
    id,
    name,
    parentId,
    order,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const bedroom = location('bedroom', '卧室', 1);
const wardrobe = location('wardrobe', '主衣柜', 1, 'bedroom');
const rail = location('rail', '挂杆', 1, 'wardrobe');
const drawer = location('drawer', '抽屉', 2, 'wardrobe');
const entry = location('entry', '玄关', 2);
const shoeCabinet = location('shoe', '鞋柜', 1, 'entry');

const all = [rail, shoeCabinet, wardrobe, entry, bedroom, drawer];

describe('locationTree', () => {
  it('nests locations by parent and preserves order', () => {
    const tree = buildLocationTree(all);
    expect(tree.map((node) => node.location.id)).toEqual(['bedroom', 'entry']);
    expect(tree[0].children.map((node) => node.location.id)).toEqual(['wardrobe']);
    expect(tree[0].children[0].children.map((node) => node.location.id)).toEqual([
      'rail',
      'drawer',
    ]);
  });

  it('counts nodes including descendants', () => {
    const tree = buildLocationTree(all);
    expect(tree[0].totalCount).toBe(4);
    expect(tree[0].children[0].totalCount).toBe(3);
    expect(tree[1].totalCount).toBe(2);
  });

  it('keeps orphaned locations visible as roots', () => {
    const orphan = location('orphan', '旧柜子', 3, 'missing-parent');
    const tree = buildLocationTree([...all, orphan]);
    expect(tree.map((node) => node.location.id)).toContain('orphan');
  });

  it('builds readable paths', () => {
    expect(locationPath(all, 'rail')).toBe('卧室 / 主衣柜 / 挂杆');
    expect(locationPath(all, 'bedroom')).toBe('卧室');
    expect(locationPath(all, 'missing')).toBe('未指定');
    expect(locationPath(all, undefined)).toBe('未指定');
  });

  it('does not loop on cyclic parent links', () => {
    const a = location('a', 'A', 1, 'b');
    const b = location('b', 'B', 2, 'a');
    expect(() => buildLocationTree([a, b])).not.toThrow();
    expect(locationPath([a, b], 'a')).toBe('B / A');
  });

  it('counts items on every ancestor', () => {
    const counts = countItemsByLocation(all, [
      { locationId: 'rail' },
      { locationId: 'drawer' },
      { locationId: 'shoe' },
      {},
      { locationId: 'missing' },
    ]);
    expect(counts.get('rail')).toBe(1);
    expect(counts.get('wardrobe')).toBe(2);
    expect(counts.get('bedroom')).toBe(2);
    expect(counts.get('shoe')).toBe(1);
  });

  it('collects a location subtree with a cycle guard', () => {
    expect([...descendantLocationIds(all, 'wardrobe')].sort()).toEqual([
      'drawer',
      'rail',
      'wardrobe',
    ]);
    const a = location('a', 'A', 1, 'b');
    const b = location('b', 'B', 2, 'a');
    expect(descendantLocationIds([a, b], 'a').size).toBe(2);
    expect(descendantLocationIds(all, 'missing').size).toBe(0);
  });
});
