import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { getSetting } from '../../db/repositories/settings';
import type { Sizes, StyleProfile } from '../../domain/profile';
import { StyleProfilePage } from './StyleProfilePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <StyleProfilePage />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
});

describe('StyleProfilePage', () => {
  it('starts empty and saves style preferences and sizes', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();

    expect(await screen.findByRole('heading', { name: '风格与尺码' })).toBeInTheDocument();

    const minimal = screen.getByRole('button', { name: '简约' });
    expect(minimal).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '白' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '正常' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('上装尺码')).toHaveValue('');

    await user.click(minimal);
    await user.click(screen.getByRole('button', { name: '白' }));
    await user.click(screen.getByRole('button', { name: '怕冷' }));
    await user.type(screen.getByLabelText('上装尺码'), 'M');
    await user.type(screen.getByLabelText('下装尺码'), '28');
    await user.type(screen.getByLabelText('鞋码'), '40');
    await user.type(screen.getByLabelText('连衣裙尺码'), 'M');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('已保存')).toBeInTheDocument();

    expect(await getSetting<StyleProfile>('styleProfile', {} as StyleProfile)).toMatchObject({
      styleTags: ['builtin:style:minimal'],
      favoriteColorIds: ['builtin:color:white'],
      tempSensitivity: 'cold',
    });
    expect(await getSetting<Sizes>('sizes', {})).toEqual({
      top: 'M',
      bottom: '28',
      shoes: '40',
      dress: 'M',
    });

    unmount();
    renderPage();

    expect(await screen.findByRole('button', { name: '简约' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '白' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '怕冷' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('上装尺码')).toHaveValue('M');
    expect(screen.getByLabelText('鞋码')).toHaveValue('40');
  });

  it('accepts an entirely empty profile', async () => {
    const user = userEvent.setup();
    renderPage();

    const heading = await screen.findByRole('heading', { name: '风格与尺码' });
    expect(heading).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('已保存')).toBeInTheDocument();

    const profile = await getSetting<StyleProfile>('styleProfile', {} as StyleProfile);
    expect(profile.styleTags).toEqual([]);
    expect(profile.favoriteColorIds).toEqual([]);
    expect(profile.tempSensitivity).toBe('normal');
    expect(await getSetting<Sizes>('sizes', {})).toEqual({});
  });
});
