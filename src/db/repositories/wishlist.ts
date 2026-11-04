import type { ISODate, PriceQuote, WishlistItem } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';
import { addPurchase, type PurchaseInput } from './purchases';

export interface WishlistInput {
  name: string;
  brand?: string;
  categoryId: string;
  size?: string;
  colorPreference?: string;
  targetPriceCents?: number;
  priority?: 1 | 2 | 3;
  note?: string;
}

export interface QuoteInput {
  channel: string;
  priceCents: number;
  shippingCents?: number;
  discountCents?: number;
  observedAt?: ISODate;
  url?: string;
  note?: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function todayISO(): ISODate {
  return new Date().toISOString().slice(0, 10);
}

export async function addWishlist(
  input: WishlistInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = nowISO();
  const item: WishlistItem = {
    id,
    name: input.name.trim(),
    brand: input.brand,
    categoryId: input.categoryId,
    size: input.size,
    colorPreference: input.colorPreference,
    targetPriceCents: input.targetPriceCents,
    priority: input.priority ?? 2,
    status: 'watching',
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };
  await database.wishlistItems.add(item);
  return id;
}

export async function updateWishlist(
  id: string,
  patch: Partial<WishlistItem>,
  database: ClosetTraceDB = db,
): Promise<void> {
  const existing = await database.wishlistItems.get(id);
  if (!existing) return;
  await database.wishlistItems.update(id, { ...patch, id, updatedAt: nowISO() });
}

export async function getWishlist(
  id: string,
  database: ClosetTraceDB = db,
): Promise<WishlistItem | undefined> {
  return database.wishlistItems.get(id);
}

export async function listWishlist(
  includeDropped = false,
  database: ClosetTraceDB = db,
): Promise<WishlistItem[]> {
  const rows = await database.wishlistItems.toArray();
  return rows
    .filter((item) => includeDropped || item.status !== 'dropped')
    .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt));
}

export async function addQuote(
  wishlistId: string,
  input: QuoteInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const wishlist = await database.wishlistItems.get(wishlistId);
  if (!wishlist) throw new Error('想买项不存在');

  const id = crypto.randomUUID();
  await database.priceQuotes.add({
    id,
    wishlistId,
    channel: input.channel.trim(),
    priceCents: Math.max(0, Math.round(input.priceCents)),
    shippingCents: Math.max(0, Math.round(input.shippingCents ?? 0)),
    discountCents: Math.max(0, Math.round(input.discountCents ?? 0)),
    observedAt: input.observedAt ?? todayISO(),
    url: input.url,
    note: input.note,
    createdAt: nowISO(),
  });
  return id;
}

export async function deleteQuote(id: string, database: ClosetTraceDB = db): Promise<void> {
  await database.priceQuotes.delete(id);
}

export async function listQuotes(
  wishlistId: string,
  database: ClosetTraceDB = db,
): Promise<PriceQuote[]> {
  const rows = await database.priceQuotes.where('wishlistId').equals(wishlistId).toArray();
  return rows.sort(
    (a, b) => b.observedAt.localeCompare(a.observedAt) || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function convertWishlistToPurchase(
  wishlistId: string,
  quoteId: string | undefined,
  itemId: string,
  purchaseInput: Partial<PurchaseInput> = {},
  database: ClosetTraceDB = db,
): Promise<string> {
  const wishlist = await database.wishlistItems.get(wishlistId);
  if (!wishlist) throw new Error('想买项不存在');

  let quote: PriceQuote | undefined;
  if (quoteId) {
    quote = await database.priceQuotes.get(quoteId);
    if (!quote || quote.wishlistId !== wishlistId) {
      throw new Error('报价不属于该想买项');
    }
  }

  return database.transaction(
    'rw',
    [database.purchases, database.items, database.wearLogs, database.wishlistItems],
    async () => {
      const purchaseId = await addPurchase(
        {
          itemId,
          channel: purchaseInput.channel ?? quote?.channel ?? '未知渠道',
          priceCents: purchaseInput.priceCents ?? quote?.priceCents ?? 0,
          shippingCents: purchaseInput.shippingCents ?? quote?.shippingCents ?? 0,
          discountCents: purchaseInput.discountCents ?? quote?.discountCents ?? 0,
          purchasedAt: purchaseInput.purchasedAt,
          orderRef: purchaseInput.orderRef,
          note: purchaseInput.note,
        },
        database,
      );

      await database.wishlistItems.update(wishlistId, {
        status: 'bought',
        convertedItemId: itemId,
        updatedAt: nowISO(),
      });
      return purchaseId;
    },
  );
}
