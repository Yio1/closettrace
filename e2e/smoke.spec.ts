import { expect, test } from '@playwright/test';
import { fillItemForm } from './onboarding';

test('onboarding skips to an empty wardrobe and the first item persists', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '跳过全部' })).toBeVisible();
  await page.getByRole('button', { name: '跳过全部' }).click();
  await expect(page.getByText('先添加第一件衣服')).toBeVisible();

  await page.getByRole('link', { name: '衣橱', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '衣橱', exact: true })).toBeVisible();
  await expect(page.getByText('衣橱还是空的')).toBeVisible();

  await page.getByRole('button', { name: '添加第一件' }).click();
  await expect(page.getByRole('heading', { name: '添加衣物' })).toBeVisible();
  await fillItemForm(page, { name: '白色衬衫', category: '衬衫' });

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '白色衬衫' })).toBeVisible();
  await expect(page.getByText('穿着 0 天')).toBeVisible();
});
