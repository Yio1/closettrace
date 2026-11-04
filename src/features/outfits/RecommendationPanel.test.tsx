import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Item } from '../../domain/types';
import type { Recommendation } from '../../domain/recommend';
import { recommend } from '../../domain/recommend';
import { createItem } from '../../db/repositories/items';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { RecommendationPanel } from './RecommendationPanel';

vi.mock('../../domain/recommend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/recommend')>();
  return { ...actual, recommend: vi.fn() };
});

const recommendMock = vi.mocked(recommend);
const COMMUTE = 'builtin:scene:commute';

interface Fixture {
  shirt: Item;
  trousers: Item;
  loafers: Item;
}

async function createWardrobe(): Promise<Fixture> {
  const shirtId = await createItem({
    name: '白衬衫',
    categoryId: 'builtin:cat:shirt',
    colorPrimaryId: 'builtin:color:white',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });
  const trousersId = await createItem({
    name: '黑西裤',
    categoryId: 'builtin:cat:dress-pants',
    colorPrimaryId: 'builtin:color:black',
    warmth: 2,
    formality: 4,
    seasons: ['all'],
  });
  const loafersId = await createItem({
    name: '棕色乐福鞋',
    categoryId: 'builtin:cat:loafers',
    colorPrimaryId: 'builtin:color:brown',
    warmth: 2,
    formality: 3,
    seasons: ['all'],
  });

  return {
    shirt: (await db.items.get(shirtId))!,
    trousers: (await db.items.get(trousersId))!,
    loafers: (await db.items.get(loafersId))!,
  };
}

function recommendation(items: Item[], score: number, reason: string): Recommendation {
  return {
    signature: [...items.map((item) => item.id)].sort().join('|'),
    items,
    score,
    reasons: [reason, '中性色组合，搭配稳定。'],
    relaxed: [],
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
  recommendMock.mockReset();
});

function renderPanel(initialSceneId: string = COMMUTE) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <RecommendationPanel open onClose={() => undefined} initialSceneId={initialSceneId} />
          }
        />
        <Route path="/outfits/:id" element={<div>搭配详情</div>} />
        <Route path="/wardrobe/item/new" element={<div>添加衣物</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RecommendationPanel', () => {
  it('shows scene, temperature, reasons, and result actions', async () => {
    const wardrobe = await createWardrobe();
    recommendMock.mockReturnValue([
      recommendation([wardrobe.shirt, wardrobe.trousers, wardrobe.loafers], 93, '通勤场景的正式度匹配。'),
      recommendation([wardrobe.shirt, wardrobe.trousers], 88, '颜色搭配协调。'),
    ]);
    renderPanel();

    expect(await screen.findByText('衣迹推荐')).toBeInTheDocument();
    expect(await screen.findByText('通勤场景的正式度匹配。')).toBeInTheDocument();
    expect(screen.getByLabelText('温度')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '体感偏好' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '换一套' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '穿这套' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '保存' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '不喜欢' })).toHaveLength(2);
  });

  it('regenerates with a different seed', async () => {
    await createWardrobe();
    recommendMock.mockReturnValue([]);
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(recommendMock).toHaveBeenCalled());
    const firstSeed = recommendMock.mock.calls.at(-1)?.[0].seed;

    await user.click(screen.getByRole('button', { name: '换一套' }));

    await waitFor(() =>
      expect(recommendMock.mock.calls.at(-1)?.[0].seed).not.toBe(firstSeed),
    );
  });

  it('records a dislike for the recommendation signature', async () => {
    const wardrobe = await createWardrobe();
    const result = recommendation(
      [wardrobe.shirt, wardrobe.trousers, wardrobe.loafers],
      93,
      '通勤场景的正式度匹配。',
    );
    recommendMock.mockReturnValue([result]);
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('通勤场景的正式度匹配。');
    await user.click(screen.getByRole('button', { name: '不喜欢' }));

    await waitFor(async () => expect(await db.outfitFeedback.count()).toBe(1));
    const rows = await db.outfitFeedback.toArray();
    expect(rows[0]).toMatchObject({
      signature: result.signature,
      rating: 'dislike',
      sceneId: COMMUTE,
    });
  });

  it('saves a recommendation as an outfit', async () => {
    const wardrobe = await createWardrobe();
    recommendMock.mockReturnValue([
      recommendation(
        [wardrobe.shirt, wardrobe.trousers, wardrobe.loafers],
        93,
        '通勤场景的正式度匹配。',
      ),
    ]);
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('通勤场景的正式度匹配。');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(async () => expect(await db.outfits.count()).toBe(1));
    const outfit = (await db.outfits.toArray())[0];
    expect(outfit.source).toBe('recommended');
    expect(outfit.sceneIds).toEqual([COMMUTE]);
    expect(outfit.name).toContain('白衬衫');
    expect(await db.outfitItems.count()).toBe(3);
    expect(await screen.findByText('搭配详情')).toBeInTheDocument();
  });

  it('shows the missing slot and an add link', async () => {
    await createItem({
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
      warmth: 2,
      formality: 3,
      seasons: ['all'],
    });
    await createItem({
      name: '黑西裤',
      categoryId: 'builtin:cat:dress-pants',
      colorPrimaryId: 'builtin:color:black',
      warmth: 2,
      formality: 3,
      seasons: ['all'],
    });
    recommendMock.mockReturnValue([]);
    renderPanel();

    expect(await screen.findByText('还缺鞋')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去添加' })).toHaveAttribute(
      'href',
      '/wardrobe/item/new',
    );
  });
});
