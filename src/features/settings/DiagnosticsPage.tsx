import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { clearDiagnostics, listDiagnostics } from '../../db/repositories/diagnostics';
import { formatBytes, getStorageUsage, type StorageUsage } from '../../lib/storage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

const MAX_ENTRIES = 50;

export function DiagnosticsPage() {
  const entries = useLiveQuery(() => listDiagnostics(), []);
  const photos = useLiveQuery(() => db.itemPhotos.toArray(), []);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    getStorageUsage()
      .then((usage) => {
        if (!cancelled) setStorage(usage);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = (entries ?? []).slice(0, MAX_ENTRIES);
  const photoRows = photos ?? [];
  const photoBytes = photoRows.reduce((sum, photo) => sum + photo.bytes, 0);

  async function copyAll() {
    if (!navigator.clipboard?.writeText) {
      setStatus('当前环境不支持复制');
      return;
    }
    const text = visible
      .map((entry) => {
        const context = entry.context ? `\n${entry.context}` : '';
        return `${entry.at} [${entry.level}] ${entry.message}${context}`;
      })
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setStatus('已复制');
    } catch {
      setStatus('复制失败，请手动选择文本');
    }
  }

  async function clearAll() {
    await clearDiagnostics();
    setStatus('已清空');
  }

  return (
    <div>
      <PageHeader title="存储与诊断" subtitle="检查本地空间和最近的错误记录" />

      <Card>
        <h2 className="text-base font-semibold">存储用量</h2>
        <p className="mt-1 text-sm text-muted">
          照片 {photoRows.length} 张 · {formatBytes(photoBytes)}
        </p>
        {storage ? (
          <>
            <p className="mt-2 text-sm">
              已用 {formatBytes(storage.usage)} / {formatBytes(storage.quota)}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
              <div
                className={`h-full rounded-full ${
                  storage.ratio >= 0.8 ? 'bg-danger-fill' : 'bg-accent'
                }`}
                style={{ width: `${Math.min(100, Math.round(storage.ratio * 100))}%` }}
              />
            </div>
            {storage.ratio >= 0.8 ? (
              <p className="mt-2 text-sm text-danger-text">
                存储空间已用超过 80%，建议导出备份后清理照片。
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">当前浏览器不提供存储配额信息。</p>
        )}
      </Card>

      <Card className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">最近诊断</h2>
          {visible.length > 0 ? (
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => void copyAll()}>
                复制全部
              </Button>
              <Button variant="ghost" onClick={() => void clearAll()}>
                清空
              </Button>
            </div>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <EmptyState title="还没有诊断记录" description="出现异常时，错误信息会记录在这里。" />
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {visible.map((entry) => (
              <li key={entry.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span>{entry.at.replace('T', ' ').slice(0, 16)}</span>
                  <span className={entry.level === 'error' ? 'text-danger-text' : ''}>
                    {entry.level === 'error' ? '错误' : '警告'}
                  </span>
                </p>
                <p className="mt-1">{entry.message}</p>
                {entry.context ? (
                  <p className="mt-0.5 break-all text-xs text-muted">{entry.context}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {status ? (
          <p className="mt-3 text-sm text-accent-text" role="status">
            {status}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
