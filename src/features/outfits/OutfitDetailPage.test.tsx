import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { createItem, updateItem } from '../../db/repositories/items';
import { listOutfitItems, saveOutfit } from '../../db/repositories/outfits';
import type { WearLog } from '../../domain/types';
import { OutfitDetailPage } from './OutfitDetailPage';

let outfitId = '';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
  const shirt = await createItem({
    name: '白衬衫',
    categoryId: 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });
  const trousers = await createItem({
    name: '黑西裤',
    categoryId: 'builtin:cat:dress-pants',
    colorPrimaryId: 'builtin:color:black',
    warmth: 3,
    formality: 4,
    seasons: ['all'],
  });
  const loafers = await createItem({
    name: '棕色乐福鞋',
    categoryId: 'builtin:cat:loafers',
    colorPrimaryId: 'builtin:color:brown',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });
  await updateItem(shirt, { totalCostCents: 10_000 });
  await updateItem(trousers, { totalCostCents: 12_000 });
  await updateItem(loafers, { totalCostCents: 8_000 });

  outfitId = await saveOutfit({
    name: '通勤基础',
    sceneIds: ['builtin:scene:commute'],
    items: [
      { itemId: shirt, slot: 'top', order: 0 },
      { itemId: trousers, slot: 'bottom', order: 1 },
      { itemId: loafers, slot: 'shoes', order: 2 },
    ],
  });
  await db.outfits.update(outfitId, { wearCount: 3, lastWornAt: '2026-11-01' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/outfits/${outfitId}`]}>
      <Routes>
        <Route path="/outfits" element={<div>搭配列表</div>} />
        <Route path="/outfits/:id" element={<OutfitDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OutfitDetailPage', () => {
  it('shows items, scene, wear stats, total cost, and CPW', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: '通勤基础' })).toBeInTheDocument();
    expect(screen.getByText('白衬衫')).toBeInTheDocument();
    expect(screen.getByText('黑西裤')).toBeInTheDocument();
    expect(screen.getByText('棕色乐福鞋')).toBeInTheDocument();
    expect(await screen.findByText('通勤')).toBeInTheDocument();
    expect(screen.getByText(/穿过 3 次/)).toBeInTheDocument();
    expect(screen.getByText('¥300')).toBeInTheDocument();
    expect(screen.getByText('¥100')).toBeInTheDocument();
  });

  it('toggles favorite state', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: '收藏' }));

    await waitFor(async () => {
      expect((await db.outfits.get(outfitId))?.isFavorite).toBe(true);
    });
    expect(await screen.findByRole('button', { name: '取消收藏' })).toBeInTheDocument();
  });

  it('deletes only after confirmation and keeps wear history', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const log: WearLog = {
      id: crypto.randomUUID(),
      date: '2026-11-01',
      outfitId,
      outfitName: '通勤基础',
      itemIds: [],
      items: [],
      createdAt: '2026-11-01T08:00:00.000Z',
    };
    await db.wearLogs.add(log);

    renderDetail();
    await user.click(await screen.findByRole('button', { name: '删除搭配' }));

    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByText('搭配列表')).toBeInTheDocument();
    expect(await db.outfits.get(outfitId)).toBeUndefined();
    expect(await listOutfitItems(outfitId)).toHaveLength(0);
    expect(await db.wearLogs.get(log.id)).toBeDefined();
  });
});
