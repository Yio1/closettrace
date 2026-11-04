import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { listScenes } from '../../db/repositories/scenes';
import { ScenesPage } from './ScenesPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ScenesPage />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedDatabase(db);
});

describe('ScenesPage', () => {
  it('lists built-in scenes as read-only', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '场景管理' })).toBeInTheDocument();
    expect(await screen.findByText('通勤')).toBeInTheDocument();
    expect(screen.getByText('商务/正式')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑 通勤/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /归档 通勤/ })).not.toBeInTheDocument();
  });

  it('creates a custom scene and archives it', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: '新建场景' }));
    const dialog = screen.getByRole('dialog', { name: '新建场景' });
    await user.type(within(dialog).getByLabelText('名称'), '周末露营');
    await user.click(within(dialog).getByRole('button', { name: '休闲' }));
    await user.click(within(dialog).getByRole('button', { name: '保存' }));

    expect(
      await screen.findByRole('button', { name: '归档 周末露营' }),
    ).toBeInTheDocument();

    const created = (await listScenes(true, db)).find((scene) => scene.name === '周末露营');
    expect(created).toMatchObject({
      formalityMin: 2,
      formalityMax: 3,
      requiredSlots: ['top', 'bottom', 'shoes'],
      styleTags: ['builtin:style:casual'],
      isBuiltIn: false,
      archived: false,
    });

    await user.click(screen.getByRole('button', { name: '归档 周末露营' }));

    await waitFor(() => expect(screen.queryByText('周末露营')).not.toBeInTheDocument());
    expect((await listScenes(true, db)).find((scene) => scene.id === created?.id)?.archived).toBe(
      true,
    );
    expect((await listScenes(false, db)).some((scene) => scene.id === created?.id)).toBe(false);
  });

  it('edits a custom scene', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: '新建场景' }));
    const dialog = screen.getByRole('dialog', { name: '新建场景' });
    await user.type(within(dialog).getByLabelText('名称'), '聚会');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));
    await user.click(await screen.findByRole('button', { name: '编辑 聚会' }));
    const editDialog = screen.getByRole('dialog', { name: '编辑场景' });
    const nameInput = within(editDialog).getByLabelText('名称');
    await user.clear(nameInput);
    await user.type(nameInput, '朋友聚会');
    await user.click(within(editDialog).getByRole('button', { name: '保存' }));

    expect(await screen.findByText('朋友聚会')).toBeInTheDocument();
  });
});
