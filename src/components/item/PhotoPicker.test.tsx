import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ItemPhoto } from '../../domain/types';
import { PhotoPicker } from './PhotoPicker';

function photo(id: string, order = 0): ItemPhoto {
  return {
    id,
    itemId: 'item-1',
    blob: new Blob(['full'], { type: 'image/jpeg' }),
    thumbBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
    width: 1600,
    height: 1200,
    bytes: 4,
    order,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
}

describe('PhotoPicker', () => {
  it('shows an add tile when below the limit', () => {
    render(
      <PhotoPicker photos={[]} onAdd={vi.fn()} onRemove={vi.fn()} onSetCover={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: '添加照片' })).toBeInTheDocument();
  });

  it('hides the add tile at five photos', () => {
    render(
      <PhotoPicker
        photos={[photo('1'), photo('2'), photo('3'), photo('4'), photo('5')]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onSetCover={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '添加照片' })).not.toBeInTheDocument();
  });

  it('removes and sets a cover photo', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onSetCover = vi.fn();
    render(
      <PhotoPicker
        photos={[photo('1'), photo('2', 1)]}
        coverPhotoId="1"
        onAdd={vi.fn()}
        onRemove={onRemove}
        onSetCover={onSetCover}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: '设为封面' })[0]);
    expect(onSetCover).toHaveBeenCalledWith('2');

    await user.click(screen.getAllByRole('button', { name: '移除照片' })[1]);
    expect(onRemove).toHaveBeenCalledWith('2');
  });

  it('uploads a selected file and shows progress', async () => {
    const user = userEvent.setup();
    let resolveUpload: () => void = () => {};
    const onAdd = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    render(
      <PhotoPicker photos={[]} onAdd={onAdd} onRemove={vi.fn()} onSetCover={vi.fn()} />,
    );

    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('选择照片文件'), file);

    expect(onAdd).toHaveBeenCalledWith(file);
    expect(screen.getByText('处理中…')).toBeInTheDocument();

    resolveUpload();
    await waitFor(() => expect(screen.queryByText('处理中…')).not.toBeInTheDocument());
  });
});
