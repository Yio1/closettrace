import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import type { ItemStatus, Location } from '../../domain/types';
import { descendantLocationIds, locationPath } from '../../domain/locationTree';
import { ITEM_STATUS_LABELS } from '../../domain/itemStatus';
import { listItems, moveItems, setItemsStatus } from '../../db/repositories/items';
import { deleteLocation, listLocations, updateLocation } from '../../db/repositories/locations';
import { BatchBar } from './BatchBar';
import { WardrobeItemCard } from './WardrobeItemCard';
import { WardrobeTabs } from './WardrobeTabs';
import { LocationPicker } from '../../components/item/LocationPicker';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Sheet } from '../../components/ui/Sheet';
import { TextField } from '../../components/ui/TextField';

const MANUAL_STATUSES: ItemStatus[] = ['available', 'laundry', 'repair', 'stored'];
const NO_LOCATIONS: Location[] = [];

export function LocationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const unassigned = id === 'unassigned';
  const locations = useLiveQuery(() => listLocations(), []) ?? NO_LOCATIONS;
  const items = useLiveQuery(() => listItems(), []) ?? [];

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const location = unassigned ? undefined : locations.find((entry) => entry.id === id);
  const subtree = useMemo(
    () => (unassigned ? new Set<string>() : descendantLocationIds(locations, id)),
    [id, locations, unassigned],
  );
  const visible = items.filter((item) =>
    unassigned ? !item.locationId : Boolean(item.locationId && subtree.has(item.locationId)),
  );

  function toggleSelection() {
    setSelectionMode((current) => !current);
    setSelected(new Set());
  }

  function toggleItem(itemId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function startSelection(itemId: string) {
    if (selectionMode) {
      toggleItem(itemId);
      return;
    }
    setSelectionMode(true);
    setSelected(new Set([itemId]));
  }

  async function applyStatus(status: ItemStatus) {
    await setItemsStatus([...selected], status);
    setStatusOpen(false);
    toggleSelection();
  }

  async function applyMove(locationId?: string) {
    await moveItems([...selected], locationId);
    setMoveOpen(false);
    toggleSelection();
  }

  async function retireSelected() {
    if (!window.confirm(`将 ${selected.size} 件衣物移出衣橱？`)) return;
    await setItemsStatus([...selected], 'retired');
    toggleSelection();
  }

  function openEdit() {
    if (!location) return;
    setName(location.name);
    setParentId(location.parentId ?? '');
    setFormError('');
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!location) return;
    if (!name.trim()) {
      setFormError('请输入位置名称');
      return;
    }
    await updateLocation(location.id, {
      name: name.trim(),
      parentId: parentId || undefined,
    });
    setEditOpen(false);
  }

  async function handleDelete() {
    if (!location) return;
    if (!window.confirm(`删除位置“${location.name}”？空位置才能删除。`)) return;
    try {
      await deleteLocation(location.id);
      navigate('/wardrobe/locations', { replace: true });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除失败');
    }
  }

  if (!unassigned && !location) {
    return (
      <EmptyState
        title="找不到这个位置"
        description="它可能已被删除。"
        action={<Button onClick={() => navigate('/wardrobe/locations')}>返回位置</Button>}
      />
    );
  }

  const forbiddenParents = descendantLocationIds(locations, id);

  return (
    <div className={selectionMode ? 'pb-16' : undefined}>
      <Link
        to="/wardrobe/locations"
        className="mb-2 flex min-h-11 items-center gap-1 text-sm text-muted"
      >
        <ArrowLeft size={18} aria-hidden />
        返回位置
      </Link>
      <PageHeader
        title={unassigned ? '未指定' : location?.name ?? ''}
        subtitle={
          unassigned
            ? '还没有放好位置的衣物'
            : location
              ? `${locationPath(locations, location.id)} · ${visible.length} 件`
              : undefined
        }
        action={
          <div className="flex items-center gap-1">
            <Button variant="secondary" onClick={toggleSelection}>
              {selectionMode ? '完成' : '选择'}
            </Button>
            {location ? (
              <Button aria-label="编辑位置" variant="secondary" onClick={openEdit}>
                <Pencil size={16} aria-hidden />
              </Button>
            ) : null}
          </div>
        }
      />
      <WardrobeTabs />

      {visible.length === 0 ? (
        <EmptyState
          title={unassigned ? '所有衣物都有位置了' : '这个位置还没有衣物'}
          description={
            unassigned
              ? '继续添加衣物时可以选择存放位置。'
              : '可以在衣橱里选择衣物后批量移动到这里。'
          }
          action={
            <Button variant="secondary" onClick={() => navigate('/wardrobe')}>
              去衣橱
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((item) => (
            <WardrobeItemCard
              key={item.id}
              item={item}
              selectionMode={selectionMode}
              selected={selected.has(item.id)}
              onClick={() => toggleItem(item.id)}
              onLongPress={() => startSelection(item.id)}
            />
          ))}
        </div>
      )}

      {location ? (
        <Card className="mt-4 space-y-2">
          {deleteError ? <p className="text-sm text-danger-text">{deleteError}</p> : null}
          <Button variant="danger" className="w-full" onClick={handleDelete}>
            删除这个位置
          </Button>
        </Card>
      ) : null}

      {selectionMode && selected.size > 0 ? (
        <BatchBar
          count={selected.size}
          onMove={() => setMoveOpen(true)}
          onStatus={() => setStatusOpen(true)}
          onRetire={retireSelected}
          onCancel={toggleSelection}
        />
      ) : null}

      <Sheet open={moveOpen} onClose={() => setMoveOpen(false)} title="移动存放位置">
        <LocationPicker allowCreate onChange={applyMove} />
      </Sheet>

      <Sheet open={statusOpen} onClose={() => setStatusOpen(false)} title="更改状态">
        <div className="space-y-2">
          {MANUAL_STATUSES.map((status) => (
            <Button
              key={status}
              variant="secondary"
              className="w-full"
              onClick={() => applyStatus(status)}
            >
              {ITEM_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="编辑位置">
        <div className="space-y-3">
          <TextField
            label="位置名称"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFormError('');
            }}
            error={formError}
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
              {locations
                .filter((entry) => !forbiddenParents.has(entry.id))
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {locationPath(locations, entry.id)}
                  </option>
                ))}
            </select>
          </label>
          <Button className="w-full" onClick={handleEdit}>
            保存修改
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
