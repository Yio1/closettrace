import type { Location } from './types';

export interface LocationNode {
  location: Location;
  children: LocationNode[];
  totalCount: number;
}

function compareLocations(a: Location, b: Location): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'zh-CN');
}

export function buildLocationTree(locations: Location[]): LocationNode[] {
  const sorted = [...locations].sort(compareLocations);
  const ids = new Set(sorted.map((location) => location.id));
  const childrenByParent = new Map<string, Location[]>();
  const roots: Location[] = [];

  for (const location of sorted) {
    if (location.parentId && ids.has(location.parentId)) {
      const siblings = childrenByParent.get(location.parentId) ?? [];
      siblings.push(location);
      childrenByParent.set(location.parentId, siblings);
    } else {
      roots.push(location);
    }
  }

  const visited = new Set<string>();
  const build = (location: Location, ancestors: Set<string>): LocationNode => {
    visited.add(location.id);
    const nextAncestors = new Set(ancestors).add(location.id);
    const children = (childrenByParent.get(location.id) ?? [])
      .filter((child) => !nextAncestors.has(child.id))
      .map((child) => build(child, nextAncestors));
    return {
      location,
      children,
      totalCount: 1 + children.reduce((sum, child) => sum + child.totalCount, 0),
    };
  };

  const tree = roots.map((root) => build(root, new Set()));
  for (const location of sorted) {
    if (!visited.has(location.id)) tree.push(build(location, new Set()));
  }
  return tree;
}

export function locationPath(locations: Location[], id?: string): string {
  if (!id) return '未指定';
  const byId = new Map(locations.map((location) => [location.id, location]));
  const names: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(id);

  if (!current) return '未指定';
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(' / ');
}
