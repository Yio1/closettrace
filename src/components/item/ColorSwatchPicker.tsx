import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown } from 'lucide-react';
import { listColors } from '../../db/repositories/dictionaries';
import { Sheet } from '../ui/Sheet';

export interface ColorSwatchPickerProps {
  value?: string;
  onChange: (id?: string) => void;
  label?: string;
  allowNone?: boolean;
}

export function ColorSwatchPicker({
  value,
  onChange,
  label = '主色',
  allowNone = false,
}: ColorSwatchPickerProps) {
  const [open, setOpen] = useState(false);
  const colors = useLiveQuery(() => listColors(), []);
  const selected = colors?.find((color) => color.id === value);

  function choose(id?: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label}：${selected?.name ?? '未选择'}`}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-field-line bg-surface px-3 text-left"
      >
        <span className="text-sm text-muted">{label}</span>
        <span className="flex items-center gap-2 text-sm">
          {selected ? (
            <span
              aria-hidden
              className="h-4 w-4 rounded-full border border-line"
              style={{ backgroundColor: selected.hex }}
            />
          ) : null}
          {selected?.name ?? '请选择'}
          <ChevronDown size={16} aria-hidden />
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={`选择${label}`}>
        <div className="grid grid-cols-4 gap-2">
          {allowNone ? (
            <button
              type="button"
              onClick={() => choose(undefined)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-xl border text-xs ${
                value ? 'border-line' : 'border-accent bg-accent/10 text-accent-text'
              }`}
            >
              无
            </button>
          ) : null}
          {colors?.map((color) => {
            const active = color.id === value;
            return (
              <button
                key={color.id}
                type="button"
                aria-pressed={active}
                aria-label={color.name}
                onClick={() => choose(color.id)}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs ${
                  active ? 'border-accent bg-accent/10 text-accent-text' : 'border-line'
                }`}
              >
                <span
                  aria-hidden
                  className="h-7 w-7 rounded-full border border-line"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
