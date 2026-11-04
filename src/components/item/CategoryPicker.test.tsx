import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/schema';
import { seedDatabase } from '../../db/seed';
import { CategoryPicker } from './CategoryPicker';

beforeEach(async () => {
  await db.categories.clear();
  await db.settings.clear();
  await seedDatabase(db);
});

describe('CategoryPicker', () => {
  it('selects a leaf category', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CategoryPicker onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: '类型：未选择' }));
    expect(await screen.findByRole('heading', { name: '选择类型' })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: '衬衫' }));
    expect(onChange).toHaveBeenCalledWith('builtin:cat:shirt');
  });

  it('filters categories by search', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CategoryPicker onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: '类型：未选择' }));
    await user.type(await screen.findByLabelText('搜索类型'), '牛仔');
    await user.click(await screen.findByRole('button', { name: '牛仔裤' }));
    expect(onChange).toHaveBeenCalledWith('builtin:cat:jeans');
  });
});
