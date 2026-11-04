import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { diffDays, todayISO } from '../../domain/date';
import { formatCents } from '../../domain/money';
import {
  categoryDistribution,
  colorDistribution,
  idleItems,
  utilization,
} from '../../domain/stats';
import { listItems } from '../../db/repositories/items';
import { listWearLogs } from '../../db/repositories/wearLogs';
import { listCategories } from '../../db/repositories/categories';
import { listColors } from '../../db/repositories/dictionaries';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { WardrobeTabs } from './WardrobeTabs';

export function WardrobeInsightsPage() {
  const items = useLiveQuery(() => listItems({ includeRetired: true }), []) ?? [];
  const wearLogs = useLiveQuery(() => listWearLogs(), []) ?? [];
  const categories = useLiveQuery(() => listCategories(), []) ?? [];
  const colors = useLiveQuery(() => listColors(), []) ?? [];

  const now = todayISO();
  const active = items.filter((item) => item.status !== 'retired');
  const retired = items.filter((item) => item.status === 'retired');
  const totalCost = active.reduce((sum, item) => sum + item.totalCostCents, 0);
  const totalWearDays = active.reduce((sum, item) => sum + item.wearCount, 0);
  const averageCost = totalWearDays > 0 ? Math.round(totalCost / totalWearDays) : null;
  const usage = utilization(active, wearLogs, now);
  const idle = idleItems(active, now).slice(0, 10);
  const byCategory = categoryDistribution(active, categories);
  const byColor = colorDistribution(active, colors);
  const maxCategory = byCategory[0]?.count ?? 0;

  const statusCounts = [
    { label: '待洗', count: active.filter((item) => item.status === 'laundry').length },
    { label: '维修', count: active.filter((item) => item.status === 'repair').length },
    { label: '收纳', count: active.filter((item) => item.status === 'stored').length },
    { label: '已移出', count: retired.length },
  ];

  return (
    <div>
      <PageHeader title="衣橱分析" subtitle="看看哪些衣服在穿、哪些在闲置" />
      <WardrobeTabs />

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-muted">总件数</p>
          <p className="mt-1 text-2xl font-semibold">{active.length} 件</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">总花费</p>
          <p className="tabular mt-1 text-2xl font-semibold">{formatCents(totalCost)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">平均单次成本</p>
          <p className="tabular mt-1 text-2xl font-semibold">
            {averageCost == null ? '暂无' : formatCents(averageCost)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">90 天利用率</p>
          <p className="tabular mt-1 text-2xl font-semibold">
            {wearLogs.length === 0 ? '暂无' : `${Math.round(usage * 100)}%`}
          </p>
        </Card>
      </div>

      {wearLogs.length === 0 ? (
        <Card className="mt-3">
          <h2 className="text-base font-semibold">还没有穿着记录</h2>
          <p className="mt-1 text-sm text-muted">
            先记录几次穿着，就能看到利用率和闲置提醒。
          </p>
          <Link to="/" className="mt-3 inline-flex min-h-11 items-center text-sm text-accent-text">
            去今日记录穿着
          </Link>
        </Card>
      ) : (
        <Card className="mt-3">
          <h2 className="text-base font-semibold">很久没穿 Top 10</h2>
          {idle.length === 0 ? (
            <p className="mt-2 text-sm text-muted">最近都在穿，没有明显闲置的衣物。</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {idle.map((item) => {
                const since = item.lastWornAt ?? item.createdAt.slice(0, 10);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <Link to={`/wardrobe/item/${item.id}`} className="truncate">
                      {item.name}
                    </Link>
                    <span className="tabular shrink-0 text-muted">
                      {item.lastWornAt ? `${diffDays(since, now)} 天未穿` : '从未穿过'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Card className="mt-3">
        <h2 className="text-base font-semibold">类型分布</h2>
        {byCategory.length === 0 ? (
          <p className="mt-2 text-sm text-muted">还没有衣物。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {byCategory.map((entry) => (
              <li key={entry.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{entry.label}</span>
                  <span className="tabular text-muted">{entry.count} 件</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(entry.count / maxCategory) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-3">
        <h2 className="text-base font-semibold">颜色分布</h2>
        {byColor.length === 0 ? (
          <p className="mt-2 text-sm text-muted">还没有衣物。</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {byColor.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-sm"
              >
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-full border border-line"
                  style={{ backgroundColor: entry.hex ?? '#cccccc' }}
                />
                {entry.label}
                <span className="tabular text-xs text-muted">{entry.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-3">
        <h2 className="text-base font-semibold">状态</h2>
        <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {statusCounts.map((entry) => (
            <li key={entry.label} className="flex items-center justify-between">
              <span className="text-muted">{entry.label}</span>
              <span className="tabular">{entry.count} 件</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
