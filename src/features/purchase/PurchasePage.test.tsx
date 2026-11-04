import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { addWishlist } from '../../db/repositories/wishlist';
import { PurchasePage } from './PurchasePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <PurchasePage />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
});

describe('PurchasePage', () => {
  it('shows an empty state and creates a wishlist item with a target price', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('还没有待购记录')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '记一件想买' }));

    const dialog = screen.getByRole('dialog', { name: '记一件想买' });
    await user.type(within(dialog).getByLabelText('名称'), '羊毛大衣');
    await user.selectOptions(within(dialog).getByLabelText('类型'), 'builtin:cat:coat');
    await user.type(within(dialog).getByLabelText('目标价'), '800');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));

    expect(await screen.findByText('羊毛大衣')).toBeInTheDocument();
    expect(screen.getByText('目标价 ¥800')).toBeInTheDocument();

    const rows = await db.wishlistItems.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: '羊毛大衣',
      categoryId: 'builtin:cat:coat',
      targetPriceCents: 80000,
      status: 'watching',
    });
  });

  it('hides dropped wishlist items unless the toggle is on', async () => {
    const user = userEvent.setup();
    await addWishlist(
      { name: '羊毛大衣', categoryId: 'builtin:cat:coat', targetPriceCents: 80000 },
      db,
    );
    const dropped = await addWishlist(
      { name: '旧跑鞋', categoryId: 'builtin:cat:sneakers' },
      db,
    );
    await db.wishlistItems.update(dropped, { status: 'dropped' });

    renderPage();

    expect(await screen.findByText('羊毛大衣')).toBeInTheDocument();
    expect(screen.queryByText('旧跑鞋')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '显示已放弃' }));
    expect(await screen.findByText('旧跑鞋')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '隐藏已放弃' }));
    await waitFor(() => expect(screen.queryByText('旧跑鞋')).not.toBeInTheDocument());
  });
});
