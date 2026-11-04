import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocation, listLocations } from '../../db/repositories/locations';
import { db } from '../../db/schema';
import { LocationPicker } from './LocationPicker';

let rail: string;

beforeEach(async () => {
  await Promise.all([db.locations.clear(), db.items.clear()]);
  const bedroom = await createLocation({ name: '卧室' });
  const wardrobe = await createLocation({ name: '主衣柜', parentId: bedroom });
  rail = await createLocation({ name: '挂杆', parentId: wardrobe });
});

describe('LocationPicker', () => {
  it('shows the full path of the selected location', async () => {
    render(<LocationPicker value={rail} onChange={vi.fn()} />);
    expect(
      await screen.findByRole('button', { name: '存放位置：卧室 / 主衣柜 / 挂杆' }),
    ).toBeInTheDocument();
  });

  it('can clear the location', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LocationPicker value={rail} onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: /存放位置：卧室/ }));
    await user.click(await screen.findByRole('button', { name: '未指定' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('creates a location inline', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LocationPicker onChange={onChange} allowCreate />);

    await user.click(await screen.findByRole('button', { name: '存放位置：未指定' }));
    await user.click(await screen.findByRole('button', { name: '新建位置' }));
    await user.type(await screen.findByLabelText('位置名称'), '玄关鞋柜');
    await user.click(screen.getByRole('button', { name: '保存位置' }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const locations = await listLocations();
    expect(locations.some((location) => location.name === '玄关鞋柜')).toBe(true);
  });
});
