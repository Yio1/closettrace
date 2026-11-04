import { expect, type Page } from '@playwright/test';

export const BASE_URL = 'http://127.0.0.1:4173';

export async function completeOnboarding(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '跳过全部' })).toBeVisible();
  await page.getByRole('button', { name: '跳过全部' }).click();
  await expect(page.getByText('先添加第一件衣服')).toBeVisible();
}

export interface ItemSeed {
  name: string;
  category: string;
}

export async function fillItemForm(page: Page, seed: ItemSeed) {
  await page.getByLabel('名称 *').fill(seed.name);
  await page.getByRole('button', { name: '类型：未选择' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: seed.category, exact: true })
    .click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: seed.name })).toBeVisible();
}

export async function addItem(page: Page, seed: ItemSeed) {
  await page.goto('/wardrobe/item/new');
  await expect(page.getByRole('heading', { name: '添加衣物' })).toBeVisible();
  await fillItemForm(page, seed);
}

export async function openWardrobeItem(page: Page, name: string) {
  await page.goto('/wardrobe');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

export async function addBasicWardrobe(page: Page) {
  await addItem(page, { name: '白色 T 恤', category: 'T 恤' });
  await addItem(page, { name: '蓝色牛仔裤', category: '牛仔裤' });
  await addItem(page, { name: '白色板鞋', category: '板鞋' });
}
