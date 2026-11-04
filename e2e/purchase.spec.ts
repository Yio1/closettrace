import { expect, test, type Page } from '@playwright/test';
import { completeOnboarding } from './onboarding';

async function addQuote(page: Page, channel: string, price: string) {
  await page.getByRole('button', { name: '添加报价' }).click();
  const dialog = page.getByRole('dialog', { name: '添加报价' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('渠道').fill(channel);
  await dialog.getByLabel('价格', { exact: true }).fill(price);
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('wishlist finds the lowest quote, converts it to a purchase, and shows CPW', async ({
  page,
}) => {
  await completeOnboarding(page);

  await page.getByRole('link', { name: '采购', exact: true }).click();
  await expect(page.getByText('还没有待购记录')).toBeVisible();
  await page.getByRole('button', { name: '记一件想买' }).click();

  const form = page.getByRole('dialog', { name: '记一件想买' });
  await expect(form).toBeVisible();
  await form.getByLabel('名称').fill('黑色大衣');
  await form.getByLabel('类型', { exact: true }).selectOption({ label: '大衣' });
  await form.getByRole('button', { name: '保存', exact: true }).click();
  await expect(form).toBeHidden();

  await page.getByRole('link', { name: /黑色大衣/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '黑色大衣' })).toBeVisible();

  await addQuote(page, '淘宝', '520');
  await addQuote(page, '京东', '480');
  await addQuote(page, '官网', '500');

  const rows = page.getByTestId('quote-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('京东');
  await expect(rows.first()).toContainText('最低价');
  await expect(rows.first()).toContainText('¥480');

  await page.getByRole('link', { name: '标记已购' }).click();
  await expect(page.getByRole('heading', { name: '添加衣物' })).toBeVisible();
  await expect(page.getByLabel('名称 *')).toHaveValue('黑色大衣');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '黑色大衣' })).toBeVisible();
  await expect(page.getByText('¥480').first()).toBeVisible();

  await page.getByRole('link', { name: '采购', exact: true }).click();
  await page.getByRole('button', { name: '穿着成本', exact: true }).click();
  await expect(page.getByText('平均单次成本')).toBeVisible();
  await expect(page.getByTestId('zero-wear-list')).toContainText('黑色大衣');
});
