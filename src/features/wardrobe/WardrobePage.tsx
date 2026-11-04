import { useDeferredValue, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ItemStatus } from '../../domain/types';
import { filterItems } from '../../domain/itemFilter';
import { ITEM_STATUS_LABELS } from '../../domain/itemStatus';
import { listItems, moveItems, setItemsStatus } from '../../db/repositories/items';
import { BatchBar } from './BatchBar';
import { WardrobeFilters, type WardrobeFilterState } from './WardrobeFilters';
import { WardrobeItemCard } from './WardrobeItemCard';
import { WardrobeTabs } from './WardrobeTabs';
import { LocationPicker } from '../../components/item/LocationPicker';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Sheet } from '../../components/ui/Sheet';

const MANUAL_STATUSES: ItemStatus[] = ['available', 'laundry', 'repair', 'stored'];

export function WardrobePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const allItems = useLiveQuery(() => listItems({ includeRetired: true }), []);
  const [filters, setFilters] = useState<WardrobeFilterState>(() => {
    const status = searchParams.get('status');
    const allowed: Array<ItemStatus | 'all'> = [
      'available',
      'laundry',
      'repair',
      'stored',
      'retired',
      'all',
    ];
    const initialStatus = allowed.find((entry) => entry === status) ?? 'all';
    return { query: '', status: initialStatus, includeRetired: false };
  });
  const deferredQuery = useDeferredValue(filters.query);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const visible = useMemo(
    () =>
      filterItems(allItems ?? [], {
        query: deferredQuery,
        status: filters.status,
        season: filters.season,
        categoryId: filters.categoryId,
        includeRetired: filters.includeRetired,
      }),
    [
      allItems,
      deferredQuery,
      filters.status,
      filters.season,
      filters.categoryId,
      filters.includeRetired,
    ],
  );

  function updateFilters(patch: Partial<WardrobeFilterState>) {
    setFilters((previous) => ({ ...previous, ...patch }));
  }

  function toggleSelection() {
    setSelectionMode((current) => !current);
    setSelected(new Set());
    setMoveOpen(false);
    setStatusOpen(false);
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelected(new Set());
    setMoveOpen(false);
    setStatusOpen(false);
  }

  function toggleItem(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startSelection(id: string) {
    if (selectionMode) {
      toggleItem(id);
      return;
    }
    setSelectionMode(true);
    setSelected(new Set([id]));
  }

  async function applyStatus(status: ItemStatus) {
    await setItemsStatus([...selected], status);
    exitSelection();
  }

  async function applyMove(locationId?: string) {
    await moveItems([...selected], locationId);
    exitSelection();
  }

  async function retireSelected() {
    if (!window.confirm(`将 ${selected.size} 件衣物移出衣橱？之后可在“已移出”中找回。`)) return;
    await setItemsStatus([...selected], 'retired');
    exitSelection();
  }

  const activeCount = allItems?.filter((item) => item.status !== 'retired').length ?? 0;

  return (
    <div className={selectionMode ? 'pb-16' : undefined}>
      <PageHeader
        title="衣橱"
        subtitle={`${visible.length} 件`}
        action={
          <div className="flex items-center gap-1">
            <Button variant="secondary" onClick={toggleSelection}>
              {selectionMode ? '完成' : '选择'}
            </Button>
            <Button aria-label="添加衣物" onClick={() => navigate('/wardrobe/item/new')}>
              <Plus size={18} aria-hidden />
            </Button>
          </div>
        }
      />

      <WardrobeTabs />

      <WardrobeFilters value={filters} onChange={updateFilters} />

      {allItems === undefined ? null : visible.length === 0 ? (
        <EmptyState
          title={activeCount === 0 ? '衣橱还是空的' : '没有符合条件的衣物'}
          description={
            activeCount === 0
              ? '拍照或从相册选择，添加第一件衣服。类型、颜色和位置都可以稍后补。'
              : '换个关键词或清除筛选再看看。'
          }
          action={
            activeCount === 0 ? (
              <Button onClick={() => navigate('/wardrobe/item/new')}>添加第一件</Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() =>
                  setFilters({ query: '', status: 'all', includeRetired: false })
                }
              >
                清除筛选
              </Button>
            )
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

      {selectionMode && selected.size > 0 ? (
        <BatchBar
          count={selected.size}
          onMove={() => setMoveOpen(true)}
          onStatus={() => setStatusOpen(true)}
          onRetire={retireSelected}
          onCancel={exitSelection}
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
    </div>
  );
}
