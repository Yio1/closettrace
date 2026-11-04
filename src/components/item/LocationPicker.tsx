import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown } from 'lucide-react';
import { buildLocationTree, locationPath } from '../../domain/locationTree';
import { createLocation, listLocations } from '../../db/repositories/locations';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { TextField } from '../ui/TextField';

export interface LocationPickerProps {
  value?: string;
  onChange: (id?: string) => void;
  allowCreate?: boolean;
  label?: string;
}

export function LocationPicker({
  value,
  onChange,
  allowCreate = false,
  label = '存放位置',
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const locations = useLiveQuery(() => listLocations(), []) ?? [];
  const tree = buildLocationTree(locations);
  const path = locationPath(locations, value);

  function close() {
    setOpen(false);
    setCreating(false);
    setName('');
    setError('');
  }

  function choose(id?: string) {
    onChange(id);
    close();
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('请输入位置名称');
      return;
    }
    try {
      const id = await createLocation({ name: name.trim(), parentId });
      onChange(id);
      close();
    } catch {
      setError('创建失败，请重试');
    }
  }

  function renderNodes(nodes: ReturnType<typeof buildLocationTree>, depth = 0): ReactNode {
    return nodes.map((node) => (
      <div key={node.location.id}>
        <button
          type="button"
          onClick={() => choose(node.location.id)}
          style={{ paddingLeft: 12 + depth * 16 }}
          className={`flex min-h-11 w-full items-center justify-between rounded-xl pr-3 text-left text-sm ${
            node.location.id === value ? 'bg-accent/10 text-accent-text' : ''
          }`}
        >
          <span>{node.location.name}</span>
          <span className="text-xs text-muted">{node.totalCount}</span>
        </button>
        {renderNodes(node.children, depth + 1)}
      </div>
    ));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label}：${path}`}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-field-line bg-surface px-3 text-left"
      >
        <span className="text-sm text-muted">{label}</span>
        <span className="flex min-w-0 items-center gap-1 text-sm">
          <span className="truncate">{path}</span>
          <ChevronDown size={16} aria-hidden />
        </span>
      </button>

      <Sheet open={open} onClose={close} title="选择存放位置">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => choose(undefined)}
            className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm ${
              value ? '' : 'bg-accent/10 text-accent-text'
            }`}
          >
            未指定
          </button>
          {renderNodes(tree)}
        </div>

        {locations.length === 0 && !creating ? (
          <p className="mt-2 text-sm text-muted">还没有位置，先建一个柜子或收纳箱。</p>
        ) : null}

        {allowCreate ? (
          creating ? (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <TextField
                label="位置名称"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
                placeholder="例如：主卧衣柜"
                error={error}
              />
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">上级位置</span>
                <select
                  value={parentId ?? ''}
                  onChange={(event) => setParentId(event.target.value || undefined)}
                  className="min-h-11 w-full rounded-xl border border-field-line bg-surface px-3 text-base"
                >
                  <option value="">无（顶层）</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {locationPath(locations, location.id)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <Button onClick={handleCreate}>保存位置</Button>
                <Button variant="secondary" onClick={() => setCreating(false)}>
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => {
                setCreating(true);
                setParentId(value);
              }}
            >
              新建位置
            </Button>
          )
        ) : null}
      </Sheet>
    </>
  );
}
