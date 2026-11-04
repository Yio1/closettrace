import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listCategories } from '../../db/repositories/categories';
import { listItems } from '../../db/repositories/items';
import type { Category, Item, Slot } from '../../domain/types';
import { SLOT_LABELS } from '../../domain/outfit';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { TextField } from '../ui/TextField';

export interface SlotPickerProps {
  slot: Slot;
  value?: string;
  sceneId?: string;
  onSelect: (itemId?: string) => void;
}

function matchesSlot(category: Category | undefined, slot: Slot): boolean {
  if (!category) return false;
  return category.slot === slot || (category.slots?.includes(slot) ?? false);
}

export function SlotPicker({ slot, value, sceneId, onSelect }: SlotPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const items = useLiveQuery(() => listItems({ includeRetired: false }), []) ?? [];
  const categories = useLiveQuery(() => listCategories(), []) ?? [];
  const label = SLOT_LABELS[slot];

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const selected = items.find((item) => item.id === value);
  const search = query.trim().toLowerCase();
  const candidates = items
    .filter((item) => {
      if (!showAll && item.status !== 'available') return false;
      if (!matchesSlot(categoryById.get(item.categoryId), slot)) return false;
      if (!search) return true;
      return [item.name, item.brand, item.note]
        .filter((entry): entry is string => typeof entry === 'string')
        .some((entry) => entry.toLowerCase().includes(search));
    })
    .sort((a, b) => {
      const aScene = sceneId ? Number(a.sceneTags.includes(sceneId)) : 0;
      const bScene = sceneId ? Number(b.sceneTags.includes(sceneId)) : 0;
      return bScene - aScene;
    });

  function choose(itemId?: string) {
    onSelect(itemId);
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <div className="flex min-h-14 items-center gap-2 border-b border-line py-2">
        <span className="w-14 shrink-0 text-sm text-muted">{label}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${selected ? '' : 'text-muted'}`}>
          {selected?.name ?? '未选择'}
        </span>
        <Button
          variant="secondary"
          aria-label={selected ? `更换${label}` : `选择${label}`}
          onClick={() => setOpen(true)}
        >
          {selected ? '更换' : '选择'}
        </Button>
        {selected ? (
          <Button variant="ghost" aria-label={`移除${label}`} onClick={() => choose(undefined)}>
            移除
          </Button>
        ) : null}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={`选择${label}`}>
        <TextField
          label="搜索单品"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="名称、品牌或备注"
        />
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
            className="h-4 w-4"
          />
          显示待洗/收纳
        </label>

        {candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            这个槽位还没有可用单品。先到衣橱里添加。
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {candidates.map((item: Item) => {
              const category = categoryById.get(item.categoryId);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={item.id === value}
                    onClick={() => choose(item.id)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left text-sm ${
                      item.id === value ? 'text-accent-text' : ''
                    }`}
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {category?.name ?? '未分类'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </>
  );
}
