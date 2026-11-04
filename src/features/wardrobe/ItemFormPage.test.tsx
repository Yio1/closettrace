import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { compressImage } from '../../lib/image';
import { ItemFormPage } from './ItemFormPage';

vi.mock('../../lib/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/image')>();
  return {
    ...actual,
    compressImage: vi.fn(async () => ({
      blob: new Blob(['full'], { type: 'image/jpeg' }),
      thumbBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
      width: 800,
      height: 1000,
      bytes: 4,
    })),
  };
});

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
  sessionStorage.clear();
  vi.mocked(compressImage).mockClear();
});

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/wardrobe/item/new']}>
      <Routes>
        <Route path="/wardrobe/item/new" element={<ItemFormPage />} />
        <Route path="/wardrobe/item/:id" element={<div>详情占位</div>} />
        <Route path="/wardrobe" element={<div>衣橱占位</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function pickCategory(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: /类型：/ }));
  await user.click(await screen.findByRole('button', { name }));
}

describe('ItemFormPage', () => {
  it('fills defaults and the auto name after choosing a category', async () => {
    const user = userEvent.setup();
    renderForm();

    await pickCategory(user, 'T 恤');

    expect(screen.getByLabelText('名称 *')).toHaveValue('白 T 恤');
    expect(screen.getByLabelText('正式度')).toHaveValue(2);
    expect(screen.getByLabelText('保暖')).toHaveValue(1);
    expect(screen.getByRole('button', { name: '春' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '冬' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a validation error when the name is empty', async () => {
    const user = userEvent.setup();
    renderForm();

    await pickCategory(user, '衬衫');
    await user.clear(screen.getByLabelText('名称 *'));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('请输入名称')).toBeInTheDocument();
    expect(await db.items.count()).toBe(0);
  });

  it('stores the price in cents and creates a purchase record', async () => {
    const user = userEvent.setup();
    renderForm();

    await pickCategory(user, '衬衫');
    const price = screen.getByLabelText('购买价格');
    await user.clear(price);
    await user.type(price, '199.5');
    await user.type(screen.getByLabelText('购买渠道'), '淘宝');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('详情占位')).toBeInTheDocument();
    const items = await db.items.toArray();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('白衬衫');
    const purchases = await db.purchases.toArray();
    expect(purchases).toHaveLength(1);
    expect(purchases[0].priceCents).toBe(19950);
    expect(purchases[0].channel).toBe('淘宝');
    expect(items[0].totalCostCents).toBe(19950);
  });

  it('compresses photos and stops at five', async () => {
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText('选择照片文件');
    for (let index = 0; index < 5; index += 1) {
      const file = new File([`fake-${index}`], `photo-${index}.jpg`, { type: 'image/jpeg' });
      await user.upload(input, file);
      await waitFor(() => expect(compressImage).toHaveBeenCalledTimes(index + 1));
    }

    expect(screen.queryByRole('button', { name: '添加照片' })).not.toBeInTheDocument();
  });

  it('keeps a draft after cancel and clears it after save', async () => {
    const user = userEvent.setup();
    const first = renderForm();

    await user.type(await screen.findByLabelText('名称 *'), '草稿衬衫');
    expect(sessionStorage.getItem('closet:draft:item:new')).toContain('草稿衬衫');

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(await screen.findByText('衣橱占位')).toBeInTheDocument();
    expect(sessionStorage.getItem('closet:draft:item:new')).toContain('草稿衬衫');

    first.unmount();
    renderForm();
    expect(await screen.findByLabelText('名称 *')).toHaveValue('草稿衬衫');

    await pickCategory(user, '衬衫');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('详情占位')).toBeInTheDocument();
    expect(sessionStorage.getItem('closet:draft:item:new')).toBeNull();
  });
});
