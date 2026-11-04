import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Shirt } from 'lucide-react';
import type { ItemStatus } from '../../domain/types';
import { formatDateZh, todayISO } from '../../domain/date';
import { ITEM_STATUS_LABELS } from '../../domain/itemStatus';
import { PATTERN_OPTIONS, SEASON_OPTIONS } from '../../domain/itemForm';
import { formatCents, landedCents } from '../../domain/money';
import { cpw } from '../../domain/price';
import { locationPath } from '../../domain/locationTree';
import { listCategories } from '../../db/repositories/categories';
import { listColors } from '../../db/repositories/dictionaries';
import { listLocations } from '../../db/repositories/locations';
import { getItem, moveItems, purgeItem, restoreItem, retireItem, setItemsStatus } from '../../db/repositories/items';
import { listPhotos } from '../../db/repositories/photos';
import { listPurchases, purchaseTotalCents } from '../../db/repositories/purchases';
import { listOutfitsUsingItem } from '../../db/repositories/outfits';
import { logWear } from '../../db/repositories/wearLogs';
import { LocationPicker } from '../../components/item/LocationPicker';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { useObjectUrl } from '../../lib/useObjectUrl';

export function ItemDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const item = useLiveQuery(async () => (await getItem(id)) ?? null, [id]);
  const categories = useLiveQuery(() => listCategories(), []);
  const colors = useLiveQuery(() => listColors(), []);
  const locations = useLiveQuery(() => listLocations(), []);
  const photos = useLiveQuery(() => listPhotos(id), [id]);
  const purchases = useLiveQuery(() => listPurchases(id), [id]);
  const outfits = useLiveQuery(() => listOutfitsUsingItem(id), [id]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [wearOpen, setWearOpen] = useState(false);
  const [wearDate, setWearDate] = useState(todayISO());
  const [logging, setLogging] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const photoCount = photos?.length ?? 0;
  const activePhotoIndex = photoCount > 0 ? photoIndex % photoCount : 0;
  const currentPhoto = photos?.[activePhotoIndex];
  const photoUrl = useObjectUrl(currentPhoto?.blob);

  if (item === undefined) return null;
  if (item === null) {
    return (
      <EmptyState
        title="找不到这件衣物"
        description="它可能已被删除。"
        action={<Button onClick={() => navigate('/wardrobe')}>返回衣橱</Button>}
      />
    );
  }

  const category = categories?.find((entry) => entry.id === item.categoryId);
  const primaryColor = colors?.find((color) => color.id === item.colorPrimaryId);
  const purchaseTotal = purchaseTotalCents(purchases ?? []);
  const costPerWear = cpw(item.totalCostCents, item.wearCount);
  const seasonNames = item.seasons
    .map((season) => SEASON_OPTIONS.find((option) => option.value === season)?.label)
    .filter(Boolean)
    .join(' / ');
  const patternName = PATTERN_OPTIONS.find((option) => option.value === item.pattern)?.label;
  const isRetired = item.status === 'retired';

  async function toggleLaundry() {
    if (!item) return;
    const next: ItemStatus = item.status === 'laundry' ? 'available' : 'laundry';
    await setItemsStatus([item.id], next);
  }

  async function handleRetire() {
    if (!item) return;
    if (!window.confirm('移出衣橱？之后可在“已移出”中找回。')) return;
    await retireItem(item.id);
  }

  async function handleRestore() {
    if (!item) return;
    await restoreItem(item.id);
  }

  async function handlePurge() {
    if (!item) return;
    if (!window.confirm('彻底删除后不可恢复，照片和购买记录会一起删除。确定吗？')) return;
    await purgeItem(item.id);
    navigate('/wardrobe', { replace: true });
  }

  async function handleWear() {
    if (!item || logging) return;
    setLogging(true);
    try {
      await logWear({ date: wearDate, items: [item] });
      setWearOpen(false);
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <button
        type="button"
        onClick={() => navigate('/wardrobe')}
        className="flex min-h-11 items-center gap-1 text-sm text-muted"
      >
        <ArrowLeft size={18} aria-hidden />
        返回衣橱
      </button>

      <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-line bg-bg">
        {photoUrl ? (
          <img src={photoUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted"
            style={{ backgroundColor: primaryColor ? `${primaryColor.hex}33` : undefined }}
          >
            <span
              aria-hidden
              className="h-12 w-12 rounded-full border border-line"
              style={{ backgroundColor: primaryColor?.hex ?? '#cccccc' }}
            />
            {category?.name ?? '衣物'}
          </div>
        )}
        {photos && photos.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="上一张"
              onClick={() => setPhotoIndex((index) => (index - 1 + photos.length) % photos.length)}              className="absolute left-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white"
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="下一张"
              onClick={() => setPhotoIndex((index) => (index + 1) % photos.length)}
              className="absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white"
            >
              <ChevronRight size={20} aria-hidden />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">
              {activePhotoIndex + 1}/{photos.length}
            </span>
          </>
        ) : null}
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          {purchaseTotal > 0 ? (
            <span className="tabular shrink-0 text-lg font-medium">{formatCents(purchaseTotal)}</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          {[item.brand, item.size, item.material, item.createdAt.slice(0, 7)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <Card className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">状态</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs">
            {ITEM_STATUS_LABELS[item.status]}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">位置</span>
          <span className="flex min-w-0 items-center gap-1">
            <MapPin size={14} aria-hidden className="shrink-0 text-muted" />
            <span className="truncate">{locationPath(locations ?? [], item.locationId)}</span>
            {item.locationDetail ? (
              <span className="truncate text-muted">· {item.locationDetail}</span>
            ) : null}
          </span>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => setMoveOpen(true)}>
          移动
        </Button>
      </Card>

      <Card className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted">正式度</span>
          <span>{item.formality}/5</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">保暖</span>
          <span>{item.warmth}/5</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">季节</span>
          <span>{seasonNames || '未设置'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">图案</span>
          <span>{patternName ?? '未设置'}</span>
        </div>
        {item.sceneTags.length > 0 ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted">场景</span>
            <span>{item.sceneTags.length} 个标签</span>
          </div>
        ) : null}
        {item.note ? <p className="pt-1 text-muted">{item.note}</p> : null}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => setWearOpen(true)}>穿一次</Button>
        <Button variant="secondary" onClick={toggleLaundry}>
          {item.status === 'laundry' ? '标记已洗' : '加入待洗'}
        </Button>
        <Button variant="secondary" onClick={() => navigate(`/wardrobe/item/${item.id}/edit`)}>
          编辑
        </Button>
      </div>

      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">穿着与成本</h2>
        <p>
          穿着 {item.wearCount} 天
          {item.lastWornAt ? ` · 最近 ${formatDateZh(item.lastWornAt)}` : ' · 还没穿过'}
        </p>
        <p className="text-muted">
          {costPerWear == null
            ? '单次成本：暂无（先记录穿着）'
            : `单次成本 ${formatCents(costPerWear)}（购买 ${formatCents(item.totalCostCents)}）`}
        </p>
        {purchases && purchases.length > 0 ? (
          <div className="space-y-1 border-t border-line pt-2">
            <p className="text-muted">购买记录</p>
            {purchases.map((purchase) => (
              <p key={purchase.id} className="flex justify-between gap-3">
                <span>
                  {purchase.channel || '未填写渠道'} · {purchase.purchasedAt}
                </span>
                <span className="tabular">
                  {formatCents(
                    landedCents(
                      purchase.priceCents,
                      purchase.shippingCents,
                      purchase.discountCents,
                    ),
                  )}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </Card>

      {outfits && outfits.length > 0 ? (
        <Card className="space-y-2 text-sm">
          <h2 className="text-base font-semibold">使用此单品的搭配 {outfits.length} 套</h2>
          <ul className="space-y-1">
            {outfits.map((outfit) => (
              <li key={outfit.id}>
                <Link
                  to={`/outfits/${outfit.id}`}
                  className="flex min-h-11 items-center gap-2 text-accent-text"
                >
                  <Shirt size={16} aria-hidden />
                  {outfit.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-2 border-danger/40">
        <h2 className="text-base font-semibold">危险操作</h2>
        {isRetired ? (
          <Button variant="secondary" className="w-full" onClick={handleRestore}>
            恢复到衣橱
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" onClick={handleRetire}>
            移出衣橱
          </Button>
        )}
        <Button variant="danger" className="w-full" onClick={handlePurge}>
          彻底删除
        </Button>
      </Card>

      <Sheet open={moveOpen} onClose={() => setMoveOpen(false)} title="移动存放位置">
        <LocationPicker
          allowCreate
          value={item.locationId}
          onChange={async (locationId) => {
            await moveItems([item.id], locationId);
            setMoveOpen(false);
          }}
        />
      </Sheet>

      <Sheet open={wearOpen} onClose={() => setWearOpen(false)} title="记录一次穿着">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">穿着日期</span>
          <input
            type="date"
            aria-label="穿着日期"
            value={wearDate}
            onChange={(event) => setWearDate(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-field-line bg-surface px-3 text-base"
          />
        </label>
        <Button className="mt-4 w-full" onClick={handleWear} disabled={logging}>
          {logging ? '记录中…' : '记录'}
        </Button>
      </Sheet>
    </div>
  );
}
