import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listCategories } from '../../db/repositories/categories';
import { addWishlist } from '../../db/repositories/wishlist';
import { Button } from '../../components/ui/Button';
import { MoneyField } from '../../components/ui/MoneyField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Sheet } from '../../components/ui/Sheet';
import { TextField } from '../../components/ui/TextField';

const PRIORITY_OPTIONS: Array<{ value: '1' | '2' | '3'; label: string }> = [
  { value: '1', label: '低' },
  { value: '2', label: '中' },
  { value: '3', label: '高' },
];

export function WishlistFormSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const categories = useLiveQuery(() => listCategories(), []) ?? [];
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [size, setSize] = useState('');
  const [colorPreference, setColorPreference] = useState('');
  const [targetPriceCents, setTargetPriceCents] = useState(0);
  const [priority, setPriority] = useState<'1' | '2' | '3'>('2');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setError('请填写名称');
      return;
    }
    if (!categoryId) {
      setError('请选择类型');
      return;
    }
    setSaving(true);
    try {
      await addWishlist({
        name,
        brand: brand.trim() || undefined,
        categoryId,
        size: size.trim() || undefined,
        colorPreference: colorPreference.trim() || undefined,
        targetPriceCents: targetPriceCents > 0 ? targetPriceCents : undefined,
        priority: Number(priority) as 1 | 2 | 3,
        note: note.trim() || undefined,
      });
      onSaved?.();
      onClose();
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="记一件想买">
      <div className="space-y-3">
        <TextField label="名称" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label="品牌" value={brand} onChange={(event) => setBrand(event.target.value)} />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">类型</span>
          <select
            aria-label="类型"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-field-line bg-surface px-3 text-base"
          >
            <option value="">请选择</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="尺码" value={size} onChange={(event) => setSize(event.target.value)} />
          <TextField
            label="颜色偏好"
            value={colorPreference}
            onChange={(event) => setColorPreference(event.target.value)}
          />
        </div>
        <MoneyField
          label="目标价"
          valueCents={targetPriceCents}
          onChange={setTargetPriceCents}
        />
        <div>
          <span className="mb-1.5 block text-sm font-medium">优先级</span>
          <SegmentedControl
            ariaLabel="优先级"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={setPriority}
          />
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">备注</span>
          <textarea
            aria-label="备注"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-field-line bg-surface px-3 py-2 text-base"
          />
        </label>

        {error ? <p className="text-sm text-danger-text">{error}</p> : null}

        <div className="flex gap-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            保存
          </Button>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
