import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { ColorSwatch, Item, Outfit, Scene, Slot } from '../../domain/types';
import { formatDateZh } from '../../domain/date';

export interface OutfitEntry {
  item: Item;
  slot: Slot;
}

export function OutfitCard({
  outfit,
  entries,
  scenes,
  colors,
}: {
  outfit: Outfit;
  entries: OutfitEntry[];
  scenes: Scene[];
  colors: ColorSwatch[];
}) {
  const sceneNames = outfit.sceneIds
    .map((id) => scenes.find((scene) => scene.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const colorById = new Map(colors.map((color) => [color.id, color]));
  const preview = entries.slice(0, 4);

  return (
    <Link
      to={`/outfits/${outfit.id}`}
      className="block overflow-hidden rounded-card border border-line bg-surface active:bg-bg"
    >
      <div
        aria-hidden
        className={`grid aspect-[2/1] gap-px bg-line ${
          preview.length > 2 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2'
        }`}
      >
        {preview.length === 0 ? (
          <div className="col-span-2 flex items-center justify-center bg-bg text-xs text-muted">
            暂无单品
          </div>
        ) : (
          preview.map(({ item }) => {
            const color = colorById.get(item.colorPrimaryId);
            return (
              <div
                key={item.id}
                className={`flex items-center justify-center ${
                  preview.length === 1 ? 'col-span-2' : ''
                }`}
                style={{ backgroundColor: color?.hex ?? 'var(--line)' }}
              >
                <span className="text-xl font-semibold text-black/25">{item.name.slice(0, 1)}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium">{outfit.name}</p>
          {outfit.isFavorite ? (
            <Star size={14} aria-label="已收藏" className="shrink-0 text-accent" />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {sceneNames.length > 0 ? `${sceneNames.join(' · ')} · ` : ''}
          {entries.length > 0 ? entries.map((entry) => entry.item.name).join(' + ') : '暂无单品'}
        </p>
        <p className="mt-1 text-xs text-muted">
          {outfit.wearCount > 0 ? `穿过 ${outfit.wearCount} 次` : '还没穿过'}
          {outfit.lastWornAt ? ` · 最近 ${formatDateZh(outfit.lastWornAt)}` : ''}
        </p>
      </div>
    </Link>
  );
}
