import { useState } from 'react';
import type { ItemStatus, Season } from '../../domain/types';
import { ITEM_STATUS_OPTIONS } from '../../domain/itemStatus';
import { CategoryPicker } from '../../components/item/CategoryPicker';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';

export interface WardrobeFilterState {
  query: string;
  status: ItemStatus | 'all';
  season?: Season;
  categoryId?: string;
  includeRetired: boolean;
}

const SEASONS: Array<{ value: Season; label: string }> = [
  { value: 'spring', label: '春' },
  { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' },
  { value: 'winter', label: '冬' },
  { value: 'all', label: '四季' },
];

export function WardrobeFilters({
  value,
  onChange,
}: {
  value: WardrobeFilterState;
  onChange: (patch: Partial<WardrobeFilterState>) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="mb-4 space-y-2">
      <input
        type="search"
        aria-label="搜索衣橱"
        value={value.query}
        onChange={(event) => onChange({ query: event.target.value })}
        placeholder="搜索名称、品牌或备注"
        className="min-h-11 w-full rounded-xl border border-field-line bg-surface px-3 text-base outline-none focus:border-accent"
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ITEM_STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value.status === option.value}
            onClick={() => onChange({ status: option.value })}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${
              value.status === option.value
                ? 'border-accent bg-accent/10 text-accent-text'
                : 'border-line bg-surface text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CategoryPicker
            value={value.categoryId}
            onChange={(categoryId) => onChange({ categoryId })}
            label="类型"
          />
        </div>
        {value.categoryId ? (
          <Button variant="ghost" aria-label="清除类型" onClick={() => onChange({ categoryId: undefined })}>
            清除
          </Button>
        ) : null}
        <select
          aria-label="季节筛选"
          value={value.season ?? ''}
          onChange={(event) =>
            onChange({ season: (event.target.value || undefined) as Season | undefined })
          }
          className="min-h-11 rounded-xl border border-field-line bg-surface px-2 text-sm"
        >
          <option value="">季节</option>
          {SEASONS.map((season) => (
            <option key={season.value} value={season.value}>
              {season.label}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => setMoreOpen(true)}>
          更多
        </Button>
      </div>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="更多筛选">
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span>显示已移出衣橱的衣物</span>
          <input
            type="checkbox"
            checked={value.includeRetired}
            onChange={(event) => onChange({ includeRetired: event.target.checked })}
            className="h-5 w-5 accent-accent"
          />
        </label>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => {
            onChange({
              status: 'all',
              season: undefined,
              categoryId: undefined,
              includeRetired: false,
            });
            setMoreOpen(false);
          }}
        >
          清除全部筛选
        </Button>
      </Sheet>
    </div>
  );
}
