import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/schema';
import { DiagnosticsPage } from './DiagnosticsPage';

beforeEach(async () => {
  await db.diagnostics.clear();
  await db.itemPhotos.clear();
});

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('DiagnosticsPage', () => {
  it('lists recent diagnostics and copies them as text', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    await db.diagnostics.bulkPut([
      {
        id: 'diag-1',
        at: '2026-01-01T10:00:00.000Z',
        level: 'error',
        message: '导入失败',
        context: 'timeout',
      },
      {
        id: 'diag-2',
        at: '2026-01-02T10:00:00.000Z',
        level: 'warn',
        message: '照片过大',
      },
    ]);

    render(<DiagnosticsPage />);

    expect(await screen.findByText('导入失败')).toBeInTheDocument();
    expect(screen.getByText('照片过大')).toBeInTheDocument();
    expect(screen.getByText('timeout')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '复制全部' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('导入失败');
    expect(text).toContain('照片过大');
    expect(await screen.findByText('已复制')).toBeInTheDocument();
  });

  it('clears diagnostics and shows the empty state', async () => {
    const user = userEvent.setup();
    await db.diagnostics.put({
      id: 'diag-1',
      at: '2026-01-01T10:00:00.000Z',
      level: 'warn',
      message: '测试警告',
    });

    render(<DiagnosticsPage />);
    await user.click(await screen.findByRole('button', { name: '清空' }));

    expect(await screen.findByText('还没有诊断记录')).toBeInTheDocument();
    expect(await db.diagnostics.count()).toBe(0);
  });
});
