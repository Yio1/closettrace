import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { createItem } from '../../db/repositories/items';
import { listOutfitItems } from '../../db/repositories/outfits';
import { OutfitEditorPage } from './OutfitEditorPage';

let shirtId = '';
let trousersId = '';
let loafersId = '';
let dressId = '';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
  shirtId = await createItem({
    name: '白衬衫',
    categoryId: 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });
  trousersId = await createItem({
    name: '黑西裤',
    categoryId: 'builtin:cat:dress-pants',
    colorPrimaryId: 'builtin:color:black',
    warmth: 3,
    formality: 4,
    seasons: ['all'],
  });
  loafersId = await createItem({
    name: '棕色乐福鞋',
    categoryId: 'builtin:cat:loafers',
    colorPrimaryId: 'builtin:color:brown',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });
  dressId = await createItem({
    name: '黑色连衣裙',
    categoryId: 'builtin:cat:one-piece-dress',
    colorPrimaryId: 'builtin:color:black',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });
});

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/outfits/new']}>
      <Routes>
        <Route path="/outfits/new" element={<OutfitEditorPage />} />
        <Route path="/outfits/:id/edit" element={<OutfitEditorPage />} />
        <Route path="/outfits/:id" element={<div>搭配详情</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function choose(user: ReturnType<typeof userEvent.setup>, slot: string, name: string) {
  await user.click(await screen.findByRole('button', { name: `选择${slot}` }));
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }));
}

describe('OutfitEditorPage', () => {
  it('shows a complete outfit after choosing top, bottom, and shoes', async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(await screen.findByText('新建搭配')).toBeInTheDocument();
    await choose(user, '上装', '白衬衫');
    await choose(user, '下装', '黑西裤');
    expect(screen.getByText(/完整度：缺鞋/)).toBeInTheDocument();
    await choose(user, '鞋', '棕色乐福鞋');

    expect(screen.getByText(/完整度：可穿/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '移除鞋' }));
    expect(screen.getByText(/完整度：缺鞋/)).toBeInTheDocument();
  });

  it('saves the chosen slots and order', async () => {
    const user = userEvent.setup();
    renderEditor();

    await choose(user, '上装', '白衬衫');
    await choose(user, '下装', '黑西裤');
    await choose(user, '鞋', '棕色乐福鞋');

    const nameField = screen.getByLabelText('搭配名称');
    await user.clear(nameField);
    await user.type(nameField, '通勤基础');
    await user.click(screen.getByRole('button', { name: '保存搭配' }));

    expect(await screen.findByText('搭配详情')).toBeInTheDocument();

    const outfits = await db.outfits.toArray();
    expect(outfits).toHaveLength(1);
    expect(outfits[0].name).toBe('通勤基础');
    expect(outfits[0].source).toBe('manual');

    const rows = await listOutfitItems(outfits[0].id);
    expect(rows.map((row) => row.itemId)).toEqual([shirtId, trousersId, loafersId]);
    expect(rows.map((row) => row.slot)).toEqual(['top', 'bottom', 'shoes']);
  });

  it('replaces top and bottom when a dress is chosen', async () => {
    const user = userEvent.setup();
    renderEditor();

    await choose(user, '上装', '白衬衫');
    await choose(user, '连衣裙', '黑色连衣裙');

    expect(screen.queryByRole('button', { name: '更换上装' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更换下装' })).not.toBeInTheDocument();
    expect(screen.getByText(/连衣裙已替代上装和下装/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存搭配' }));
    await screen.findByText('搭配详情');

    const outfit = (await db.outfits.toArray())[0];
    const rows = await listOutfitItems(outfit.id);
    expect(rows.map((row) => row.slot)).toEqual(['dress']);
    expect(rows.map((row) => row.itemId)).toEqual([dressId]);
  });

  it('keeps the auto name until the user edits it', async () => {
    const user = userEvent.setup();
    renderEditor();

    await choose(user, '上装', '白衬衫');
    await choose(user, '下装', '黑西裤');
    await choose(user, '鞋', '棕色乐福鞋');

    await waitFor(() => {
      expect(screen.getByLabelText('搭配名称')).toHaveValue('白衬衫 + 黑西裤 + 棕色乐福鞋');
    });
  });
});
