import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { getSetting } from '../../db/repositories/settings';
import { OnboardingPage } from './OnboardingPage';

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<div>今日首页</div>} />
        <Route path="/wardrobe/item/new" element={<div>新增衣物</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
});

describe('OnboardingPage', () => {
  it('renders the privacy-first welcome step', async () => {
    renderOnboarding();

    expect(await screen.findByText('把衣橱录清楚，穿得更明白')).toBeInTheDocument();
    expect(screen.getByText(/只保存在这台设备上/)).toBeInTheDocument();
    expect(screen.getByText(/第 1 \/ 6 步/)).toBeInTheDocument();
  });

  it('skip all marks onboarding done without creating garments or locations', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(await screen.findByRole('button', { name: '跳过全部' }));

    await waitFor(async () => {
      expect(await getSetting<boolean>('onboardingDone', false)).toBe(true);
    });
    expect(await db.items.count()).toBe(0);
    expect(await db.locations.count()).toBe(0);
    expect(await db.wearLogs.count()).toBe(0);
    expect(await screen.findByText('今日首页')).toBeInTheDocument();
  });

  it('creates the recommended location tree only on explicit click', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await screen.findByText(/第 1 \/ 6 步/);
    await user.click(screen.getByRole('button', { name: '跳过这步' }));
    await user.click(screen.getByRole('button', { name: '跳过这步' }));
    await user.click(screen.getByRole('button', { name: '跳过这步' }));

    expect(await screen.findByText('卧室 / 主衣柜')).toBeInTheDocument();
    expect(await db.locations.count()).toBe(0);

    await user.click(screen.getByRole('button', { name: '一键创建推荐结构' }));

    await waitFor(async () => {
      expect(await db.locations.count()).toBe(6);
    });
    expect(await screen.findByText('已创建推荐位置')).toBeInTheDocument();
  });

  it('add first item finishes onboarding and opens the item form', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await screen.findByText(/第 1 \/ 6 步/);
    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole('button', { name: '跳过这步' }));
    }
    await user.click(await screen.findByRole('button', { name: '去添加第一件' }));

    expect(await screen.findByText('新增衣物')).toBeInTheDocument();
    expect(await getSetting<boolean>('onboardingDone', false)).toBe(true);
    expect(await db.items.count()).toBe(0);
  });
});
