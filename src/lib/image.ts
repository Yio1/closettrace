export interface CompressedPhoto {
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
  bytes: number;
}

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

const FULL_EDGE = 1600;
const THUMB_EDGE = 320;
const MAX_FULL_BYTES = 600 * 1024;
const QUALITIES = [0.82, 0.72, 0.65];

export function fitDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= maxEdge && height <= maxEdge) return { width, height };
  const scale = maxEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path for browsers or formats without bitmap support.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageError('无法读取这张照片，请换一张重试');
  }
}

function draw(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('当前浏览器无法处理图片');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageError('图片压缩失败，请重试'));
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function compressImage(file: File): Promise<CompressedPhoto> {
  const decoded = await decode(file);
  try {
    const full = fitDimensions(decoded.width, decoded.height, FULL_EDGE);
    const fullCanvas = draw(decoded.source, full.width, full.height);

    let blob = await toJpeg(fullCanvas, QUALITIES[0]);
    for (const quality of QUALITIES.slice(1)) {
      if (blob.size <= MAX_FULL_BYTES) break;
      blob = await toJpeg(fullCanvas, quality);
    }

    const thumb = fitDimensions(decoded.width, decoded.height, THUMB_EDGE);
    const thumbBlob = await toJpeg(draw(decoded.source, thumb.width, thumb.height), 0.7);

    return {
      blob,
      thumbBlob,
      width: full.width,
      height: full.height,
      bytes: blob.size,
    };
  } finally {
    decoded.cleanup();
  }
}
