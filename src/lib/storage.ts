export interface StorageUsage {
  usage: number;
  quota: number;
  ratio: number;
}

export async function getStorageUsage(): Promise<StorageUsage | null> {
  if (typeof navigator.storage?.estimate !== 'function') return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  if (quota <= 0) return null;
  return { usage, quota, ratio: usage / quota };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
