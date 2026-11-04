import type {
  Category,
  ISODate,
  Item,
  ItemStatus,
  NewItemInput,
  Pattern,
  Purchase,
  Season,
} from './types';

export const DEFAULT_COLOR_ID = 'builtin:color:white';

export const SEASON_OPTIONS: Array<{ value: Season; label: string }> = [
  { value: 'spring', label: '春' },
  { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' },
  { value: 'winter', label: '冬' },
  { value: 'all', label: '四季' },
];

export const PATTERN_OPTIONS: Array<{ value: Pattern; label: string }> = [
  { value: 'solid', label: '纯色' },
  { value: 'stripe', label: '条纹' },
  { value: 'check', label: '格纹' },
  { value: 'floral', label: '花卉' },
  { value: 'print', label: '印花' },
  { value: 'denim', label: '牛仔' },
  { value: 'other', label: '其他' },
];

export const STATUS_OPTIONS: Array<{ value: ItemStatus; label: string }> = [
  { value: 'available', label: '在穿' },
  { value: 'laundry', label: '待洗' },
  { value: 'repair', label: '维修' },
  { value: 'stored', label: '收纳' },
  { value: 'retired', label: '已移出' },
];

export function autoItemName(colorName: string, categoryName: string): string {
  const color = colorName.trim();
  const category = categoryName.trim();
  if (!category) return color;
  if (!color) return category;
  return /^[A-Za-z]/.test(category) ? `${color} ${category}` : `${color}${category}`;
}

export function defaultItemInput(category?: Category): NewItemInput {
  return {
    name: '',
    categoryId: category?.id ?? '',
    colorPrimaryId: DEFAULT_COLOR_ID,
    warmth: category?.defaultWarmth ?? 3,
    formality: category?.defaultFormality ?? 3,
    seasons: category?.defaultSeasons ?? ['all'],
    pattern: 'solid',
    status: 'available',
    sceneTags: [],
    styleTags: [],
  };
}

export interface ItemFormErrors {
  name?: string;
  categoryId?: string;
  colorPrimaryId?: string;
  seasons?: string;
  warmth?: string;
  formality?: string;
}

export function validateItemInput(
  input: NewItemInput,
): { ok: true } | { ok: false; errors: ItemFormErrors } {
  const errors: ItemFormErrors = {};
  if (!input.name.trim()) errors.name = '请输入名称';
  if (!input.categoryId) errors.categoryId = '请选择类型';
  if (!input.colorPrimaryId) errors.colorPrimaryId = '请选择主色';
  if (input.seasons.length === 0) errors.seasons = '至少选择一个季节';
  if (input.warmth < 1 || input.warmth > 5) errors.warmth = '保暖值范围 1–5';
  if (input.formality < 1 || input.formality > 5) errors.formality = '正式度范围 1–5';
  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}

export interface ItemFormState {
  name: string;
  categoryId: string;
  brand: string;
  size: string;
  colorPrimaryId: string;
  colorSecondaryId: string;
  pattern: Pattern;
  material: string;
  warmth: number;
  formality: number;
  seasons: Season[];
  sceneTags: string[];
  styleTags: string[];
  locationId?: string;
  locationDetail: string;
  status: ItemStatus;
  note: string;
  isFavorite: boolean;
  avoidRecommend: boolean;
  purchasePriceCents: number;
  purchaseShippingCents: number;
  purchaseDiscountCents: number;
  purchaseChannel: string;
  purchasedAt: ISODate;
}

export function emptyFormState(today: ISODate, category?: Category): ItemFormState {
  const base = defaultItemInput(category);
  return {
    ...base,
    pattern: base.pattern ?? 'solid',
    status: base.status ?? 'available',
    sceneTags: base.sceneTags ?? [],
    styleTags: base.styleTags ?? [],
    brand: '',
    size: '',
    colorSecondaryId: '',
    material: '',
    locationDetail: '',
    note: '',
    isFavorite: false,
    avoidRecommend: false,
    purchasePriceCents: 0,
    purchaseShippingCents: 0,
    purchaseDiscountCents: 0,
    purchaseChannel: '',
    purchasedAt: today,
  };
}

export function formStateFromItem(item: Item, purchase?: Purchase): ItemFormState {
  return {
    name: item.name,
    categoryId: item.categoryId,
    brand: item.brand ?? '',
    size: item.size ?? '',
    colorPrimaryId: item.colorPrimaryId,
    colorSecondaryId: item.colorSecondaryId ?? '',
    pattern: item.pattern,
    material: item.material ?? '',
    warmth: item.warmth,
    formality: item.formality,
    seasons: item.seasons,
    sceneTags: item.sceneTags,
    styleTags: item.styleTags,
    locationId: item.locationId,
    locationDetail: item.locationDetail ?? '',
    status: item.status,
    note: item.note ?? '',
    isFavorite: item.isFavorite,
    avoidRecommend: item.avoidRecommend,
    purchasePriceCents: purchase?.priceCents ?? 0,
    purchaseShippingCents: purchase?.shippingCents ?? 0,
    purchaseDiscountCents: purchase?.discountCents ?? 0,
    purchaseChannel: purchase?.channel ?? '',
    purchasedAt: purchase?.purchasedAt ?? todayISO(),
  };
}

export function itemInputFromForm(form: ItemFormState): NewItemInput {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    name: form.name.trim(),
    categoryId: form.categoryId,
    brand: optional(form.brand),
    size: optional(form.size),
    colorPrimaryId: form.colorPrimaryId,
    colorSecondaryId: form.colorSecondaryId || undefined,
    pattern: form.pattern,
    material: optional(form.material),
    warmth: form.warmth,
    formality: form.formality,
    seasons: form.seasons,
    sceneTags: form.sceneTags,
    styleTags: form.styleTags,
    locationId: form.locationId,
    locationDetail: optional(form.locationDetail),
    status: form.status,
    note: optional(form.note),
    isFavorite: form.isFavorite,
    avoidRecommend: form.avoidRecommend,
  };
}

export function itemFormDraftKey(id?: string): string {
  return id ? `closet:draft:item:${id}` : 'closet:draft:item:new';
}

function todayISO(): ISODate {
  return new Date().toISOString().slice(0, 10);
}
