import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Shirt } from 'lucide-react';
import type { Item } from '../../domain/types';
import { diffDays, formatDateZh, toISODate, todayISO } from '../../domain/date';
import { idleItems } from '../../domain/stats';
import { getSetting, setSetting } from '../../db/repositories/settings';
import { listItems } from '../../db/repositories/items';
import { listScenes } from '../../db/repositories/scenes';
import { listWearLogs } from '../../db/repositories/wearLogs';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { NumberField } from '../../components/ui/NumberField';
import { PageHeader } from '../../components/ui/PageHeader';
import { RecommendationPanel } from '../outfits/RecommendationPanel';
import { useRecommendations } from '../outfits/useRecommendations';
import { WearLogSheet } from './WearLogSheet';

const DEFAULT_SCENE_ID = 'builtin:scene:casual';
const DEFAULT_TEMP_C = 20;

export function TodayPage() {
  const saved = useLiveQuery(async () => {
    const [sceneId, tempC] = await Promise.all([
      getSetting<string>('todaySceneId', DEFAULT_SCENE_ID),
      getSetting<number>('todayTempC', DEFAULT_TEMP_C),
    ]);
    return { sceneId, tempC };
  }, []);

  if (saved === undefined) return null;
  return <TodayContent initialSceneId={saved.sceneId} initialTempC={saved.tempC} />;
}

