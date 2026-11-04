import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../app/ThemeProvider';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { createItem } from '../../db/repositories/items';
import { setSetting } from '../../db/repositories/settings';
import { MePage } from './MePage';

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <MePage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  localStorage.clear();
  await seedDatabase(db);
  await createItem({
    name: '白色衬衫',
    categoryId: 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });
  await createItem({
    name: '黑色西裤',
    categoryId: 'builtin:cat:trousers',
    colorPrimaryId: 'builtin:color:black',
    warmth: 3,
    formality: 4,
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

describe('MePage', () => {
  it('shows wardrobe counts and all settings entries', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '我的' })).toBeInTheDocument();
    expect(await screen.findByText('2 件')).toBeInTheDocument();
    expect(await screen.findByText(/已移出 1 件/)).toBeInTheDocument();

    for (const label of [
      '风格与尺码',
      '场景管理',
      '类型管理',
      '位置管理',
      '备份与恢复',
      '存储与诊断',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByRole('group', { name: '主题' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /位置管理/ })).toHaveAttribute(
      'href',
      '/wardrobe/locations',
    );
  });

  it('shows backup status from local settings', async () => {
    await setSetting('backupReminderDays', 14);
    await setSetting('lastBackupAt', '2026-11-02T03:00:00.000Z');

    renderPage();

    expect(await screen.findByText(/11月2日/)).toBeInTheDocument();
    expect(screen.getByText('提醒间隔：每 14 天')).toBeInTheDocument();
  });

  it('persists the theme choice locally and links nowhere external', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(await screen.findByRole('button', { name: '深色' }));

    expect(localStorage.getItem('closet:theme')).toBe('dark');
    expect(container.querySelectorAll('a[href^="http"]')).toHaveLength(0);
    expect(container.querySelectorAll('img[src^="http"]')).toHaveLength(0);
  });
});
