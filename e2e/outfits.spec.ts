import { expect, test } from '@playwright/test';
import { addBasicWardrobe, completeOnboarding, openWardrobeItem } from './onboarding';

test('manual outfit can be favorited, worn, and deleted without losing wear history', async ({
  page,
}) => {
  await completeOnboarding(page);
  await addBasicWardrobe(page);

  await page.goto('/outfits/new');
  await expect(page.getByRole('heading', { name: '新建搭配' })).toBeVisible();

  await page.getByLabel('搭配名称').fill('周末休闲');
  await page.getByRole('button', { name: '选择上装' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /白色 T 恤/ }).click();
  await page.getByRole('button', { name: '选择下装' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /蓝色牛仔裤/ }).click();
  await page.getByRole('button', { name: '选择鞋' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /白色板鞋/ }).click();

  await page.getByRole('button', { name: '保存搭配' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '周末休闲' })).toBeVisible();

  await page.getByRole('button', { name: '收藏', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible();

  await page.getByRole('button', { name: '穿这套' }).click();
  await expect(page.getByText('已记录今天的穿着。')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除搭配' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '搭配', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '周末休闲' })).toHaveCount(0);

  await openWardrobeItem(page, '白色 T 恤');
  await expect(page.getByText('穿着 1 天')).toBeVisible();
});
