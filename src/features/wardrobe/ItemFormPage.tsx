import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ItemPhoto, Season } from '../../domain/types';
import {
  autoItemName,
  emptyFormState,
  formStateFromItem,
  itemFormDraftKey,
  itemInputFromForm,
  PATTERN_OPTIONS,
  SEASON_OPTIONS,
  STATUS_OPTIONS,
  validateItemInput,
  type ItemFormErrors,
  type ItemFormState,
} from '../../domain/itemForm';
import { todayISO } from '../../domain/date';
import { listCategories } from '../../db/repositories/categories';
import { listColors, listStyleTags } from '../../db/repositories/dictionaries';
import { listScenes } from '../../db/repositories/scenes';
import { createItem, getItem, updateItem } from '../../db/repositories/items';
import {
  addPhoto,
  listPhotos,
  removePhoto,
  savePhoto,
  setCover,
} from '../../db/repositories/photos';
import { addPurchase, listPurchases, updatePurchase } from '../../db/repositories/purchases';
import { convertWishlistToPurchase, getWishlist, listQuotes } from '../../db/repositories/wishlist';
import { db } from '../../db/schema';
import { compressImage } from '../../lib/image';
import { CategoryPicker } from '../../components/item/CategoryPicker';
import { ColorSwatchPicker } from '../../components/item/ColorSwatchPicker';
import { LocationPicker } from '../../components/item/LocationPicker';
import { PhotoPicker } from '../../components/item/PhotoPicker';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { MoneyField } from '../../components/ui/MoneyField';
import { NumberField } from '../../components/ui/NumberField';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';

const MAX_PHOTOS = 5;

