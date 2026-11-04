import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown } from 'lucide-react';
import { listCategories } from '../../db/repositories/categories';
import { Sheet } from '../ui/Sheet';
import { TextField } from '../ui/TextField';

export interface CategoryPickerProps {
  value?: string;
  onChange: (id: string) => void;
  label?: string;
}

export function CategoryPicker({ value, onChange, label = '类型' }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const categories = useLiveQuery(() => listCategories(), []);
  const selected = categories?.find((category) => category.id === value);

  const groups = useMemo(() => {
    if (!categories) return [];
    const text = query.trim();
    const parents = categories.filter((category) => !category.parentId);
    return parents
      .map((parent) => ({
        parent,
        children: categories.filter(
          (category) =>
            category.parentId === parent.id &&
            (!text || category.name.includes(text) || parent.name.includes(text)),
        ),
      }))
      .filter((group) => group.children.length > 0);
  }, [categories, query]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery('');
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
        <span className="flex items-center gap-1 text-sm">
          {selected?.name ?? '请选择'}
          <ChevronDown size={16} aria-hidden />
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="选择类型">
        <TextField
          label="搜索类型"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入中文名称"
        />
        <div className="mt-3 space-y-4">
          {groups.map(({ parent, children }) => (
            <section key={parent.id}>
              <h3 className="mb-1.5 text-xs font-medium text-muted">{parent.name}</h3>
              <div className="grid grid-cols-2 gap-2">
                {children.map((category) => {
                  const active = category.id === value;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => choose(category.id)}
                      className={`min-h-11 rounded-xl border px-3 text-sm ${
                        active ? 'border-accent bg-accent/10 text-accent-text' : 'border-line bg-surface'
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {categories && groups.length === 0 ? (
            <p className="text-sm text-muted">没有匹配的类型</p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
