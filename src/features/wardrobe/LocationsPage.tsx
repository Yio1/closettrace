import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import type { LocationNode } from '../../domain/locationTree';
import { buildLocationTree, countItemsByLocation, locationPath } from '../../domain/locationTree';
import { createLocation, listLocations } from '../../db/repositories/locations';
import { listItems } from '../../db/repositories/items';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Sheet } from '../../components/ui/Sheet';
import { TextField } from '../../components/ui/TextField';
import { WardrobeTabs } from './WardrobeTabs';

export function LocationsPage() {
  const locations = useLiveQuery(() => listLocations(), []) ?? [];
  const items = useLiveQuery(() => listItems(), []) ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');

  const tree = buildLocationTree(locations);
  const counts = countItemsByLocation(locations, items);
  const unassigned = items.filter((item) => !item.locationId).length;

  function closeCreate() {
    setCreateOpen(false);
    setName('');
    setParentId('');
    setError('');
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('请输入位置名称');
      return;
    }
    try {
      await createLocation({ name: name.trim(), parentId: parentId || undefined });
      closeCreate();
    } catch {
      setError('创建失败，请重试');
    }
  }

  function renderNodes(nodes: LocationNode[], depth = 0): ReactNode {
    return nodes.map((node) => (
      <li key={node.location.id}>
        <Link
          to={`/wardrobe/locations/${node.location.id}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          className="flex min-h-12 items-center justify-between rounded-xl pr-3 text-sm active:bg-bg"
        >
          <span className="flex items-center gap-1">
            {node.location.name}
            <ChevronRight size={14} aria-hidden className="text-muted" />
          </span>
          <span className="tabular text-xs text-muted">{counts.get(node.location.id) ?? 0} 件</span>
        </Link>
        {node.children.length > 0 ? (
          <ul className="space-y-0.5">{renderNodes(node.children, depth + 1)}</ul>
        ) : null}
      </li>
    ));
  }

  return (
    <div>
      <PageHeader
        title="位置"
        subtitle="按柜子、抽屉或收纳箱整理"
        action={
          <Button aria-label="新建位置" onClick={() => setCreateOpen(true)}>
            <Plus size={18} aria-hidden />
          </Button>
        }
      />
      <WardrobeTabs />

      {locations.length === 0 ? (
        <EmptyState
          title="还没有存放位置"
          description="先建一个柜子或收纳箱，再把衣物放进去。"
          action={<Button onClick={() => setCreateOpen(true)}>新建位置</Button>}
        />
      ) : (
        <ul className="space-y-0.5">{renderNodes(tree)}</ul>
      )}

      <Link
        to="/wardrobe/locations/unassigned"
        className="mt-2 flex min-h-12 items-center justify-between rounded-xl border border-dashed border-line px-3 text-sm"
      >
        <span>未指定</span>
        <span className="tabular text-xs text-muted">{unassigned} 件</span>
      </Link>

      <Sheet open={createOpen} onClose={closeCreate} title="新建位置">
        <div className="space-y-3">
          <TextField
            label="位置名称"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
            placeholder="例如：主卧衣柜"
            error={error}
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">上级位置</span>
            <select
              aria-label="上级位置"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-field-line bg-surface px-3 text-base"
            >
              <option value="">无（顶层）</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {locationPath(locations, location.id)}
                </option>
              ))}
            </select>
          </label>
          <Button className="w-full" onClick={handleCreate}>
            保存位置
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
