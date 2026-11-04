import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { getSetting, setSetting } from '../../db/repositories/settings';
import * as backupRepo from '../../db/repositories/backup';
import * as fileLib from '../../lib/file';
import { exportBackupZip, photoFileName } from '../../domain/backup';
import { emptyBackupData, manifestFor } from '../../test/fixtures/backup-v1';
import { makeItem } from '../../test/fixtures/wardrobe';
import type { Outfit, OutfitItem, WearLog } from '../../domain/types';
import { BackupPage } from './BackupPage';

vi.mock('../../db/repositories/backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../db/repositories/backup')>();
  return { ...actual, buildBackup: vi.fn(), importBackup: vi.fn() };
});

vi.mock('../../lib/file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/file')>();
  return { ...actual, saveFile: vi.fn() };
});

const buildBackupMock = vi.mocked(backupRepo.buildBackup);
const importBackupMock = vi.mocked(backupRepo.importBackup);
const saveFileMock = vi.mocked(fileLib.saveFile);

function renderPage() {
  return render(
    <MemoryRouter>
      <BackupPage />
    </MemoryRouter>,
  );
}

function sampleBundle(includePhotos = false) {
  const data = emptyBackupData();
  data.items = [
    makeItem({
      id: 'item-1',
      name: '白衬衫',
      categoryId: 'builtin:cat:shirt',
      colorPrimaryId: 'builtin:color:white',
    }),
    makeItem({
      id: 'item-2',
      name: '旧外套',
      categoryId: 'builtin:cat:coat',
      colorPrimaryId: 'builtin:color:navy',
      status: 'retired',
    }),
  ];
  data.outfits = [
    {
      id: 'outfit-1',
      name: '通勤',
      sceneIds: [],
      isFavorite: false,
      source: 'manual',
      wearCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies Outfit,
  ];
  data.outfitItems = [
    {
      id: 'outfit-item-1',
      outfitId: 'outfit-1',
      itemId: 'item-1',
      slot: 'top',
      order: 0,
    } satisfies OutfitItem,
  ];
  data.wearLogs = [
    {
      id: 'wear-1',
      date: '2026-01-01',
      itemIds: ['item-1'],
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    } satisfies WearLog,
  ];
  if (includePhotos) {
    data.itemPhotos = [
      {
        id: 'photo-1',
        itemId: 'item-1',
        width: 800,
        height: 600,
        bytes: 2048,
        order: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        fileName: photoFileName('photo-1'),
        thumbName: 'thumbs/photo-1.jpg',
      },
    ];
  }
  return {
    manifest: manifestFor(data, { includesPhotos: includePhotos }),
    data,
    photos: includePhotos
      ? new Map([[photoFileName('photo-1'), new Uint8Array([1, 2, 3])]])
      : new Map<string, Uint8Array>(),
  };
}

function uploadFile(bundle: ReturnType<typeof sampleBundle>) {
  const bytes = new Uint8Array(exportBackupZip(bundle));
  return new File([bytes.buffer], 'backup.zip', { type: 'application/zip' });
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
  localStorage.clear();
  buildBackupMock.mockReset();
  importBackupMock.mockReset();
  saveFileMock.mockReset();
  saveFileMock.mockResolvedValue(undefined);
});

describe('BackupPage', () => {
  it('exports a complete backup and records the backup time', async () => {
    const user = userEvent.setup();
    buildBackupMock.mockResolvedValue(sampleBundle(true));
    renderPage();

    await user.click(await screen.findByRole('button', { name: '导出完整备份' }));

    await waitFor(() => expect(buildBackupMock).toHaveBeenCalledWith(db, { includePhotos: true }));
    expect(saveFileMock).toHaveBeenCalledTimes(1);
    const [fileName, bytes, mime] = saveFileMock.mock.calls[0];
    expect(fileName).toMatch(/^closettrace-backup-\d{8}-\d{4}\.zip$/);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(mime).toBe('application/zip');
    await waitFor(async () => expect(await getSetting('lastBackupAt', null)).toBeTruthy());
    expect(await screen.findByText(/已导出/)).toBeInTheDocument();
  });

  it('exports data only when that option is chosen', async () => {
    const user = userEvent.setup();
    buildBackupMock.mockResolvedValue(sampleBundle(false));
    renderPage();

    await user.click(await screen.findByRole('button', { name: '仅导出数据' }));

    await waitFor(() => expect(buildBackupMock).toHaveBeenCalledWith(db, { includePhotos: false }));
  });

  it('previews an import and requires choosing a mode', async () => {
    const user = userEvent.setup();
    const bundle = sampleBundle(false);
    renderPage();

    await user.upload(screen.getByLabelText('选择备份文件'), uploadFile(bundle));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('单品 2 件')).toBeInTheDocument();
    expect(within(dialog).getByText('搭配 1 套')).toBeInTheDocument();
    expect(within(dialog).getByText('穿着记录 1 条')).toBeInTheDocument();
    expect(within(dialog).getByText('照片 0 张 · 0 B')).toBeInTheDocument();
    expect(within(dialog).getByText('含 1 件已移出衣物')).toBeInTheDocument();
    expect(
      within(dialog).getByText('照片未包含在此备份中，可重新添加'),
    ).toBeInTheDocument();

    const confirm = within(dialog).getByRole('button', { name: '开始导入' });
    expect(confirm).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: '合并' }));
    expect(confirm).toBeEnabled();

    importBackupMock.mockResolvedValue({
      mode: 'merge',
      items: 2,
      outfits: 1,
      wearLogs: 1,
      photos: 0,
      missingPhotos: 0,
    });
    await user.click(confirm);

    await waitFor(() => expect(importBackupMock).toHaveBeenCalledTimes(1));
    expect(importBackupMock.mock.calls[0][0]).toBe(db);
    expect(importBackupMock.mock.calls[0][2]).toBe('merge');
    expect(await screen.findByText(/导入完成/)).toBeInTheDocument();
  });

  it('requires confirmation before replacing all data', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(screen.getByLabelText('选择备份文件'), uploadFile(sampleBundle()));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: '替换全部' }));
    const confirm = within(dialog).getByRole('button', { name: '开始导入' });
    expect(confirm).toBeDisabled();

    await user.click(within(dialog).getByLabelText('我知道替换会清空当前数据'));
    expect(confirm).toBeEnabled();
  });

  it('shows photo size and no warning when the backup includes photos', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(screen.getByLabelText('选择备份文件'), uploadFile(sampleBundle(true)));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('照片 1 张 · 2.0 KB')).toBeInTheDocument();
    expect(
      within(dialog).queryByText('照片未包含在此备份中，可重新添加'),
    ).not.toBeInTheDocument();
  });

  it('shows a reminder when the last backup is older than the interval', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 40);
    await setSetting('backupReminderDays', 30);
    await setSetting('lastBackupAt', old.toISOString());

    renderPage();

    expect(
      await screen.findByText(/距上次备份已 \d+ 天，建议现在导出/),
    ).toBeInTheDocument();
  });

  it('does not show a reminder for a recent backup', async () => {
    await setSetting('backupReminderDays', 30);
    await setSetting('lastBackupAt', new Date().toISOString());

    renderPage();

    expect(await screen.findByText('备份与恢复')).toBeInTheDocument();
    expect(screen.queryByText(/建议现在导出/)).not.toBeInTheDocument();
  });
});
