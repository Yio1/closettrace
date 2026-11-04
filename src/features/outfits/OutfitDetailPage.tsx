import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Heart, Pencil, Trash2 } from 'lucide-react';
import { formatDateZh, todayISO } from '../../domain/date';
import { ITEM_STATUS_LABELS } from '../../domain/itemStatus';
import { SLOT_LABELS } from '../../domain/outfit';
import { formatCents } from '../../domain/money';
import { cpw } from '../../domain/price';
import { listItems } from '../../db/repositories/items';
import {
  deleteOutfit,
  getOutfit,
  listOutfitItems,
  saveOutfit,
  toggleOutfitFavorite,
} from '../../db/repositories/outfits';
import { listScenes } from '../../db/repositories/scenes';
import { logWear } from '../../db/repositories/wearLogs';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';

export function OutfitDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const outfit = useLiveQuery(async () => (await getOutfit(id)) ?? null, [id]);
  const rows = useLiveQuery(() => listOutfitItems(id), [id]);
  const items = useLiveQuery(() => listItems({ includeRetired: true }), []) ?? [];
  const scenes = useLiveQuery(() => listScenes(true), []) ?? [];
  const [wearing, setWearing] = useState(false);
  const [logged, setLogged] = useState(false);

  if (outfit === null) {
    return (
      <EmptyState
        title="找不到这套搭配"
        description="它可能已被删除。"
        action={<Button onClick={() => navigate('/outfits')}>返回搭配</Button>}
      />
    );
  }
  if (outfit === undefined || rows === undefined) return null;
  const rowList = rows;

  const itemById = new Map(items.map((item) => [item.id, item]));
  const entries = rowList.flatMap((row) => {
    const item = itemById.get(row.itemId);
    return item ? [{ item, slot: row.slot }] : [];
  });  const totalCost = entries.reduce((sum, entry) => sum + entry.item.totalCostCents, 0);
  const costPerWear = cpw(totalCost, outfit.wearCount);
  const sceneNames = outfit.sceneIds
    .map((sceneId) => scenes.find((scene) => scene.id === sceneId)?.name)
    .filter((name): name is string => Boolean(name));
  const hasUnavailable = entries.some((entry) => entry.item.status !== 'available');

  async function handleWear() {
    if (!outfit || wearing || entries.length === 0) return;
    setWearing(true);
    try {
      await logWear({
        date: todayISO(),
        outfitId: outfit.id,
        sceneId: outfit.sceneIds[0],
        items: entries.map((entry) => entry.item),
      });
      setLogged(true);
    } finally {
      setWearing(false);
    }
  }

  async function handleFavorite() {
    if (!outfit) return;
    await toggleOutfitFavorite(outfit.id);
  }

  async function handleCopy() {
    if (!outfit) return;
    const newId = await saveOutfit({
      name: `${outfit.name} 副本`,
      sceneIds: outfit.sceneIds,
      items: rowList.map((row) => ({ itemId: row.itemId, slot: row.slot, order: row.order })),
      note: outfit.note,
      source: 'manual',
    });
    navigate(`/outfits/${newId}`);
  }

  async function handleDelete() {
    if (!outfit) return;
    if (!window.confirm('删除这套搭配？穿着历史会保留。')) return;
    await deleteOutfit(outfit.id);
    navigate('/outfits', { replace: true });
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

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{outfit.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {sceneNames.length > 0 ? sceneNames.join(' · ') : '未设场景'}
        </p>
        {outfit.note ? <p className="mt-2 text-sm text-muted">{outfit.note}</p> : null}
      </div>

      <Card className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted">穿着</span>
          <span>{`穿过 ${outfit.wearCount} 次${
            outfit.lastWornAt ? ` · 最近 ${formatDateZh(outfit.lastWornAt)}` : ''
          }`}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">总成本</span>
          <span className="tabular">{formatCents(totalCost)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">搭配单次成本</span>
          <span className="tabular">
            {costPerWear == null ? '暂无（先记录穿着）' : formatCents(costPerWear)}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleWear} disabled={wearing || entries.length === 0}>
          {wearing ? '记录中…' : '穿这套'}
        </Button>
        <Button variant="secondary" onClick={() => navigate(`/outfits/${outfit.id}/edit`)}>
          <Pencil size={16} aria-hidden />
          编辑
        </Button>
        <Button variant="secondary" onClick={handleFavorite}>
          <Heart size={16} aria-hidden />
          {outfit.isFavorite ? '取消收藏' : '收藏'}
        </Button>
        <Button variant="secondary" onClick={handleCopy}>
          <Copy size={16} aria-hidden />
          复制
        </Button>
      </div>
      {logged ? <p className="text-sm text-accent-text">已记录今天的穿着。</p> : null}

      <Card className="text-sm">
        <h2 className="mb-2 text-base font-semibold">单品</h2>
        {entries.length === 0 ? (
          <p className="text-muted">这套搭配还没有单品。</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map(({ item, slot }) => (
              <li key={item.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-14 shrink-0 text-xs text-muted">{SLOT_LABELS[slot]}</span>
                  <span className="truncate">{item.name}</span>
                </span>
                {item.status !== 'available' ? (
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                    {ITEM_STATUS_LABELS[item.status]}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {hasUnavailable ? (
          <p className="mt-2 text-xs text-muted">
            含待洗、收纳或已移出单品，推荐时会排除这套。
          </p>
        ) : null}
      </Card>

      <Card className="space-y-2 border-danger/40">
        <h2 className="text-base font-semibold">危险操作</h2>
        <Button variant="danger" className="w-full" onClick={handleDelete}>
          <Trash2 size={16} aria-hidden />
          删除搭配
        </Button>
      </Card>
    </div>
  );
}
