import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { createItem } from '../../db/repositories/items';
import { addPurchase } from '../../db/repositories/purchases';
import { toISODate } from '../../domain/date';
import { SpendingPage } from './SpendingPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <SpendingPage />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
});

async function seedPurchases() {
  const shirtId = await createItem(
    {
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
      warmth: 2,
      formality: 3,
      seasons: ['all'],
    },
    db,
  );
  const shoesId = await createItem(
    {
      name: '跑鞋',
      categoryId: 'builtin:cat:sneakers',
      colorPrimaryId: 'builtin:color:black',
      warmth: 2,
      formality: 1,
      seasons: ['all'],
    },
    db,
  );

  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15);

  await addPurchase(
    { itemId: shirtId, channel: '淘宝', priceCents: 10000, purchasedAt: toISODate(today) },
    db,
  );
  await addPurchase(
    { itemId: shoesId, channel: '京东', priceCents: 20000, purchasedAt: toISODate(lastMonth) },
    db,
  );
}

describe('SpendingPage', () => {
  it('shows an empty state when nothing has been purchased', async () => {
    renderPage();
    expect(await screen.findByText('还没有已购记录')).toBeInTheDocument();
  });

  it('shows the month total, category and channel bars, and recent purchases', async () => {
    await seedPurchases();
    renderPage();

    expect(await screen.findByTestId('month-total')).toHaveTextContent('¥100');

    const categories = screen.getByTestId('spending-category');
    expect(within(categories).getByText('衬衫')).toBeInTheDocument();
    expect(within(categories).getByText('¥100')).toBeInTheDocument();
    expect(within(categories).getByText('运动鞋')).toBeInTheDocument();
    expect(within(categories).getByText('¥200')).toBeInTheDocument();

    const channels = screen.getByTestId('spending-channel');
    expect(within(channels).getByText('淘宝')).toBeInTheDocument();
    expect(within(channels).getByText('¥100')).toBeInTheDocument();
    expect(within(channels).getByText('京东')).toBeInTheDocument();
    expect(within(channels).getByText('¥200')).toBeInTheDocument();

    const recent = screen.getByTestId('recent-purchases');
    expect(within(recent).getByText('白衬衫')).toBeInTheDocument();
    expect(within(recent).getByText('跑鞋')).toBeInTheDocument();
  });
});
