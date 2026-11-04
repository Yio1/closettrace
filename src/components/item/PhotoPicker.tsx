import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Loader2, Plus, Star, X } from 'lucide-react';
import type { ItemPhoto } from '../../domain/types';

export interface PhotoPickerProps {
  photos: ItemPhoto[];
  onAdd: (file: File) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  onSetCover: (id: string) => void | Promise<void>;
  coverPhotoId?: string;
  max?: number;
}

export function PhotoPicker({
  photos,
  onAdd,
  onRemove,
  onSetCover,
  coverPhotoId,
  max = 5,
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const photo of photos) {
      next[photo.id] = URL.createObjectURL(photo.thumbBlob);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs are an external resource
    setThumbs(next);
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
  }, [photos]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await onAdd(file);
    } finally {
      setUploading(false);
    }
  }

  const canAdd = photos.length < max;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-square overflow-hidden rounded-xl border border-line bg-bg"
          >
            {thumbs[photo.id] ? (
              <img src={thumbs[photo.id]} alt="衣物照片" className="h-full w-full object-cover" />
            ) : null}
            {coverPhotoId === photo.id ? (
              <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                封面
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-black/45 p-1">
              {coverPhotoId !== photo.id ? (
                <button
                  type="button"
                  aria-label="设为封面"
                  onClick={() => onSetCover(photo.id)}
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-white active:bg-white/20"
                >
                  <Star size={16} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                aria-label="移除照片"
                onClick={() => onRemove(photo.id)}
                className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-white active:bg-white/20"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          </div>
        ))}

        {canAdd ? (
          <button
            type="button"
            aria-label="添加照片"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-field-line text-muted disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 size={22} className="animate-spin" aria-hidden />
            ) : (
              <Plus size={22} aria-hidden />
            )}
            <span className="text-xs">{uploading ? '处理中…' : '添加照片'}</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="选择照片文件"
        className="sr-only"
        onChange={handleFile}
      />
    </div>
  );
}
