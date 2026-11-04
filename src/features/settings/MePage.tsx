import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../app/ThemeProvider';
import { db } from '../../db/schema';
import { getSetting } from '../../db/repositories/settings';
import { formatDateZh, toISODate } from '../../domain/date';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';

type ThemeChoice = 'system' | 'light' | 'dark';

const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

function SettingsRow({
  label,
  to,
  value,
}: {
  label: string;
  to?: string;
  value?: string;
}) {
  const content = (
    <>
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-1 text-xs text-muted">
        {value ?? (to ? '' : '待开放')}
        <ChevronRight size={14} aria-hidden />
      </span>
    </>
  );
  const className = 'flex min-h-12 items-center justify-between px-4 active:bg-bg';
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function MePage() {
  const { theme, setTheme } = useTheme();
  const counts = useLiveQuery(async () => {
    const all = await db.items.toArray();
    const retired = all.filter((item) => item.status === 'retired').length;
    return { active: all.length - retired, retired };
  }, []);
  const backupDays = useLiveQuery(() => getSetting<number>('backupReminderDays', 30), []);
  const lastBackupAt = useLiveQuery(() => getSetting<string | null>('lastBackupAt', null), []);

  return (
    <div>
      <PageHeader title="我的" subtitle="设置与数据" />

      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">衣橱件数</span>
          <span className="tabular text-lg font-semibold">
            {counts ? `${counts.active} 件` : '—'}
          </span>
        </div>
        {counts && counts.retired > 0 ? (
          <p className="mt-1 text-xs text-muted">已移出 {counts.retired} 件，可在衣橱中筛选查看。</p>
        ) : null}
        <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
          <p>
            上次备份：
            {lastBackupAt
              ? formatDateZh(toISODate(new Date(lastBackupAt)))
              : '尚未备份'}
          </p>
          <p className="mt-1">
            提醒间隔：{backupDays === 0 ? '不提醒' : `每 ${backupDays ?? 30} 天`}
          </p>
        </div>
      </Card>

      <h2 className="mb-2 text-sm font-medium">外观</h2>
      <SegmentedControl
        ariaLabel="主题"
        options={THEME_OPTIONS}
        value={theme}
        onChange={setTheme}
      />

      <h2 className="mb-2 mt-5 text-sm font-medium">衣橱设置</h2>
      <Card className="divide-y divide-line p-0">
        <SettingsRow label="风格与尺码" to="/me/style" />
        <SettingsRow label="场景管理" to="/me/scenes" />
        <SettingsRow label="类型管理" />
        <SettingsRow label="位置管理" to="/wardrobe/locations" />
      </Card>

      <h2 className="mb-2 mt-5 text-sm font-medium">数据</h2>
      <Card className="divide-y divide-line p-0">
        <SettingsRow label="备份与恢复" to="/me/backup" />
        <SettingsRow label="存储与诊断" to="/me/diagnostics" />
        <SettingsRow label="安装指南" to="/me/install" />
      </Card>

      <p className="mt-6 text-center text-xs text-muted">
        衣迹 v0.1.0 · 本地优先 · 无账号 · 无云同步
      </p>
    </div>
  );
}
