import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { createItem } from '../../db/repositories/items';
import { createLocation } from '../../db/repositories/locations';
import { addPurchase } from '../../db/repositories/purchases';
import { ItemDetailPage } from './ItemDetailPage';

let itemId = '';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
  const bedroom = await createLocation({ name: '卧室' });
  const wardrobe = await createLocation({ name: '主衣柜', parentId: bedroom });
  itemId = await createItem({
    name: '白色衬衫',
    categoryId: 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
    locationId: wardrobe,
  });
  await addPurchase({
    itemId,
    channel: '淘宝',
    priceCents: 19900,
    shippingCents: 1000,
    purchasedAt: '2026-10-01',
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/wardrobe/item/${itemId}`]}>
      <Routes>
        <Route path="/wardrobe/item/:id" element={<ItemDetailPage />} />
        <Route path="/wardrobe" element={<div>衣橱占位</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ItemDetailPage', () => {
  it('shows the location path and purchase total', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '白色衬衫' })).toBeInTheDocument();
    expect(await screen.findByText('卧室 / 主衣柜')).toBeInTheDocument();
    expect(screen.getAllByText('¥209').length).toBeGreaterThan(0);
    expect(screen.getByText(/单次成本：暂无/)).toBeInTheDocument();
  });

  it('retires only after confirmation and purges only after confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    await user.click(await screen.findByRole('button', { name: '移出衣橱' }));
    expect((await db.items.get(itemId))?.status).toBe('available');

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: '移出衣橱' }));
    await waitFor(async () => {
      expect((await db.items.get(itemId))?.status).toBe('retired');
    });
    expect(await screen.findByRole('button', { name: '恢复到衣橱' })).toBeInTheDocument();

    confirm.mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: '彻底删除' }));
    expect(await db.items.get(itemId)).toBeDefined();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: '彻底删除' }));
    await waitFor(async () => {
      expect(await db.items.get(itemId)).toBeUndefined();
    });
    confirm.mockRestore();
  });

  it('toggles laundry status', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: '加入待洗' }));
    await waitFor(async () => {
      expect((await db.items.get(itemId))?.status).toBe('laundry');
    });
    expect(await screen.findByRole('button', { name: '标记已洗' })).toBeInTheDocument();
  });

  it('logs a wear from the date sheet', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: '穿一次' }));
    expect(await screen.findByLabelText('穿着日期')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '记录' }));

    await waitFor(async () => {
      expect(await db.wearLogs.count()).toBe(1);
    });
    const item = await db.items.get(itemId);
    expect(item?.wearCount).toBe(1);
    expect(item?.lastWornAt).toBeTruthy();
  });
});
