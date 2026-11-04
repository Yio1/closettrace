import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { createItem } from '../../db/repositories/items';
import { logWear } from '../../db/repositories/wearLogs';
import { todayISO } from '../../domain/date';
import { WardrobeInsightsPage } from './WardrobeInsightsPage';

let shirtId = '';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
  shirtId = await createItem({
    name: '白色衬衫',
    categoryId: 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });
  await createItem({
    name: '旧外套',
    categoryId: 'builtin:cat:coat',
    colorPrimaryId: 'builtin:color:navy',
    warmth: 4,
    formality: 4,
    seasons: ['winter'],
    status: 'retired',
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <WardrobeInsightsPage />
    </MemoryRouter>,
  );
}

describe('WardrobeInsightsPage', () => {
  it('shows totals, distribution, and utilization after wear data exists', async () => {
    const item = await db.items.get(shirtId);
    if (!item) throw new Error('missing item');
    await logWear({ date: todayISO(), items: [item] });

    renderPage();

    expect(await screen.findByRole('heading', { name: '衣橱分析' })).toBeInTheDocument();
    await screen.findByText('上装');
    expect(screen.getByText('总件数').nextElementSibling?.textContent).toContain('1');
    expect(screen.getByText('白')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('prompts to record wear when there are no logs', async () => {
    renderPage();

    expect(await screen.findByText('还没有穿着记录')).toBeInTheDocument();
    expect(screen.queryByText(/很久没穿/)).not.toBeInTheDocument();
  });
});
