import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { landedCents, formatCents } from '../../domain/money';
import { lowestQuote, priceDelta, sortQuotesByLanded } from '../../domain/price';
import { listCategories } from '../../db/repositories/categories';
import { getWishlist, listQuotes, updateWishlist } from '../../db/repositories/wishlist';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { QuoteFormSheet } from './QuoteFormSheet';

const STATUS_LABELS = {
  watching: '待购',
  bought: '已购',
  dropped: '已放弃',
} as const;

export function WishlistDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quoteOpen, setQuoteOpen] = useState(false);

  const data = useLiveQuery(async () => {
    if (!id) return { missing: true as const };
    const wishlist = await getWishlist(id);
    if (!wishlist) return { missing: true as const };
    const [quotes, categories] = await Promise.all([listQuotes(id), listCategories(true)]);
    return { missing: false as const, wishlist, quotes, categories };
  }, [id]);

  if (!data) return null;
  if (data.missing) {
    return (
      <EmptyState
        title="找不到这件想买"
        description="它可能已被删除。"
        action={<Button onClick={() => navigate('/purchase')}>返回采购</Button>}
      />
    );
  }

  const { wishlist, quotes, categories } = data;
  const sorted = sortQuotesByLanded(quotes);
  const best = lowestQuote(quotes);
  const category = categories.find((entry) => entry.id === wishlist.categoryId);
  const itemLink = `/wardrobe/item/new?wishlistId=${wishlist.id}${
    best ? `&quoteId=${best.id}` : ''
  }`;

  return (
    <div className="space-y-4">
      <Link to="/purchase" className="flex min-h-11 items-center gap-1 text-sm text-muted">
        <ArrowLeft size={18} aria-hidden />
        返回采购
      </Link>

      <PageHeader
        title={wishlist.name}
        subtitle={[category?.name, wishlist.brand, STATUS_LABELS[wishlist.status]]
          .filter(Boolean)
          .join(' · ')}
      />

      <Card className="space-y-1 text-sm">
        {wishlist.targetPriceCents !== undefined ? (
          <p>目标价 {formatCents(wishlist.targetPriceCents)}</p>
        ) : (
          <p className="text-muted">未设置目标价</p>
        )}
        {wishlist.size ? <p className="text-xs text-muted">尺码 {wishlist.size}</p> : null}
        {wishlist.colorPreference ? (
          <p className="text-xs text-muted">颜色偏好 {wishlist.colorPreference}</p>
        ) : null}
        {wishlist.note ? <p className="text-xs text-muted">{wishlist.note}</p> : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        {wishlist.status === 'watching' ? (
          <>
            <Button onClick={() => setQuoteOpen(true)}>添加报价</Button>
            <Link
              to={itemLink}
              className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm"
            >
              标记已购
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                void updateWishlist(wishlist.id, { status: 'dropped' });
                navigate('/purchase');
              }}
            >
              放弃
            </Button>
          </>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">还没有报价，添加第一条来比价。</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((quote) => {
            const landed = landedCents(
              quote.priceCents,
              quote.shippingCents,
              quote.discountCents,
            );
            const delta = priceDelta(quote, wishlist.targetPriceCents);
            return (
              <li key={quote.id} data-testid="quote-row">
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{quote.channel}</p>
                      <p className="mt-1 text-lg font-semibold tabular">{formatCents(landed)}</p>
                    </div>
                    {best?.id === quote.id ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-text">
                        最低价
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    观察于 {quote.observedAt}
                    {quote.shippingCents > 0
                      ? ` · 运费 ${formatCents(quote.shippingCents)}`
                      : ''}
                    {quote.discountCents > 0
                      ? ` · 优惠 ${formatCents(quote.discountCents)}`
                      : ''}
                  </p>
                  {delta.kind === 'below' ? (
                    <p className="mt-1 text-xs text-accent-text">
                      低于目标价 {formatCents(delta.cents)}
                    </p>
                  ) : delta.kind === 'above' ? (
                    <p className="mt-1 text-xs text-muted">
                      高于目标价 {formatCents(delta.cents)}
                    </p>
                  ) : delta.kind === 'equal' ? (
                    <p className="mt-1 text-xs text-muted">与目标价一致</p>
                  ) : null}
                  {quote.url ? (
                    <a
                      href={quote.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex min-h-9 items-center text-sm text-accent-text"
                    >
                      查看来源
                    </a>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {quoteOpen ? (
        <QuoteFormSheet open onClose={() => setQuoteOpen(false)} wishlistId={wishlist.id} />
      ) : null}
    </div>
  );
}
