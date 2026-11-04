import { useLiveQuery } from 'dexie-react-hooks';
import type { Item } from '../../domain/types';
import { formatCents } from '../../domain/money';
import { cpw } from '../../domain/price';
import { todayISO } from '../../domain/date';
import { utilization } from '../../domain/stats';
import { listItems } from '../../db/repositories/items';
import { listWearLogs } from '../../db/repositories/wearLogs';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';

export function CpwPage() {
  return (
    <div>
      <PageHeader title="穿着成本" subtitle="穿得越多，单次成本越低" />
      <CpwView />
    </div>
  );
}

function wearGoal(item: Item): string | null {
  const current = cpw(item.totalCostCents, item.wearCount);
  if (current === null || current <= 0) return null;
  const target = Math.floor((current - 1) / 100) * 100;
  if (target < 1) return null;
  const needed = Math.ceil(item.totalCostCents / target) - item.wearCount;
  if (needed <= 0) return null;
  return `再穿 ${needed} 次，CPW 降到 ${formatCents(target)}`;
}

export function CpwView() {
  const items = useLiveQuery(() => listItems({ includeRetired: true }), []);
  const wearLogs = useLiveQuery(() => listWearLogs(), []);

  if (!items || !wearLogs) return null;

  const active = items.filter((item) => item.status !== 'retired');
  if (active.length === 0) {
    return (
      <Card>
        <h2 className="text-base font-semibold">还没有衣物可以计算</h2>
        <p className="mt-1 text-sm text-muted">添加衣物并记录穿着后，这里会显示单次成本。</p>
      </Card>
    );
  }

  const wornItems = active
    .filter((item) => item.wearCount > 0)
    .sort(
      (a, b) =>
        (cpw(b.totalCostCents, b.wearCount) ?? 0) - (cpw(a.totalCostCents, a.wearCount) ?? 0),
    );
  const worn = wornItems.slice(0, 10);
  const zeroWear = active.filter((item) => item.wearCount === 0).slice(0, 10);
  const wornCost = wornItems.reduce((sum, item) => sum + item.totalCostCents, 0);
  const wornWears = wornItems.reduce((sum, item) => sum + item.wearCount, 0);
  const average = cpw(wornCost, wornWears);
  const usage = utilization(active, wearLogs, todayISO());

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-muted">平均单次成本</p>
          <p data-testid="average-cpw" className="tabular mt-1 text-2xl font-semibold">
            {average === null ? '暂无' : formatCents(average)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">90 天利用率</p>
          <p className="tabular mt-1 text-2xl font-semibold">
            {wearLogs.length === 0 ? '暂无' : `${Math.round(usage * 100)}%`}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold">单次成本最高</h2>
        {worn.length === 0 ? (
          <p className="mt-2 text-sm text-muted">还没有穿着记录。</p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="cpw-list">
            {worn.map((item) => {
              const value = cpw(item.totalCostCents, item.wearCount);
              const goal = wearGoal(item);
              return (
                <li key={item.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{item.name}</span>
                    <span className="tabular shrink-0">
                      {value === null ? '暂无' : formatCents(value)}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    穿了 {item.wearCount} 次 · 总花费 {formatCents(item.totalCostCents)}
                  </p>
                  {goal ? <p className="text-xs text-accent-text">{goal}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold">还没穿过</h2>
        {zeroWear.length === 0 ? (
          <p className="mt-2 text-sm text-muted">每件衣物都穿过了。</p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="zero-wear-list">
            {zeroWear.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{item.name}</span>
                <span className="tabular shrink-0 text-muted">
                  {formatCents(item.totalCostCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
