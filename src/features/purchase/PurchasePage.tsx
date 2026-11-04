import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { formatCents } from '../../domain/money';
import { lowestQuote } from '../../domain/price';
import { db } from '../../db/schema';
import { listCategories } from '../../db/repositories/categories';
import { listWishlist } from '../../db/repositories/wishlist';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { WishlistFormSheet } from './WishlistFormSheet';

type PurchaseView = 'wishlist' | 'spending' | 'cpw';

const VIEW_OPTIONS: Array<{ value: PurchaseView; label: string }> = [
  { value: 'wishlist', label: '待购比价' },
  { value: 'spending', label: '已购花费' },
  { value: 'cpw', label: '穿着成本' },
];

export function PurchasePage() {
  const [view, setView] = useState<PurchaseView>('wishlist');
  const [showDropped, setShowDropped] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const wishlist = useLiveQuery(() => listWishlist(showDropped), [showDropped]);
  const categories = useLiveQuery(() => listCategories(true), []);
  const quotes = useLiveQuery(() => db.priceQuotes.toArray(), []);

  if (!wishlist || !categories || !quotes) return null;

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const quotesByWishlist = new Map<string, typeof quotes>();
  for (const quote of quotes) {
    const bucket = quotesByWishlist.get(quote.wishlistId) ?? [];
    bucket.push(quote);
    quotesByWishlist.set(quote.wishlistId, bucket);
  }

  return (
    <div>
      <PageHeader
        title="采购"
        subtitle="待购比价、已购花费与穿着成本"
        action={
          wishlist.length > 0 && view === 'wishlist' ? (
            <Button onClick={() => setFormOpen(true)}>记一件想买</Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <SegmentedControl
          ariaLabel="采购视图"
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
        />
      </div>

      {view === 'spending' ? (
        <p className="py-8 text-center text-sm text-muted">花费统计即将上线。</p>
      ) : view === 'cpw' ? (
        <p className="py-8 text-center text-sm text-muted">穿着成本即将上线。</p>
      ) : wishlist.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={28} aria-hidden />}
          title="还没有待购记录"
          description="记录想买的衣服，再逐条添加不同渠道的报价，比较最低到手价。"
          action={<Button onClick={() => setFormOpen(true)}>记一件想买</Button>}
        />
      ) : (
        <>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowDropped((current) => !current)}
              className="min-h-9 text-sm text-accent-text"
            >
              {showDropped ? '隐藏已放弃' : '显示已放弃'}
            </button>
          </div>
          <ul className="space-y-2">
            {wishlist.map((item) => {
              const itemQuotes = quotesByWishlist.get(item.id) ?? [];
              const best = lowestQuote(itemQuotes);
              return (
                <li key={item.id}>
                  <Card>
                    <Link to={`/purchase/wishlist/${item.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.status === 'dropped' ? (
                          <span className="shrink-0 text-xs text-muted">已放弃</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {categoryNameById.get(item.categoryId) ?? '未分类'}
                        {item.brand ? ` · ${item.brand}` : ''}
                      </p>
                      {item.targetPriceCents !== undefined ? (
                        <p className="mt-1 text-xs">目标价 {formatCents(item.targetPriceCents)}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">
                        {best
                          ? `最低 ${formatCents(
                              best.priceCents + best.shippingCents - best.discountCents,
                            )} · ${itemQuotes.length} 个报价`
                          : '还没有报价'}
                      </p>
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {formOpen ? (
        <WishlistFormSheet open onClose={() => setFormOpen(false)} />
      ) : null}
    </div>
  );
}