export function ItemFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wishlistId = id ? undefined : (searchParams.get('wishlistId') ?? undefined);
  const quoteId = id ? undefined : (searchParams.get('quoteId') ?? undefined);
  const draftKey = itemFormDraftKey(id);
  const [form, setForm] = useState<ItemFormState | null>(null);
  const [errors, setErrors] = useState<ItemFormErrors>({});
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);
  const [coverId, setCoverId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [missing, setMissing] = useState(false);

  const categories = useLiveQuery(() => listCategories(), []);
  const colors = useLiveQuery(() => listColors(), []);
  const scenes = useLiveQuery(() => listScenes(), []);
  const styleTags = useLiveQuery(() => listStyleTags(), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        try {
          const draft = JSON.parse(raw) as ItemFormState;
          if (!cancelled) setForm(draft);
          return;
        } catch {
          sessionStorage.removeItem(draftKey);
        }
      }
      if (!id) {
        if (!wishlistId) {
          if (!cancelled) setForm(emptyFormState(todayISO()));
          return;
        }
        const [wishlist, categoryRows] = await Promise.all([
          getWishlist(wishlistId),
          listCategories(),
        ]);
        if (cancelled) return;
        if (!wishlist) {
          setForm(emptyFormState(todayISO()));
          return;
        }
        const quote = quoteId
          ? (await listQuotes(wishlistId)).find((entry) => entry.id === quoteId)
          : undefined;
        if (cancelled) return;
        const category = categoryRows.find((entry) => entry.id === wishlist.categoryId);
        setForm({
          ...emptyFormState(todayISO(), category),
          name: wishlist.name,
          brand: wishlist.brand ?? '',
          categoryId: wishlist.categoryId,
          size: wishlist.size ?? '',
          purchaseChannel: quote?.channel ?? '',
          purchasePriceCents: quote?.priceCents ?? 0,
          purchaseShippingCents: quote?.shippingCents ?? 0,
          purchaseDiscountCents: quote?.discountCents ?? 0,
        });
        return;
      }
      const item = await getItem(id);
      if (!item) {
        if (!cancelled) setMissing(true);
        return;
      }
      const [purchases, savedPhotos] = await Promise.all([listPurchases(id), listPhotos(id)]);
      if (cancelled) return;
      setForm(formStateFromItem(item, purchases[0]));
      setPhotos(savedPhotos);
      setCoverId(item.coverPhotoId);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftKey, id, wishlistId, quoteId]);

  useEffect(() => {
    if (!form) return;
    sessionStorage.setItem(draftKey, JSON.stringify(form));
  }, [draftKey, form]);

  function update(patch: Partial<ItemFormState>) {
    setForm((previous) => (previous ? { ...previous, ...patch } : previous));
    setSaveError('');
  }

  function colorName(colorId: string): string {
    return colors?.find((color) => color.id === colorId)?.name ?? '';
  }

  function handleCategoryChange(categoryId: string) {
    const category = categories?.find((entry) => entry.id === categoryId);
    if (!category) return;
    setForm((previous) => {
      if (!previous) return previous;
      const previousCategory = categories?.find((entry) => entry.id === previous.categoryId);
      const previousAuto = previousCategory
        ? autoItemName(colorName(previous.colorPrimaryId), previousCategory.name)
        : '';
      const untouched = !previous.name.trim() || previous.name === previousAuto;
      const applyDefaults = !id || !previous.categoryId;
      return {
        ...previous,
        categoryId,
        name: untouched
          ? autoItemName(colorName(previous.colorPrimaryId), category.name)
          : previous.name,
        formality: applyDefaults ? category.defaultFormality : previous.formality,
        warmth: applyDefaults ? category.defaultWarmth : previous.warmth,
        seasons: applyDefaults ? category.defaultSeasons : previous.seasons,
      };
    });
    setErrors((previous) => ({ ...previous, categoryId: undefined }));
  }

  function handlePrimaryColorChange(colorId?: string) {
    if (!colorId) return;
    setForm((previous) => {
      if (!previous) return previous;
      const category = categories?.find((entry) => entry.id === previous.categoryId);
      const previousAuto = category
        ? autoItemName(colorName(previous.colorPrimaryId), category.name)
        : '';
      const untouched = !previous.name.trim() || previous.name === previousAuto;
      return {
        ...previous,
        colorPrimaryId: colorId,
        name:
          untouched && category
            ? autoItemName(colorName(colorId), category.name)
            : previous.name,
      };
    });
    setErrors((previous) => ({ ...previous, colorPrimaryId: undefined }));
  }

  function toggleSeason(season: Season) {
    setForm((previous) => {
      if (!previous) return previous;
      if (season === 'all') return { ...previous, seasons: ['all'] };
      const withoutAll = previous.seasons.filter((value) => value !== 'all');
      const next = withoutAll.includes(season)
        ? withoutAll.filter((value) => value !== season)
        : [...withoutAll, season];
      return { ...previous, seasons: next.length > 0 ? next : ['all'] };
    });
    setErrors((previous) => ({ ...previous, seasons: undefined }));
  }

  function toggleTag(field: 'sceneTags' | 'styleTags', tagId: string) {
    setForm((previous) => {
      if (!previous) return previous;
      const current = previous[field];
      const next = current.includes(tagId)
        ? current.filter((value) => value !== tagId)
        : [...current, tagId];
      return { ...previous, [field]: next };
    });
  }

  async function handleAddPhoto(file: File) {
    if (photos.length >= MAX_PHOTOS) return;
    if (id) {
      const saved = await addPhoto(id, file);
      setPhotos(await listPhotos(id));
      setCoverId((current) => current ?? saved.id);
      return;
    }
    const compressed = await compressImage(file);
    const temp: ItemPhoto = {
      id: `draft:${crypto.randomUUID()}`,
      itemId: '',
      blob: compressed.blob,
      thumbBlob: compressed.thumbBlob,
      width: compressed.width,
      height: compressed.height,
      bytes: compressed.bytes,
      order: photos.length,
      createdAt: new Date().toISOString(),
    };
    setPhotos((previous) => [...previous, temp]);
    setCoverId((current) => current ?? temp.id);
  }

  async function handleRemovePhoto(photoId: string) {
    if (id) await removePhoto(photoId);
    setPhotos((previous) => {
      const next = previous.filter((photo) => photo.id !== photoId);
      setCoverId((current) => (current === photoId ? next[0]?.id : current));
      return next;
    });
  }

  async function handleSetCover(photoId: string) {
    if (id) await setCover(id, photoId);
    setCoverId(photoId);
  }

  async function handleSave() {
    if (!form || saving) return;
    const input = itemInputFromForm(form);
    const result = validateItemInput(input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    setSaveError('');
    try {
      const wantsPurchase =
        form.purchasePriceCents > 0 || form.purchaseChannel.trim().length > 0;
      const purchaseInput = {
        channel: form.purchaseChannel.trim(),
        priceCents: form.purchasePriceCents,
        shippingCents: form.purchaseShippingCents,
        discountCents: form.purchaseDiscountCents,
        purchasedAt: form.purchasedAt,
      };

      if (id) {
        await db.transaction(
          'rw',
          [db.items, db.itemPhotos, db.purchases, db.wearLogs],
          async () => {
            await updateItem(id, input);
            if (wantsPurchase) {
              const purchases = await listPurchases(id);
              const existing = purchases[0];
              if (existing) await updatePurchase(existing.id, { itemId: id, ...purchaseInput });
              else await addPurchase({ itemId: id, ...purchaseInput });
            }
          },
        );
        sessionStorage.removeItem(draftKey);
        navigate(`/wardrobe/item/${id}`, { replace: true });
        return;
      }

      let newId = '';
      await db.transaction(
        'rw',
        [db.items, db.itemPhotos, db.purchases, db.wearLogs],
        async () => {
          newId = await createItem(input);
          let firstSavedId = '';
          let coverAfterSave: string | undefined;
          for (const photo of photos) {
            const saved = await savePhoto(newId, {
              blob: photo.blob,
              thumbBlob: photo.thumbBlob,
              width: photo.width,
              height: photo.height,
              bytes: photo.bytes,
            });
            if (!firstSavedId) firstSavedId = saved.id;
            if (photo.id === coverId) coverAfterSave = saved.id;
          }
          if (coverAfterSave && coverAfterSave !== firstSavedId) {
            await setCover(newId, coverAfterSave);
          }
          if (wantsPurchase && !wishlistId) {
            await addPurchase({ itemId: newId, ...purchaseInput });
          }
        },
      );
      if (wishlistId) {
        await convertWishlistToPurchase(wishlistId, quoteId, newId, purchaseInput);
      }
      sessionStorage.removeItem(draftKey);
      navigate(`/wardrobe/item/${newId}`, { replace: true });
    } catch {
      setSaveError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  if (missing) {
    return (
      <EmptyState
        title="找不到这件衣物"
        description="它可能已被删除。"
        action={<Button onClick={() => navigate('/wardrobe')}>返回衣橱</Button>}
      />
    );
  }

  if (!form) return null;

  return (
    <div className="pb-32">
      <button
        type="button"
        onClick={() => navigate('/wardrobe')}
        className="mb-2 flex min-h-11 items-center gap-1 text-sm text-muted"
      >
        <ArrowLeft size={18} aria-hidden />
        返回衣橱
      </button>

      <PageHeader title={id ? '编辑衣物' : '添加衣物'} subtitle="带 * 的为必填" />

      <div className="space-y-4">
        <Card className="space-y-4">
          <h2 className="text-base font-semibold">基本信息</h2>
          <PhotoPicker
            photos={photos}
            coverPhotoId={coverId}
            max={MAX_PHOTOS}
            onAdd={handleAddPhoto}
            onRemove={handleRemovePhoto}
            onSetCover={handleSetCover}
          />
          <TextField
            label="名称 *"
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
            error={errors.name}
            placeholder="例如：白色衬衫"
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium">类型 *</span>
            <CategoryPicker value={form.categoryId} onChange={handleCategoryChange} />
            {errors.categoryId ? (
              <span className="mt-1 block text-xs text-danger-text">{errors.categoryId}</span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="品牌"
              value={form.brand}
              onChange={(event) => update({ brand: event.target.value })}
              placeholder="可选"
            />
            <TextField
              label="尺码"
              value={form.size}
              onChange={(event) => update({ size: event.target.value })}
              placeholder="例如 M"
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-base font-semibold">外观</h2>
          <div>
            <ColorSwatchPicker value={form.colorPrimaryId} onChange={handlePrimaryColorChange} />
            {errors.colorPrimaryId ? (
              <span className="mt-1 block text-xs text-danger-text">{errors.colorPrimaryId}</span>
            ) : null}
          </div>
          <ColorSwatchPicker
            label="辅色"
            allowNone
            value={form.colorSecondaryId || undefined}
            onChange={(colorId) => update({ colorSecondaryId: colorId ?? '' })}
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">图案</span>
            <select
              aria-label="图案"
              value={form.pattern}
              onChange={(event) =>
                update({ pattern: event.target.value as ItemFormState['pattern'] })
              }
              className="min-h-11 w-full rounded-xl border border-field-line bg-surface px-3 text-base"
            >
              {PATTERN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="材质"
            value={form.material}
            onChange={(event) => update({ material: event.target.value })}
            placeholder="例如：棉"
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-base font-semibold">属性</h2>
          <NumberField
            label="保暖"
            value={form.warmth}
            min={1}
            max={5}
            step={0.5}
            suffix="/5"
            onChange={(value) => update({ warmth: value })}
          />
          {errors.warmth ? (
            <span className="-mt-2 block text-xs text-danger-text">{errors.warmth}</span>
          ) : null}
          <NumberField
            label="正式度"
            value={form.formality}
            min={1}
            max={5}
            step={1}
            suffix="/5"
            onChange={(value) => update({ formality: value })}
          />
          {errors.formality ? (
            <span className="-mt-2 block text-xs text-danger-text">{errors.formality}</span>
          ) : null}

          <div>
            <span className="mb-1.5 block text-sm font-medium">季节 *</span>
            <div className="flex flex-wrap gap-2">
              {SEASON_OPTIONS.map((option) => {
                const active = form.seasons.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSeason(option.value)}
                    className={`min-h-9 rounded-full border px-3 text-sm ${
                      active
                        ? 'border-accent bg-accent/10 text-accent-text'
                        : 'border-line bg-surface'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {errors.seasons ? (
              <span className="mt-1 block text-xs text-danger-text">{errors.seasons}</span>
            ) : null}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium">场景标签</span>
            <div className="flex flex-wrap gap-2">
              {scenes?.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  aria-pressed={form.sceneTags.includes(scene.id)}
                  onClick={() => toggleTag('sceneTags', scene.id)}
                  className={`min-h-9 rounded-full border px-3 text-sm ${
                    form.sceneTags.includes(scene.id)
                      ? 'border-accent bg-accent/10 text-accent-text'
                      : 'border-line bg-surface'
                  }`}
                >
                  {scene.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium">风格标签</span>
            <div className="flex flex-wrap gap-2">
              {styleTags?.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={form.styleTags.includes(tag.id)}
                  onClick={() => toggleTag('styleTags', tag.id)}
                  className={`min-h-9 rounded-full border px-3 text-sm ${
                    form.styleTags.includes(tag.id)
                      ? 'border-accent bg-accent/10 text-accent-text'
                      : 'border-line bg-surface'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-base font-semibold">位置与购买</h2>
          <LocationPicker
            allowCreate
            value={form.locationId}
            onChange={(locationId) => update({ locationId })}
          />
          <TextField
            label="位置细节"
            value={form.locationDetail}
            onChange={(event) => update({ locationDetail: event.target.value })}
            placeholder="例如：左数第三格"
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium">状态</span>
            <SegmentedControl
              ariaLabel="衣物状态"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(status) => update({ status })}
            />
          </div>
          <MoneyField
            label="购买价格"
            valueCents={form.purchasePriceCents}
            onChange={(cents) => update({ purchasePriceCents: cents })}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="购买渠道"
              value={form.purchaseChannel}
              onChange={(event) => update({ purchaseChannel: event.target.value })}
              placeholder="例如：淘宝"
            />
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">购买日期</span>
              <input
                type="date"
                aria-label="购买日期"
                value={form.purchasedAt}
                onChange={(event) => update({ purchasedAt: event.target.value })}
                className="min-h-11 w-full rounded-xl border border-field-line bg-surface px-3 text-base"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">备注</span>
            <textarea
              aria-label="备注"
              value={form.note}
              onChange={(event) => update({ note: event.target.value })}
              rows={3}
              className="w-full rounded-xl border border-field-line bg-surface px-3 py-2 text-base"
            />
          </label>
        </Card>
      </div>

      {saveError ? (
        <p role="alert" className="mt-3 text-sm text-danger-text">
          {saveError}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-30 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-lg gap-2 px-4 py-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/wardrobe')}>
            取消
          </Button>
          <Button className="flex-[2]" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}
