import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { createItem } from '../../db/repositories/items';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { WardrobePage } from './WardrobePage';

beforeEach(async () => {
  await Promise.all([
    db.items.clear(),
    db.itemPhotos.clear(),
    db.categories.clear(),
    db.scenes.clear(),
    db.colors.clear(),
    db.styleTags.clear(),
    db.settings.clear(),
  ]);
  await seedDatabase(db);

  await createItem({
    name: '白色衬衫',
    categoryId: 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
    status: 'available',
  });
  await createItem({
    name: '运动短裤',
    categoryId: 'builtin:cat:shorts',
    colorPrimaryId: 'builtin:color:black',
    warmth: 1,
    formality: 2,
    seasons: ['summer'],
    status: 'laundry',
  });
  await createItem({
    name: '旧外套',
    categoryId: 'builtin:cat:jacket',
    colorPrimaryId: 'builtin:color:navy',
    warmth: 3,
    formality: 3,
    seasons: ['autumn'],
    status: 'retired',
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <WardrobePage />
    </MemoryRouter>,
  );
}

describe('WardrobePage', () => {
  it('hides retired items by default', async () => {
    renderPage();
    expect(await screen.findByText('白色衬衫')).toBeInTheDocument();
    expect(screen.getByText('运动短裤')).toBeInTheDocument();
    expect(screen.queryByText('旧外套')).not.toBeInTheDocument();
    expect(screen.getByText('2 件')).toBeInTheDocument();
  });

  it('searches by name', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('白色衬衫');

    await user.type(screen.getByLabelText('搜索衣橱'), '短裤');
    await waitFor(() => expect(screen.queryByText('白色衬衫')).not.toBeInTheDocument());
    expect(screen.getByText('运动短裤')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('白色衬衫');

    await user.click(screen.getByRole('button', { name: '待洗' }));
    await waitFor(() => expect(screen.queryByText('白色衬衫')).not.toBeInTheDocument());
    expect(screen.getByText('运动短裤')).toBeInTheDocument();
    expect(screen.getByText('1 件')).toBeInTheDocument();
  });

  it('enters selection mode and shows the batch bar', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('白色衬衫');

    await user.click(screen.getByRole('button', { name: '选择' }));
    await user.click(screen.getByRole('button', { name: /白色衬衫/ }));
    expect(screen.getByText('已选 1 件')).toBeInTheDocument();
  });
});
