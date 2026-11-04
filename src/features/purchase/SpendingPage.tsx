import { useLiveQuery } from 'dexie-react-hooks';
import { formatCents, landedCents } from '../../domain/money';
import { groupSpending } from '../../domain/price';
import { todayISO } from '../../domain/date';
import { listItems } from '../../db/repositories/items';
import { listCategories } from '../../db/repositories/categories';
import { listPurchases } from '../../db/repositories/purchases';
import { BarList } from '../../components/charts/BarList';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';

export function SpendingPage() {
  return (
    <div>
      <PageHeader title="已购花费" subtitle="按月份、类型和渠道看看钱花在哪" />
      <SpendingView />
    </div>
  );
}

export function SpendingView() {
  const purchases = useLiveQuery(() => listPurchases(), []);
  const items = useLiveQuery(() => listItems({ includeRetired: true }), []);
  const categories = useLiveQuery(() => listCategories(true), []);

  if (!purchases || !items || !categories) return null;

  if (purchases.length === 0) {
    return (
      <Card>
        <h2 className="text-base font-semibold">还没有已购记录</h2>
        <p className="mt-1 text-sm text-muted">在衣物里填写购买价格后，这里会自动汇总花费。</p>
      </Card>
    );
  }

  const month = todayISO().slice(0, 7);
  const monthTotal = purchases
    .filter((purchase) => purchase.purchasedAt.startsWith(month))
    .reduce(
      (sum, purchase) =>
        sum + landedCents(purchase.priceCents, purchase.shippingCents, purchase.discountCents),
      0,
    );
  const itemById = new Map(items.map((item) => [item.id, item]));
  const byCategory = groupSpending(purchases, 'category', { items, categories }).map((entry) => ({
    label: entry.key,
    value: entry.cents,
    hint: formatCents(entry.cents),
  }));
  const byChannel = groupSpending(purchases, 'channel').map((entry) => ({
    label: entry.key,
    value: entry.cents,
    hint: formatCents(entry.cents),
  }));

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-sm text-muted">本月花费</p>
        <p data-testid="month-total" className="tabular mt-1 text-2xl font-semibold">
          {formatCents(monthTotal)}
        </p>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">按类型</h2>
        <div className="mt-2" data-testid="spending-category">
          <BarList data={byCategory} />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">按渠道</h2>
        <div className="mt-2" data-testid="spending-channel">
          <BarList data={byChannel} />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">最近购买</h2>
        <ul className="mt-2 space-y-2" data-testid="recent-purchases">
          {purchases.slice(0, 5).map((purchase) => (
            <li key={purchase.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">{itemById.get(purchase.itemId)?.name ?? '未知衣物'}</p>
                <p className="text-xs text-muted">
                  {purchase.channel} · {purchase.purchasedAt}
                </p>
              </div>
              <span className="tabular shrink-0">
                {formatCents(
                  landedCents(purchase.priceCents, purchase.shippingCents, purchase.discountCents),
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
