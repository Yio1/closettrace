export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsArrayBuffer(file);
  });
  return new Uint8Array(buffer);
}

export async function saveFile(
  fileName: string,
  bytes: Uint8Array,
  mime: string,
): Promise<void> {
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: mime });

  if (typeof navigator.canShare === 'function' && typeof navigator.share === 'function') {
    const file = new File([blob], fileName, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
