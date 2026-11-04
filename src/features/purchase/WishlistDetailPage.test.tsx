import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { addQuote, addWishlist, getWishlist } from '../../db/repositories/wishlist';
import { ItemFormPage } from '../wardrobe/ItemFormPage';
import { WishlistDetailPage } from './WishlistDetailPage';

function renderDetail(wishlistId: string) {
  return render(
    <MemoryRouter initialEntries={[`/purchase/wishlist/${wishlistId}`]}>
      <Routes>
        <Route path="/purchase/wishlist/:id" element={<WishlistDetailPage />} />
        <Route path="/wardrobe/item/new" element={<ItemFormPage />} />
        <Route path="/wardrobe/item/:id" element={<p>衣物详情</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  sessionStorage.clear();
  await seedDatabase(db);
});

async function wishlistWithQuotes() {
  const wishlistId = await addWishlist(
    {
      name: '羊毛大衣',
      brand: '无印',
      categoryId: 'builtin:cat:coat',
      targetPriceCents: 80000,
      priority: 3,
    },
    db,
  );
  await addQuote(
    wishlistId,
    {
      channel: '天猫',
      priceCents: 76000,
      discountCents: 2000,
      observedAt: '2026-02-01',
    },
    db,
  );
  const lowestId = await addQuote(
    wishlistId,
    { channel: '淘宝', priceCents: 70000, shippingCents: 1000, observedAt: '2026-02-10' },
    db,
  );
  await addQuote(
    wishlistId,
    { channel: '京东', priceCents: 80000, observedAt: '2026-02-05' },
    db,
  );
  return { wishlistId, lowestId };
}

describe('WishlistDetailPage', () => {
  it('sorts quotes by landed price, marks the lowest, and shows the target delta', async () => {
    const { wishlistId } = await wishlistWithQuotes();
    renderDetail(wishlistId);

    expect(await screen.findByRole('heading', { name: '羊毛大衣' })).toBeInTheDocument();

    const rows = await screen.findAllByTestId('quote-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('淘宝');
    expect(rows[1]).toHaveTextContent('天猫');
    expect(rows[2]).toHaveTextContent('京东');

    expect(rows[0]).toHaveTextContent('¥710');
    expect(rows[0]).toHaveTextContent('最低价');
    expect(rows[0]).toHaveTextContent('低于目标价 ¥90');
    expect(rows[1]).toHaveTextContent('低于目标价 ¥60');
    expect(rows[2]).toHaveTextContent('与目标价一致');
  });

  it('adds a quote from the detail page and re-sorts by landed price', async () => {
    const user = userEvent.setup();
    const { wishlistId } = await wishlistWithQuotes();
    renderDetail(wishlistId);

    await screen.findByRole('heading', { name: '羊毛大衣' });
    await user.click(screen.getByRole('button', { name: '添加报价' }));

    const dialog = screen.getByRole('dialog', { name: '添加报价' });
    await user.type(within(dialog).getByLabelText('渠道'), '唯品会');
    await user.type(within(dialog).getByLabelText('价格'), '680');
    await user.type(within(dialog).getByLabelText('运费'), '5');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const rows = await screen.findAllByTestId('quote-row');
    expect(rows[0]).toHaveTextContent('唯品会');
    expect(rows[0]).toHaveTextContent('¥685');
    expect(rows[0]).toHaveTextContent('最低价');
  });

  it('prefills the item form and marks the wishlist bought after saving', async () => {
    const user = userEvent.setup();
    const { wishlistId, lowestId } = await wishlistWithQuotes();
    renderDetail(wishlistId);

    expect(await screen.findByRole('heading', { name: '羊毛大衣' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '标记已购' }));

    expect(await screen.findByRole('heading', { name: '添加衣物' })).toBeInTheDocument();
    expect(screen.getByLabelText('名称 *')).toHaveValue('羊毛大衣');
    expect(screen.getByLabelText('购买渠道')).toHaveValue('淘宝');
    expect(screen.getByLabelText('购买价格')).toHaveValue('700');

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('衣物详情')).toBeInTheDocument();

    const items = await db.items.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: '羊毛大衣', categoryId: 'builtin:cat:coat' });

    const purchases = await db.purchases.toArray();
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({
      itemId: items[0].id,
      channel: '淘宝',
      priceCents: 70000,
      shippingCents: 1000,
    });

    expect(await getWishlist(wishlistId, db)).toMatchObject({
      status: 'bought',
      convertedItemId: items[0].id,
    });
    expect((await db.priceQuotes.get(lowestId))?.observedAt).toBe('2026-02-10');
  });
});