function TodayContent({
  initialSceneId,
  initialTempC,
}: {
  initialSceneId: string;
  initialTempC: number;
}) {
  const today = todayISO();
  const scenes = useLiveQuery(() => listScenes(), []) ?? [];
  const itemRows = useLiveQuery(() => listItems(), []);
  const todayLogs = useLiveQuery(() => listWearLogs({ from: today, to: today }), [today]) ?? [];
  const backupDays = useLiveQuery(() => getSetting<number>('backupReminderDays', 30), []) ?? 30;
  const lastBackupAt = useLiveQuery(() => getSetting<string | null>('lastBackupAt', null), []);
  const [sceneId, setSceneId] = useState(initialSceneId);
  const [tempC, setTempC] = useState(initialTempC);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [recommendedWear, setRecommendedWear] = useState<Item[] | null>(null);
  const recommendation = useRecommendations({ sceneId, tempC, nonce });
  const topRecommendation = recommendation.results[0];

  if (itemRows === undefined) return null;

  const items = itemRows;
  const selectedScene = scenes.find((scene) => scene.id === sceneId);
  const laundry = items.filter((item) => item.status === 'laundry');
  const idle = idleItems(items, new Date().toISOString()).slice(0, 2);
  const backupOverdue =
    backupDays > 0 && lastBackupAt
      ? diffDays(toISODate(new Date(lastBackupAt)), today) >= backupDays
      : false;

  const wornSummary =
    todayLogs.length === 0
      ? '记录后会计入穿着次数和单次成本。'
      : todayLogs.length === 1
        ? (todayLogs[0].outfitName ??
          todayLogs[0].items
            .map((item) => item.name)
            .slice(0, 3)
            .join('、'))
        : `共 ${todayLogs.length} 次记录`;

  function chooseScene(id: string) {
    setSceneId(id);
    void setSetting('todaySceneId', id);
  }

  function changeTemp(value: number) {
    setTempC(value);
    void setSetting('todayTempC', value);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={formatDateZh(today)} subtitle="今天穿什么" />

      {items.length === 0 ? (
        <EmptyState
          icon={<Shirt size={28} aria-hidden />}
          title="先添加第一件衣服"
          description="添加几件常穿的衣服，衣迹就能按场景和温度为你推荐搭配。"
          action={
            <Link
              to="/wardrobe/item/new"
              className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm text-on-accent"
            >
              去添加
            </Link>
          }
        />
      ) : (
        <>
          <Card className="space-y-3">
            <p className="text-sm font-medium">今天去哪？</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  aria-pressed={scene.id === sceneId}
                  onClick={() => chooseScene(scene.id)}
                  className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${
                    scene.id === sceneId
                      ? 'border-accent bg-accent/10 text-accent-text'
                      : 'border-line bg-surface text-muted'
                  }`}
                >
                  {scene.name}
                </button>
              ))}
            </div>
            <NumberField
              label="温度"
              value={tempC}
              min={-30}
              max={45}
              step={1}
              suffix="°C"
              onChange={changeTemp}
            />
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold">今日推荐</h2>
              <span className="text-xs text-muted">
                {selectedScene?.name ?? '未选场景'} · {tempC}°C
              </span>
            </div>
            {recommendation.data === undefined ? (
              <p className="mt-2 text-sm text-muted">正在准备推荐…</p>
            ) : recommendation.gaps.length > 0 ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted">衣柜还缺这几类：</p>
                <ul className="space-y-0.5 text-sm">
                  {recommendation.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
                <Link
                  to="/wardrobe/item/new"
                  className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm text-on-accent"
                >
                  去添加
                </Link>
              </div>
            ) : topRecommendation ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium">
                  {topRecommendation.items.map((item) => item.name).join(' + ')}
                </p>
                <p className="text-xs text-muted">{topRecommendation.reasons[0]}</p>
                {topRecommendation.relaxed.length > 0 ? (
                  <p className="text-xs text-accent-text">
                    已放宽条件：{topRecommendation.relaxed.join(' ')}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setRecommendedWear(topRecommendation.items)}>
                    就穿这套
                  </Button>
                  <Button variant="secondary" onClick={() => setNonce((current) => current + 1)}>
                    换一套
                  </Button>
                  <Button variant="secondary" onClick={() => setPanelOpen(true)}>
                    查看 {recommendation.results.length} 套
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                暂时没有可推荐的搭配，换个场景或温度试试。
              </p>
            )}
          </Card>

          <Card className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {todayLogs.length > 0 ? '今天已穿' : '今天还没记录穿着'}
              </p>
              <p className="mt-1 truncate text-xs text-muted">{wornSummary}</p>
            </div>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              记录穿着
            </Button>
          </Card>

          {laundry.length > 0 ? (
            <Card className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">待洗 {laundry.length} 件</p>
                <p className="mt-1 truncate text-xs text-muted">
                  {laundry
                    .slice(0, 2)
                    .map((item) => item.name)
                    .join('、')}
                  {laundry.length > 2 ? ' 等' : ''}
                </p>
              </div>
              <Link
                to="/wardrobe?status=laundry"
                className="flex min-h-11 shrink-0 items-center px-2 text-sm text-accent-text"
              >
                查看
              </Link>
            </Card>
          ) : null}

          {idle.length > 0 ? (
            <Card className="space-y-2">
              <p className="text-sm font-medium">很久没穿</p>
              <ul className="space-y-1">
                {idle.map((item) => {
                  const since = item.lastWornAt ?? item.createdAt.slice(0, 10);
                  return (
                    <li key={item.id}>
                      <Link
                        to={`/wardrobe/item/${item.id}`}
                        className="flex min-h-9 items-center justify-between gap-2 text-sm text-accent-text"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {diffDays(since, today)} 天
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {backupOverdue ? (
            <Card className="text-sm">
              距离上次备份已超过 {backupDays} 天。
              <Link to="/me" className="ml-1 text-accent-text">
                去备份
              </Link>
            </Card>
          ) : null}
        </>
      )}

      {sheetOpen ? (
        <WearLogSheet
          open
          onClose={() => setSheetOpen(false)}
          date={today}
          sceneId={sceneId}
          tempC={tempC}
        />
      ) : null}

      {panelOpen ? (
        <RecommendationPanel
          open
          onClose={() => setPanelOpen(false)}
          initialSceneId={sceneId}
          initialTempC={tempC}
        />
      ) : null}

      {recommendedWear ? (
        <WearLogSheet
          open
          onClose={() => setRecommendedWear(null)}
          date={today}
          presetItems={recommendedWear}
          sceneId={sceneId}
          tempC={tempC}
        />
      ) : null}
    </div>
  );
}
