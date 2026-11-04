import { useRef } from 'react';
import { MapPin, Star } from 'lucide-react';
import type { Category, ColorSwatch, Item } from '../../domain/types';
import { ITEM_STATUS_LABELS } from '../../domain/itemStatus';
import { cn } from '../../lib/cn';

export interface ItemCardProps {
  item: Item;
  category?: Category;
  color?: ColorSwatch;
  locationPath?: string;
  thumbUrl?: string;
  selected?: boolean;
  onClick?: () => void;
  onLongPress?: () => void;
}

export function ItemCard({
  item,
  category,
  color,
  locationPath,
  thumbUrl,
  selected,
  onClick,
  onLongPress,
}: ItemCardProps) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  function startPress() {
    if (!onLongPress) return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onLongPress();
    }, 500);
  }

  function cancelPress() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function handleClick() {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onClick?.();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      aria-pressed={selected === undefined ? undefined : selected}
      className={cn(
        'relative overflow-hidden rounded-card border bg-surface text-left',
        selected ? 'border-accent ring-2 ring-accent' : 'border-line',
      )}
    >
      <div className="relative aspect-square w-full bg-bg">
        {thumbUrl ? (
          <img src={thumbUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div
            data-testid="item-color"
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: color?.hex ?? 'var(--line)' }}
          >
            <span className="text-2xl font-semibold text-black/25">{item.name.slice(0, 1)}</span>
          </div>
        )}

        {item.status !== 'available' ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {ITEM_STATUS_LABELS[item.status]}
          </span>
        ) : null}

        {selected ? (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs text-on-accent">
            ✓
          </span>
        ) : null}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          {item.isFavorite ? <Star size={13} className="shrink-0 text-accent" aria-hidden /> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">{category?.name ?? '未分类'}</p>
        {locationPath ? (
          <p className="mt-1 flex items-center gap-0.5 text-[11px] text-muted">
            <MapPin size={11} aria-hidden />
            <span className="truncate">{locationPath}</span>
          </p>
        ) : null}
      </div>
    </button>
  );
}
