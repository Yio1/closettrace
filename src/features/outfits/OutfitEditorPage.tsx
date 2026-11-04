import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Outfit, OutfitItem, Slot } from '../../domain/types';
import {
  OUTFIT_SLOT_ORDER,
  SLOT_LABELS,
  autoOutfitName,
  outfitCompleteness,
} from '../../domain/outfit';
import { listColors } from '../../db/repositories/dictionaries';
import { listItems } from '../../db/repositories/items';
import { getOutfit, listOutfitItems, saveOutfit, updateOutfit } from '../../db/repositories/outfits';
import { listScenes } from '../../db/repositories/scenes';
import { SlotPicker } from '../../components/outfit/SlotPicker';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { TextField } from '../../components/ui/TextField';

export function OutfitEditorPage() {
  const { id } = useParams();
  const data = useLiveQuery(async () => {
    if (!id) return { outfit: null, rows: [] as OutfitItem[] };
    const outfit = await getOutfit(id);
    if (!outfit) return null;
    return { outfit, rows: await listOutfitItems(id) };
  }, [id]);
  const navigate = useNavigate();

  if (data === undefined) return null;
  if (data === null) {
    return (
      <EmptyState
        title="找不到这套搭配"
        description="它可能已被删除。"
        action={<Button onClick={() => navigate('/outfits')}>返回搭配</Button>}
      />
    );
  }

  return <OutfitEditorForm key={id ?? 'new'} outfit={data.outfit} rows={data.rows} />;
}

function OutfitEditorForm({ outfit, rows }: { outfit: Outfit | null; rows: OutfitItem[] }) {
  const navigate = useNavigate();
  const items = useLiveQuery(() => listItems({ includeRetired: true }), []) ?? [];
  const colors = useLiveQuery(() => listColors(), []) ?? [];
  const scenes = useLiveQuery(() => listScenes(), []) ?? [];

  const [selections, setSelections] = useState<Partial<Record<Slot, string>>>(
    Object.fromEntries(rows.map((row) => [row.slot, row.itemId])) as Partial<Record<Slot, string>>,
  );
  const [sceneIds, setSceneIds] = useState<string[]>(outfit?.sceneIds ?? []);
  const [name, setName] = useState(outfit?.name ?? '');
  const [nameTouched, setNameTouched] = useState(Boolean(outfit));
  const [note, setNote] = useState(outfit?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedEntries = OUTFIT_SLOT_ORDER.flatMap((slot) => {
    const itemId = selections[slot];
    if (!itemId) return [];
    const item = items.find((entry) => entry.id === itemId);
    return item ? [{ item, slot }] : [];
  });
  const autoName = autoOutfitName(
    selectedEntries.map((entry) => entry.item),
    colors,
  );
  const effectiveName = nameTouched ? name : autoName;
  const activeScene = scenes.find((scene) => scene.id === sceneIds[0]) ?? scenes[0];
  const completeness = activeScene
    ? outfitCompleteness(
        selectedEntries.map((entry) => entry.slot),
        activeScene,
      )
    : null;
  const dressSelected = Boolean(selections.dress);

  function selectSlot(slot: Slot, itemId?: string) {
    setSelections((current) => {
      const next = { ...current };
      if (itemId) next[slot] = itemId;
      else delete next[slot];
      if (itemId && slot === 'dress') {
        delete next.top;
        delete next.bottom;
      }
      if (itemId && (slot === 'top' || slot === 'bottom')) delete next.dress;
      return next;
    });
  }

  function toggleScene(sceneId: string) {
    setSceneIds((current) =>
      current.includes(sceneId)
        ? current.filter((entry) => entry !== sceneId)
        : [...current, sceneId],
    );
  }

  async function handleSave() {
    if (saving) return;
    if (selectedEntries.length === 0) {
      setError('至少选择一件单品');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payloadItems = selectedEntries.map((entry, index) => ({
        itemId: entry.item.id,
        slot: entry.slot,
        order: index,
      }));
      const nextName = effectiveName.trim() || autoName || '未命名搭配';
      const trimmedNote = note.trim() || undefined;
      if (outfit) {
        await updateOutfit(outfit.id, { name: nextName, sceneIds, note: trimmedNote }, payloadItems);
        navigate(`/outfits/${outfit.id}`, { replace: true });
      } else {
        const newId = await saveOutfit({
          name: nextName,
          sceneIds,
          items: payloadItems,
          note: trimmedNote,
          source: 'manual',
        });
        navigate(`/outfits/${newId}`, { replace: true });
      }
    } catch {
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <button
        type="button"
        onClick={() => navigate('/outfits')}
        className="flex min-h-11 items-center gap-1 text-sm text-muted"
      >
        <ArrowLeft size={18} aria-hidden />
        返回搭配
      </button>

      <h1 className="text-2xl font-semibold tracking-tight">
        {outfit ? '编辑搭配' : '新建搭配'}
      </h1>

      <TextField
        label="搭配名称"
        value={effectiveName}
        onChange={(event) => {
          setName(event.target.value);
          setNameTouched(true);
        }}
        placeholder="留空自动命名"
      />

      <section>
        <h2 className="mb-2 text-sm font-medium">场景</h2>
        <div className="flex flex-wrap gap-2">
          {scenes.map((scene) => {
            const active = sceneIds.includes(scene.id);
            return (
              <button
                key={scene.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleScene(scene.id)}
                className={`min-h-9 rounded-full border px-3 text-sm ${
                  active ? 'border-accent bg-accent/10 text-accent-text' : 'border-line bg-surface'
                }`}
              >
                {scene.name}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">单品</h2>
        {dressSelected ? (
          <p className="mb-2 text-xs text-muted">连衣裙已替代上装和下装</p>
        ) : null}
        <div className="rounded-card border border-line bg-surface px-3">
          {OUTFIT_SLOT_ORDER.filter(
            (slot) => !(dressSelected && (slot === 'top' || slot === 'bottom')),
          ).map((slot) => (
            <SlotPicker
              key={slot}
              slot={slot}
              value={selections[slot]}
              sceneId={sceneIds[0]}
              onSelect={(itemId) => selectSlot(slot, itemId)}
            />
          ))}
        </div>
      </section>

      {completeness && activeScene ? (
        <Card className="text-sm">
          {completeness.complete ? (
            <p className="text-accent-text">
              完整度：可穿（{selectedEntries.map((entry) => SLOT_LABELS[entry.slot]).join(' + ')}）
            </p>
          ) : (
            <p>
              完整度：缺
              {completeness.missing.map((slot) => SLOT_LABELS[slot]).join('、')}
              <span className="text-muted">（按{activeScene.name}场景判断）</span>
            </p>
          )}
        </Card>
      ) : null}

      <TextField
        label="备注"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="可选"
      />

      {error ? <p className="text-sm text-danger-text">{error}</p> : null}

      <Button size="lg" className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? '保存中…' : '保存搭配'}
      </Button>
    </div>
  );
}
