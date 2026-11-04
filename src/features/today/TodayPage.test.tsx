import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { createItem } from '../../db/repositories/items';
import { WardrobePage } from '../wardrobe/WardrobePage';
import { TodayPage } from './TodayPage';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
});

async function addItem(name: string, status: 'available' | 'laundry' = 'available') {
  return createItem({
    name,
    categoryId: status === 'laundry' ? 'builtin:cat:jeans' : 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
    status,
  });
}

function renderToday() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/wardrobe" element={<WardrobePage />} />
        <Route path="/wardrobe/item/new" element={<div>添加衣物</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TodayPage', () => {
  it('asks for the first item when the wardrobe is empty', async () => {
    renderToday();

    expect(await screen.findByText('先添加第一件衣服')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去添加' })).toHaveAttribute(
      'href',
      '/wardrobe/item/new',
    );
  });

  it('shows the temperature control, scene chips, and recommendation placeholder', async () => {
    await addItem('白衬衫');
    renderToday();

    expect(await screen.findByLabelText('温度')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通勤' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '休闲' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('今日推荐')).toBeInTheDocument();
  });

  it('logs a wear from selected items and shows today worn', async () => {
    const itemId = await addItem('白衬衫');
    const user = userEvent.setup();
    renderToday();

    await user.click(await screen.findByRole('button', { name: '记录穿着' }));
    await user.click(await screen.findByRole('button', { name: '白衬衫' }));
    expect(screen.getByLabelText('顺便加入待洗')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: '保存穿着' }));

    expect(await screen.findByText('今天已穿')).toBeInTheDocument();
    expect((await db.items.get(itemId))?.wearCount).toBe(1);
    expect(await db.wearLogs.count()).toBe(1);
  });

  it('can add worn items to laundry in the same step', async () => {
    const itemId = await addItem('白衬衫');
    const user = userEvent.setup();
    renderToday();

    await user.click(await screen.findByRole('button', { name: '记录穿着' }));
    await user.click(await screen.findByRole('button', { name: '白衬衫' }));
    await user.click(screen.getByLabelText('顺便加入待洗'));
    await user.click(screen.getByRole('button', { name: '保存穿着' }));

    await screen.findByText('今天已穿');
    expect((await db.items.get(itemId))?.status).toBe('laundry');
  });

  it('shows the laundry count and opens the filtered wardrobe', async () => {
    await addItem('白衬衫');
    await addItem('牛仔裤', 'laundry');
    const user = userEvent.setup();
    renderToday();

    expect(await screen.findByText('待洗 1 件')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '查看' }));

    expect(await screen.findByText('牛仔裤')).toBeInTheDocument();
    expect(screen.queryByText('白衬衫')).not.toBeInTheDocument();
    expect(screen.getByText('1 件')).toBeInTheDocument();
  });
});
