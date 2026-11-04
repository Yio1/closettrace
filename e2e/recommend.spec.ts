import { expect, test } from '@playwright/test';
import { addBasicWardrobe, completeOnboarding, openWardrobeItem } from './onboarding';

test('today recommends a basic outfit and records the wear count', async ({ page }) => {
  await completeOnboarding(page);
  await addBasicWardrobe(page);

  await page.goto('/');
  await expect(page.getByText('今日推荐')).toBeVisible();
  await page.getByRole('button', { name: '就穿这套' }).click({ timeout: 15_000 });

  await expect(page.getByRole('dialog', { name: /记录 .* 的穿着/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '白色 T 恤', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '保存穿着' }).click();

  await expect(page.getByText('今天已穿')).toBeVisible();
  await openWardrobeItem(page, '白色 T 恤');
  await expect(page.getByText('穿着 1 天')).toBeVisible();
});
