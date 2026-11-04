import { useEffect, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { diffDays, formatDateZh, toISODate, todayISO } from '../../domain/date';
import {
  backupFileName,
  exportBackupZip,
  validateBackup,
  type BackupBundle,
} from '../../domain/backup';
import { db } from '../../db/schema';
import { buildBackup, importBackup, type BackupMode } from '../../db/repositories/backup';
import { logDiagnostic } from '../../db/repositories/diagnostics';
import { getSetting, setSetting } from '../../db/repositories/settings';
import { readFileBytes, saveFile } from '../../lib/file';
import { formatBytes, getStorageUsage, type StorageUsage } from '../../lib/storage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Sheet } from '../../components/ui/Sheet';

export function BackupPage() {
  const lastBackupAt = useLiveQuery(() => getSetting<string | null>('lastBackupAt', null), []);
  const reminderDays = useLiveQuery(() => getSetting<number>('backupReminderDays', 30), []);
  const photos = useLiveQuery(() => db.itemPhotos.toArray(), []);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [busy, setBusy] = useState<'export' | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<BackupBundle | null>(null);
  const [mode, setMode] = useState<BackupMode | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);

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

  const photoRows = photos ?? [];
  const photoBytes = photoRows.reduce((sum, photo) => sum + photo.bytes, 0);
  const today = todayISO();
  const settingsLoaded = lastBackupAt !== undefined && reminderDays !== undefined;
  const lastBackupDate = lastBackupAt ? toISODate(new Date(lastBackupAt)) : null;
  const elapsed = lastBackupDate ? diffDays(lastBackupDate, today) : null;
  const interval = reminderDays ?? 30;
  const needsReminder = settingsLoaded && interval > 0 && (elapsed === null || elapsed >= interval);

  async function exportBackup(includePhotos: boolean) {
    setBusy('export');
    setError('');
    setStatus('');
    try {
      const bundle = await buildBackup(db, { includePhotos });
      const bytes = exportBackupZip(bundle, includePhotos);
      const fileName = backupFileName();
      await saveFile(fileName, bytes, 'application/zip');
      await setSetting('lastBackupAt', new Date().toISOString());
      setStatus(`已导出 ${fileName}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '导出失败';
      setError(`导出失败：${message}`);
      void logDiagnostic('error', '导出备份失败', message);
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setStatus('');
    try {
      const bundle = await validateBackup(await readFileBytes(file));
      setPreview(bundle);
      setMode(null);
      setConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取备份文件');
    }
  }

  function closePreview() {
    setPreview(null);
    setMode(null);
    setConfirmed(false);
    setError('');
  }

  async function confirmImport() {
    if (!preview || !mode) return;
    setImporting(true);
    setError('');
    try {
      const summary = await importBackup(db, preview, mode);
      setPreview(null);
      setMode(null);
      setConfirmed(false);
      let message = `导入完成：${summary.items} 件单品、${summary.outfits} 套搭配、${summary.wearLogs} 条穿着记录`;
      if (summary.missingPhotos > 0) {
        message += `；${summary.missingPhotos} 张照片未包含在备份中，可稍后重新添加`;
      }
      setStatus(message);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '导入失败';
      setError(`导入失败：${message}`);
      void logDiagnostic('error', '导入备份失败', message);
    } finally {
      setImporting(false);
    }
  }

  const previewInfo = preview
    ? {
        items: preview.data.items.length,
        outfits: preview.data.outfits.length,
        wearLogs: preview.data.wearLogs.length,
        photoCount: preview.data.itemPhotos.length,
        photoBytes: preview.data.itemPhotos.reduce((sum, photo) => sum + photo.bytes, 0),
        retired: preview.data.items.filter((item) => item.status === 'retired').length,
        wearRange: wearRange(preview),
      }
    : null;

  return (
    <div>
      <PageHeader title="备份与恢复" subtitle="导出 ZIP 保存到本机，换设备时再导入" />

      {needsReminder ? (
        <Card className="mb-3 border-danger/40">
          <h2 className="text-base font-semibold">该备份了</h2>
          <p className="mt-1 text-sm text-muted">
            {elapsed === null
              ? '还没有备份过，建议现在导出一份，避免清理浏览器数据时丢失。'
              : `距上次备份已 ${elapsed} 天，建议现在导出。`}
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-base font-semibold">导出</h2>
        <p className="mt-1 text-sm text-muted">
          上次备份：
          {lastBackupAt ? formatDateZh(toISODate(new Date(lastBackupAt))) : '尚未备份'}
        </p>
        <p className="mt-1 text-xs text-muted">
          提醒间隔：{interval === 0 ? '不提醒' : `每 ${interval} 天`}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => exportBackup(true)} disabled={busy !== null}>
            {busy === 'export' ? '导出中…' : '导出完整备份'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportBackup(false)}
            disabled={busy !== null}
          >
            仅导出数据
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          完整备份包含照片，文件可能较大。备份含照片与价格信息，请只保存在自己信任的位置。
        </p>
      </Card>

      <Card className="mt-3">
        <h2 className="text-base font-semibold">导入</h2>
        <p className="mt-1 text-sm text-muted">
          选择一个衣迹备份 ZIP，先预览内容，再决定合并或替换。
        </p>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium">选择备份文件</span>
          <input
            type="file"
            accept=".zip,application/zip"
            aria-label="选择备份文件"
            onChange={(event) => void handleFile(event)}
            className="block w-full text-sm text-muted"
          />
        </label>
      </Card>

      <Card className="mt-3">
        <h2 className="text-base font-semibold">存储</h2>
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

      {status ? (
        <p className="mt-3 text-sm text-accent-text" role="status">
          {status}
        </p>
      ) : null}
      {error && !preview ? <p className="mt-3 text-sm text-danger-text">{error}</p> : null}

      {preview && previewInfo ? (
        <Sheet open onClose={closePreview} title="导入备份">
          <p className="text-sm text-muted">
            备份时间：{formatDateZh(toISODate(new Date(preview.manifest.exportedAt)))}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>单品 {previewInfo.items} 件</li>
            <li>搭配 {previewInfo.outfits} 套</li>
            <li>穿着记录 {previewInfo.wearLogs} 条</li>
            {previewInfo.wearRange ? <li>穿着日期 {previewInfo.wearRange}</li> : null}
            <li>
              照片 {previewInfo.photoCount} 张 · {formatBytes(previewInfo.photoBytes)}
            </li>
            <li>
              {previewInfo.retired > 0
                ? `含 ${previewInfo.retired} 件已移出衣物`
                : '不含已移出衣物'}
            </li>
          </ul>

          {!preview.manifest.includesPhotos ? (
            <p className="mt-3 rounded-xl bg-bg p-3 text-sm text-muted">
              照片未包含在此备份中，可重新添加
            </p>
          ) : null}

          <h3 className="mt-4 text-sm font-medium">导入方式</h3>
          <div role="group" aria-label="导入方式" className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variant={mode === 'merge' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'merge'}
              onClick={() => setMode('merge')}
            >
              合并
            </Button>
            <Button
              variant={mode === 'replace' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'replace'}
              onClick={() => {
                setMode('replace');
                setConfirmed(false);
              }}
            >
              替换全部
            </Button>
          </div>

          {mode === 'replace' ? (
            <>
              <p className="mt-3 text-sm text-danger-text">
                替换会清空当前衣柜，请确认已经导出需要的备份。
              </p>
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1"
                />
                <span>我知道替换会清空当前数据</span>
              </label>
            </>
          ) : null}

          {error ? <p className="mt-3 text-sm text-danger-text">{error}</p> : null}

          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => void confirmImport()}
              disabled={!mode || (mode === 'replace' && !confirmed) || importing}
            >
              {importing ? '导入中…' : '开始导入'}
            </Button>
            <Button variant="ghost" onClick={closePreview} disabled={importing}>
              取消
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function wearRange(bundle: BackupBundle): string {
  const dates = bundle.data.wearLogs.map((log) => log.date).sort();
  if (dates.length === 0) return '';
  return `${dates[0]} 至 ${dates[dates.length - 1]}`;
}
