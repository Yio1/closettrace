import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ISODate, Item, Outfit } from '../../domain/types';
import { formatDateZh } from '../../domain/date';
import { listItems, setItemsStatus } from '../../db/repositories/items';
import { listOutfitItems, listOutfits } from '../../db/repositories/outfits';
import { logWear } from '../../db/repositories/wearLogs';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Sheet } from '../../components/ui/Sheet';

type LogMode = 'items' | 'outfit';

const MODE_OPTIONS: Array<{ value: LogMode; label: string }> = [
  { value: 'items', label: '选单品' },
  { value: 'outfit', label: '选搭配' },
];

export interface WearLogSheetProps {
  open: boolean;
  onClose: () => void;
  date: ISODate;
  presetOutfit?: Outfit;
  presetItems?: Item[];
  sceneId?: string;
  tempC?: number;
}

export function WearLogSheet({
  open,
  onClose,
  date,
  presetOutfit,
  presetItems,
  sceneId,
  tempC,
}: WearLogSheetProps) {
  const allItems = useLiveQuery(() => listItems({ includeRetired: true }), []) ?? [];
  const outfits = useLiveQuery(() => listOutfits(), []) ?? [];
  const [mode, setMode] = useState<LogMode>(presetOutfit ? 'outfit' : 'items');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set((presetItems ?? []).map((item) => item.id)),
  );
  const [outfitId, setOutfitId] = useState(presetOutfit?.id ?? '');
  const [addLaundry, setAddLaundry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableItems = allItems.filter((item) => item.status === 'available');
  const fixed = Boolean(presetOutfit && presetItems);

  function toggleItem(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function resolveOutfitItems(id: string): Promise<Item[]> {
    const rows = await listOutfitItems(id);
    return rows.flatMap((row) => {
      const item = allItems.find((entry) => entry.id === row.itemId);
      return item ? [item] : [];
    });
  }

  async function handleSave() {
    if (saving) return;
    let wearItems: Item[];
    let wearOutfitId: string | undefined;

    if (presetOutfit) {
      wearOutfitId = presetOutfit.id;
      wearItems = presetItems ?? (await resolveOutfitItems(presetOutfit.id));
    } else if (presetItems) {
      wearItems = presetItems;
    } else if (mode === 'outfit') {
      if (!outfitId) {
        setError('先选择一套搭配');
        return;
      }
      wearOutfitId = outfitId;
      wearItems = await resolveOutfitItems(outfitId);
    } else {
      wearItems = availableItems.filter((item) => selectedIds.has(item.id));
    }

    if (wearItems.length === 0) {
      setError('先选择要记录的单品');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await logWear({
        date,
        outfitId: wearOutfitId,
        sceneId,
        tempC,
        items: wearItems,
      });
      if (addLaundry) {
        await setItemsStatus(wearItems.map((item) => item.id), 'laundry');
      }
      onClose();
    } catch {
      setError('记录失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`记录 ${formatDateZh(date)} 的穿着`}>
      {fixed ? null : (
        <SegmentedControl
          ariaLabel="记录方式"
          options={MODE_OPTIONS}
          value={mode}
          onChange={(value) => {
            setMode(value);
            setError('');
          }}
        />
      )}

      {mode === 'outfit' ? (
        presetOutfit ? (
          <p className="mt-3 min-h-12 text-sm">{presetOutfit.name}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {outfits.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted">还没有保存的搭配。</li>
            ) : (
              outfits.map((outfit) => (
                <li key={outfit.id}>
                  <button
                    type="button"
                    aria-pressed={outfit.id === outfitId}
                    onClick={() => setOutfitId(outfit.id)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 text-left text-sm ${
                      outfit.id === outfitId ? 'text-accent-text' : ''
                    }`}
                  >
                    <span className="truncate">{outfit.name}</span>
                    <span className="shrink-0 text-xs text-muted">穿过 {outfit.wearCount} 次</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {availableItems.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">没有可穿的在衣橱单品。</li>
          ) : (
            availableItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={item.name}
                  aria-pressed={selectedIds.has(item.id)}
                  onClick={() => toggleItem(item.id)}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 text-left text-sm ${
                    selectedIds.has(item.id) ? 'text-accent-text' : ''
                  }`}
                >
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {selectedIds.has(item.id) ? '已选' : '选择'}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          aria-label="顺便加入待洗"
          checked={addLaundry}
          onChange={(event) => setAddLaundry(event.target.checked)}
          className="h-4 w-4"
        />
        顺便加入待洗
      </label>

      {error ? <p className="mb-2 text-sm text-danger-text">{error}</p> : null}

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? '保存中…' : '保存穿着'}
      </Button>
    </Sheet>
  );
}
