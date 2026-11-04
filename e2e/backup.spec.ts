import { expect, test } from '@playwright/test';
import { addItem, BASE_URL, completeOnboarding } from './onboarding';

test('a data-only backup can be imported into a clean profile', async ({
  page,
  browser,
}, testInfo) => {
  await completeOnboarding(page);
  await addItem(page, { name: '白色衬衫', category: '衬衫' });

  await page.goto('/me/backup');
  await expect(page.getByRole('heading', { name: '备份与恢复' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '仅导出数据' }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('backup.zip');
  await download.saveAs(backupPath);

  const cleanContext = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  });
  const cleanPage = await cleanContext.newPage();
  try {
    await cleanPage.goto(BASE_URL);
    await expect(cleanPage.getByRole('button', { name: '跳过全部' })).toBeVisible();
    await cleanPage.getByRole('button', { name: '跳过全部' }).click();

    await cleanPage.goto(`${BASE_URL}/me/backup`);
    await cleanPage.getByLabel('选择备份文件').setInputFiles(backupPath);

    const preview = cleanPage.getByRole('dialog', { name: '导入备份' });
    await expect(preview).toBeVisible();
    await expect(preview.getByText('单品 1 件')).toBeVisible();
    await expect(preview.getByText('照片未包含在此备份中，可重新添加')).toBeVisible();

    await preview.getByRole('button', { name: '合并', exact: true }).click();
    await preview.getByRole('button', { name: '开始导入' }).click();
    await expect(cleanPage.getByRole('status')).toContainText('导入完成：1 件单品');

    await cleanPage.goto(`${BASE_URL}/wardrobe`);
    await expect(cleanPage.getByRole('button', { name: /白色衬衫/ })).toBeVisible();
  } finally {
    await cleanContext.close();
  }
});
