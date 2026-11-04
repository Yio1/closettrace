export type ISODate = string;
export type ISODateTime = string;
export type Cents = number;

export type Slot = 'top' | 'bottom' | 'dress' | 'outer' | 'shoes' | 'bag' | 'accessory';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all';

export type ItemStatus = 'available' | 'laundry' | 'repair' | 'stored' | 'retired';

export type Pattern = 'solid' | 'stripe' | 'check' | 'floral' | 'print' | 'denim' | 'other';

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  slot: Slot;
  slots?: Slot[];
  defaultFormality: number;
  defaultWarmth: number;
  defaultSeasons: Season[];
  isBuiltIn: boolean;
  archived: boolean;
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Location {
  id: string;
  name: string;
  parentId?: string;
  detail?: string;
  order: number;
  note?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  brand?: string;
  size?: string;
  colorPrimaryId: string;
  colorSecondaryId?: string;
  pattern: Pattern;
  material?: string;
  warmth: number;
  formality: number;
  seasons: Season[];
  sceneTags: string[];
  styleTags: string[];
  locationId?: string;
  locationDetail?: string;
  status: ItemStatus;
  coverPhotoId?: string;
  thumbPhotoId?: string;
  avoidRecommend: boolean;
  isFavorite: boolean;
  note?: string;
  wearCount: number;
  lastWornAt?: ISODate;
  totalCostCents: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}

export interface ItemPhoto {
  id: string;
  itemId: string;
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
  bytes: number;
  order: number;
  createdAt: ISODateTime;
}

export interface Outfit {
  id: string;
  name: string;
  sceneIds: string[];
  isFavorite: boolean;
  source: 'manual' | 'recommended';
  note?: string;
  coverPhotoId?: string;
  wearCount: number;
  lastWornAt?: ISODate;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OutfitItem {
  id: string;
  outfitId: string;
  itemId: string;
  slot: Slot;
  order: number;
}

export interface WearItemSnapshot {
  itemId: string;
  name: string;
  categoryId: string;
  slot: Slot;
  colorPrimaryId: string;
  photoId?: string;
}

export interface WearLog {
  id: string;
  date: ISODate;
  outfitId?: string;
  outfitName?: string;
  sceneId?: string;
  tempC?: number;
  itemIds: string[];
  items: WearItemSnapshot[];
  note?: string;
  createdAt: ISODateTime;
}

export interface Scene {
  id: string;
  name: string;
  formalityMin: number;
  formalityMax: number;
  requiredSlots: Slot[];
  optionalSlots: Slot[];
  styleTags: string[];
  isBuiltIn: boolean;
  archived: boolean;
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Purchase {
  id: string;
  itemId: string;
  channel: string;
  priceCents: Cents;
  shippingCents: Cents;
  discountCents: Cents;
  purchasedAt: ISODate;
  orderRef?: string;
  note?: string;
  createdAt: ISODateTime;
}

export interface WishlistItem {
  id: string;
  name: string;
  brand?: string;
  categoryId: string;
  size?: string;
  colorPreference?: string;
  targetPriceCents?: Cents;
  priority: 1 | 2 | 3;
  status: 'watching' | 'bought' | 'dropped';
  note?: string;
  convertedItemId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PriceQuote {
  id: string;
  wishlistId: string;
  channel: string;
  priceCents: Cents;
  shippingCents: Cents;
  discountCents: Cents;
  observedAt: ISODate;
  url?: string;
  note?: string;
  createdAt: ISODateTime;
}

export interface OutfitFeedback {
  id: string;
  signature: string;
  sceneId?: string;
  rating: 'like' | 'dislike';
  reason?: string;
  createdAt: ISODateTime;
}

export interface Setting {
  key: string;
  value: unknown;
  updatedAt: ISODateTime;
}

export interface Diagnostic {
  id: string;
  at: ISODateTime;
  level: 'warn' | 'error';
  message: string;
  context?: string;
}

export interface ColorSwatch {
  id: string;
  name: string;
  hex: string;
  hue: number;
  family: 'neutral' | 'warm' | 'cool';
  isNeutral: boolean;
  order: number;
}

export interface StyleTag {
  id: string;
  name: string;
  order: number;
}

export type CategoryContent = Omit<
  Category,
  'isBuiltIn' | 'archived' | 'createdAt' | 'updatedAt'
> & { archived?: boolean };

export type SceneContent = Omit<Scene, 'isBuiltIn' | 'archived' | 'createdAt' | 'updatedAt'> & {
  archived?: boolean;
};
