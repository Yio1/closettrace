import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { createItem, updateItem } from '../../db/repositories/items';
import { CpwPage } from './CpwPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <CpwPage />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
});

async function seedItems() {
  const coatId = await createItem(
    {
      name: '羊毛大衣',
      categoryId: 'builtin:cat:coat',
      colorPrimaryId: 'builtin:color:caramel',
      warmth: 4,
      formality: 3,
      seasons: ['winter'],
    },
    db,
  );
  await updateItem(coatId, { totalCostCents: 12000, wearCount: 10 }, db);

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
  await updateItem(shoesId, { totalCostCents: 5000, wearCount: 0 }, db);
}

describe('CpwPage', () => {
  it('shows an empty state without owned items', async () => {
    renderPage();
    expect(await screen.findByText('还没有衣物可以计算')).toBeInTheDocument();
  });

  it('shows average cost, highest CPW, wear goals, and zero-wear items separately', async () => {
    await seedItems();
    renderPage();

    expect(await screen.findByTestId('average-cpw')).toHaveTextContent('¥12');

    const list = screen.getByTestId('cpw-list');
    expect(within(list).getByText('羊毛大衣')).toBeInTheDocument();
    expect(within(list).getByText('¥12')).toBeInTheDocument();
    expect(within(list).getByText('再穿 1 次，CPW 降到 ¥11')).toBeInTheDocument();
    expect(within(list).queryByText('跑鞋')).not.toBeInTheDocument();

    const zero = screen.getByTestId('zero-wear-list');
    expect(within(zero).getByText('跑鞋')).toBeInTheDocument();
    expect(within(zero).getByText('¥50')).toBeInTheDocument();
  });
});
