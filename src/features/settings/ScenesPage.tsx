import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Scene, Slot, StyleTag } from '../../domain/types';
import { OUTFIT_SLOT_ORDER, SLOT_LABELS } from '../../domain/outfit';
import { listStyleTags } from '../../db/repositories/dictionaries';
import {
  archiveScene,
  createScene,
  listScenes,
  updateScene,
  type NewSceneInput,
} from '../../db/repositories/scenes';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { NumberField } from '../../components/ui/NumberField';
import { PageHeader } from '../../components/ui/PageHeader';
import { Sheet } from '../../components/ui/Sheet';
import { TextField } from '../../components/ui/TextField';

export function ScenesPage() {
  const scenes = useLiveQuery(() => listScenes(true), []);
  const styleTags = useLiveQuery(() => listStyleTags(), []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Scene | null>(null);

  if (!scenes || !styleTags) return null;

  const builtIn = scenes.filter((scene) => scene.isBuiltIn);
  const custom = scenes.filter((scene) => !scene.isBuiltIn && !scene.archived);

  return (
    <div className="space-y-4">
      <PageHeader
        title="场景管理"
        subtitle="内置场景只读，自定义场景可编辑"
        action={
          <Button variant="secondary" onClick={() => setCreating(true)}>
            新建场景
          </Button>
        }
      />

      <section>
        <h2 className="mb-2 text-sm font-medium">内置场景</h2>
        <ul className="space-y-2">
          {builtIn.map((scene) => (
            <li key={scene.id}>
              <Card>
                <p className="text-sm font-medium">{scene.name}</p>
                <p className="mt-1 text-xs text-muted">{sceneSummary(scene)}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">自定义场景</h2>
        {custom.length === 0 ? (
          <p className="text-sm text-muted">还没有自定义场景。</p>
        ) : (
          <ul className="space-y-2">
            {custom.map((scene) => (
              <li key={scene.id}>
                <Card className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{scene.name}</p>
                    <p className="mt-1 text-xs text-muted">{sceneSummary(scene)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      aria-label={`编辑 ${scene.name}`}
                      onClick={() => setEditing(scene)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`归档 ${scene.name}`}
                      onClick={() => void archiveScene(scene.id)}
                    >
                      归档
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating ? (
        <SceneFormSheet
          key="new"
          title="新建场景"
          styleTags={styleTags}
          onClose={() => setCreating(false)}
          onSave={(input) => createScene(input)}
        />
      ) : null}

      {editing ? (
        <SceneFormSheet
          key={editing.id}
          title="编辑场景"
          styleTags={styleTags}
          scene={editing}
          onClose={() => setEditing(null)}
          onSave={(input) => updateScene(editing.id, input)}
        />
      ) : null}
    </div>
  );
}

function sceneSummary(scene: Scene): string {
  const slots = scene.requiredSlots.map((slot) => SLOT_LABELS[slot]).join('、');
  return `正式度 ${scene.formalityMin}–${scene.formalityMax} · 需要${slots}`;
}

function SceneFormSheet({
  title,
  scene,
  styleTags,
  onClose,
  onSave,
}: {
  title: string;
  scene?: Scene;
  styleTags: StyleTag[];
  onClose: () => void;
  onSave: (input: NewSceneInput) => Promise<string | void>;
}) {
  const [name, setName] = useState(scene?.name ?? '');
  const [formalityMin, setFormalityMin] = useState(scene?.formalityMin ?? 2);
  const [formalityMax, setFormalityMax] = useState(scene?.formalityMax ?? 3);
  const [requiredSlots, setRequiredSlots] = useState<Slot[]>(
    scene?.requiredSlots ?? ['top', 'bottom', 'shoes'],
  );
  const [optionalSlots, setOptionalSlots] = useState<Slot[]>(
    scene?.optionalSlots ?? ['outer'],
  );
  const [tags, setTags] = useState<string[]>(scene?.styleTags ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleSlot(list: Slot[], slot: Slot): Slot[] {
    return list.includes(slot) ? list.filter((entry) => entry !== slot) : [...list, slot];
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('请填写场景名称');
      return;
    }
    if (formalityMin > formalityMax) {
      setError('正式度下限不能高于上限');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name,
        formalityMin,
        formalityMax,
        requiredSlots,
        optionalSlots,
        styleTags: tags,
      });
      onClose();
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="space-y-3">
        <TextField label="名称" value={name} onChange={(event) => setName(event.target.value)} />
        <NumberField
          label="正式度下限"
          value={formalityMin}
          min={1}
          max={5}
          onChange={setFormalityMin}
        />
        <NumberField
          label="正式度上限"
          value={formalityMax}
          min={1}
          max={5}
          onChange={setFormalityMax}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium">必需单品</legend>
          <div className="flex flex-wrap gap-2">
            {OUTFIT_SLOT_ORDER.map((slot) => (
              <SlotChip
                key={slot}
                slot={slot}
                active={requiredSlots.includes(slot)}
                ariaLabel={`必选 ${SLOT_LABELS[slot]}`}
                onToggle={() => setRequiredSlots((current) => toggleSlot(current, slot))}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">可选单品</legend>
          <div className="flex flex-wrap gap-2">
            {OUTFIT_SLOT_ORDER.map((slot) => (
              <SlotChip
                key={slot}
                slot={slot}
                active={optionalSlots.includes(slot)}
                ariaLabel={`可选 ${SLOT_LABELS[slot]}`}
                onToggle={() => setOptionalSlots((current) => toggleSlot(current, slot))}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">风格标签</legend>
          <div className="flex flex-wrap gap-2">
            {styleTags.map((tag) => {
              const active = tags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setTags((current) =>
                      current.includes(tag.id)
                        ? current.filter((entry) => entry !== tag.id)
                        : [...current, tag.id],
                    )
                  }
                  className={`min-h-9 rounded-full border px-3 text-sm ${
                    active
                      ? 'border-accent bg-accent/10 text-accent-text'
                      : 'border-line bg-surface text-muted'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </fieldset>

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

function SlotChip({
  slot,
  active,
  ariaLabel,
  onToggle,
}: {
  slot: Slot;
  active: boolean;
  ariaLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={`min-h-9 rounded-full border px-3 text-sm ${
        active
          ? 'border-accent bg-accent/10 text-accent-text'
          : 'border-line bg-surface text-muted'
      }`}
    >
      {SLOT_LABELS[slot]}
    </button>
  );
}
