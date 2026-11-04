import { landedCents } from '../../domain/money';
import type { ISODate, Purchase } from '../../domain/types';
import { db, type ClosetTraceDB } from '../schema';
import { recalcItemStats } from './items';

export interface PurchaseInput {
  itemId: string;
  channel: string;
  priceCents: number;
  shippingCents?: number;
  discountCents?: number;
  purchasedAt?: ISODate;
  orderRef?: string;
  note?: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function todayISO(): ISODate {
  return new Date().toISOString().slice(0, 10);
}

export async function addPurchase(
  input: PurchaseInput,
  database: ClosetTraceDB = db,
): Promise<string> {
  const id = crypto.randomUUID();
  await database.transaction('rw', [database.purchases, database.items, database.wearLogs], async () => {
    await database.purchases.add({
      id,
      itemId: input.itemId,
      channel: input.channel.trim(),
      priceCents: Math.max(0, Math.round(input.priceCents)),
      shippingCents: Math.max(0, Math.round(input.shippingCents ?? 0)),
      discountCents: Math.max(0, Math.round(input.discountCents ?? 0)),
      purchasedAt: input.purchasedAt ?? todayISO(),
      orderRef: input.orderRef,
      note: input.note,
      createdAt: nowISO(),
    });
    await recalcItemStats(input.itemId, database);
  });
  return id;
}

export async function updatePurchase(
  id: string,
  patch: Partial<PurchaseInput>,
  database: ClosetTraceDB = db,
): Promise<void> {
  const purchase = await database.purchases.get(id);
  if (!purchase) return;
  await database.transaction('rw', [database.purchases, database.items, database.wearLogs], async () => {
    await database.purchases.update(id, {
      channel: patch.channel?.trim() ?? purchase.channel,
      priceCents: patch.priceCents ?? purchase.priceCents,
      shippingCents: patch.shippingCents ?? purchase.shippingCents,
      discountCents: patch.discountCents ?? purchase.discountCents,
      purchasedAt: patch.purchasedAt ?? purchase.purchasedAt,
      orderRef: patch.orderRef ?? purchase.orderRef,
      note: patch.note ?? purchase.note,
    });
    await recalcItemStats(purchase.itemId, database);
  });
}

export async function deletePurchase(id: string, database: ClosetTraceDB = db): Promise<void> {
  const purchase = await database.purchases.get(id);
  if (!purchase) return;
  await database.transaction('rw', [database.purchases, database.items, database.wearLogs], async () => {
    await database.purchases.delete(id);
    await recalcItemStats(purchase.itemId, database);
  });
}

export async function listPurchases(
  itemId?: string,
  database: ClosetTraceDB = db,
): Promise<Purchase[]> {
  const rows = itemId
    ? await database.purchases.where('itemId').equals(itemId).toArray()
    : await database.purchases.toArray();
  return rows.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
}

export function purchaseTotalCents(purchases: Purchase[]): number {
  return purchases.reduce(
    (sum, purchase) =>
      sum + landedCents(purchase.priceCents, purchase.shippingCents, purchase.discountCents),
    0,
  );
}
