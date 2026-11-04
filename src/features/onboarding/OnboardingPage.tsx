import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, MapPin, Shirt, Sparkles } from 'lucide-react';
import type { StyleProfile, TempSensitivity } from '../../domain/profile';
import { listColors, listStyleTags } from '../../db/repositories/dictionaries';
import { createLocation, listLocations } from '../../db/repositories/locations';
import { setSetting } from '../../db/repositories/settings';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { NumberField } from '../../components/ui/NumberField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';

const STEP_TITLES = ['欢迎', '风格画像', '尺码', '存放位置', '第一件衣物', '备份提醒'];

const SENSITIVITY_OPTIONS: Array<{ value: TempSensitivity; label: string }> = [
  { value: 'cold', label: '怕冷' },
  { value: 'normal', label: '正常' },
  { value: 'hot', label: '怕热' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [favoriteColorIds, setFavoriteColorIds] = useState<string[]>([]);
  const [avoidColorIds, setAvoidColorIds] = useState<string[]>([]);
  const [sensitivity, setSensitivity] = useState<TempSensitivity>('normal');
  const [sizes, setSizes] = useState({ top: '', bottom: '', shoes: '', dress: '' });
  const [backupDays, setBackupDays] = useState(30);
  const [templateCreated, setTemplateCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  const styleTagOptions = useLiveQuery(() => listStyleTags(), []) ?? [];
  const colorOptions = useLiveQuery(() => listColors(), []) ?? [];
  const locations = useLiveQuery(() => listLocations(), []) ?? [];

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
  }

  function toggleFavorite(colorId: string) {
    setFavoriteColorIds((current) => toggle(current, colorId));
    setAvoidColorIds((current) => current.filter((entry) => entry !== colorId));
  }

  function toggleAvoid(colorId: string) {
    setAvoidColorIds((current) => toggle(current, colorId));
    setFavoriteColorIds((current) => current.filter((entry) => entry !== colorId));
  }

  async function createTemplate() {
    if (templateCreated) return;
    setBusy(true);
    try {
      const bedroom = await createLocation({ name: '卧室' });
      await createLocation({ name: '主衣柜', parentId: bedroom });
      const entry = await createLocation({ name: '玄关' });
      await createLocation({ name: '鞋柜', parentId: entry });
      const storage = await createLocation({ name: '储物间' });
      await createLocation({ name: '换季收纳', parentId: storage });
      setTemplateCreated(true);
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (busy) return;
    setBusy(true);
    try {
      if (
        styleTags.length > 0 ||
        favoriteColorIds.length > 0 ||
        avoidColorIds.length > 0 ||
        sensitivity !== 'normal'
      ) {
        const profile: StyleProfile = {
          styleTags,
          favoriteColorIds,
          avoidColorIds,
          tempSensitivity: sensitivity,
        };
        await setSetting('styleProfile', profile);
      }
      const trimmedSizes = {
        top: sizes.top.trim() || undefined,
        bottom: sizes.bottom.trim() || undefined,
        shoes: sizes.shoes.trim() || undefined,
        dress: sizes.dress.trim() || undefined,
      };
      if (Object.values(trimmedSizes).some(Boolean)) {
        await setSetting('sizes', trimmedSizes);
      }
      await setSetting('backupReminderDays', backupDays);
      await setSetting('onboardingDone', true);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await complete();
    navigate('/', { replace: true });
  }

  async function addFirstItem() {
    await complete();
    navigate('/wardrobe/item/new', { replace: true });
  }

  function next() {
    setStep((current) => Math.min(STEP_TITLES.length - 1, current + 1));
  }

  function renderStep(): ReactNode {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-3xl font-semibold tracking-tight">把衣橱录清楚，穿得更明白</p>
            <p className="text-sm leading-6 text-muted">
              衣物、照片、搭配、穿着记录和价格只保存在这台设备上。没有账号，没有云同步，也不会向任何服务器发送数据。
            </p>
            <Card className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Lock size={16} aria-hidden className="text-muted" /> 照片不会离开本机
              </p>
              <p className="flex items-center gap-2">
                <Sparkles size={16} aria-hidden className="text-muted" /> 离线也能推荐搭配
              </p>
              <p className="flex items-center gap-2">
                <Shirt size={16} aria-hidden className="text-muted" /> 新装默认空白，不预置衣物
              </p>
            </Card>
            <p className="text-xs text-muted">
              请自行定期导出备份；清除浏览器数据会同时删除这里的记录。
            </p>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <p className="text-sm text-muted">都可以跳过。之后可在“我的”里修改。</p>
            <div>
              <h2 className="mb-2 text-sm font-medium">喜欢的风格</h2>
              <div className="flex flex-wrap gap-2">
                {styleTagOptions.map((tag) => {
                  const active = styleTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStyleTags((current) => toggle(current, tag.id))}
                      className={`min-h-9 rounded-full border px-3 text-sm ${
                        active
                          ? 'border-accent bg-accent/10 text-accent-text'
                          : 'border-line bg-surface'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-medium">偏好色</h2>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => {
                  const active = favoriteColorIds.includes(color.id);
                  return (
                    <button
                      key={color.id}
                      type="button"
                      aria-label={`偏好色 ${color.name}`}
                      aria-pressed={active}
                      onClick={() => toggleFavorite(color.id)}
                      className={`flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-sm ${
                        active ? 'border-accent bg-accent/10' : 'border-line bg-surface'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 rounded-full border border-line"
                        style={{ backgroundColor: color.hex }}
                      />
                      {color.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-medium">回避色</h2>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => {
                  const active = avoidColorIds.includes(color.id);
                  return (
                    <button
                      key={color.id}
                      type="button"
                      aria-label={`回避色 ${color.name}`}
                      aria-pressed={active}
                      onClick={() => toggleAvoid(color.id)}
                      className={`flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-sm ${
                        active ? 'border-accent bg-accent/10' : 'border-line bg-surface'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 rounded-full border border-line"
                        style={{ backgroundColor: color.hex }}
                      />
                      {color.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-medium">体感</h2>
              <SegmentedControl
                ariaLabel="体感"
                options={SENSITIVITY_OPTIONS}
                value={sensitivity}
                onChange={setSensitivity}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted">只用于待购参考，可以留空。</p>
            <TextField
              label="上装尺码"
              value={sizes.top}
              onChange={(event) => setSizes((current) => ({ ...current, top: event.target.value }))}
              placeholder="例如 M"
            />
            <TextField
              label="下装尺码"
              value={sizes.bottom}
              onChange={(event) =>
                setSizes((current) => ({ ...current, bottom: event.target.value }))
              }
              placeholder="例如 28"
            />
            <TextField
              label="鞋码"
              value={sizes.shoes}
              onChange={(event) =>
                setSizes((current) => ({ ...current, shoes: event.target.value }))
              }
              placeholder="例如 42"
            />
            <TextField
              label="连衣裙尺码"
              value={sizes.dress}
              onChange={(event) =>
                setSizes((current) => ({ ...current, dress: event.target.value }))
              }
              placeholder="可留空"
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              默认不创建任何位置。可以一键建一套常见结构，也可以稍后自己添加。
            </p>
            <Card className="space-y-1 text-sm">
              <p>卧室 / 主衣柜</p>
              <p>玄关 / 鞋柜</p>
              <p>储物间 / 换季收纳</p>
            </Card>
            {templateCreated || locations.length > 0 ? (
              <p className="flex items-center gap-1 text-sm text-accent-text">
                <Check size={16} aria-hidden />
                {templateCreated ? '已创建推荐位置' : `已有 ${locations.length} 个位置`}
              </p>
            ) : (
              <Button className="w-full" onClick={createTemplate} disabled={busy}>
                {busy ? '创建中…' : '一键创建推荐结构'}
              </Button>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              拍一张照片，选类型、颜色和位置就能保存。没有照片也可以先录入。
            </p>
            <Card className="flex items-center gap-3 text-sm">
              <MapPin size={18} aria-hidden className="text-muted" />
              添加后可以在衣橱里继续补品牌、价格和季节。
            </Card>
            <Button className="w-full" onClick={addFirstItem} disabled={busy}>
              去添加第一件
            </Button>
          </div>
        );
      default:
        return (
          <div className="space-y-5">
            <p className="text-sm text-muted">
              本地数据只在这台设备上。建议定期导出备份，换机或清理浏览器前尤其重要。
            </p>
            <NumberField
              label="备份提醒间隔"
              value={backupDays}
              min={0}
              max={365}
              step={7}
              suffix="天"
              onChange={setBackupDays}
            />
            <p className="text-xs text-muted">设为 0 表示不提醒。</p>
          </div>
        );
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-8 pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-accent-text">衣迹 / ClosetTrace</p>
        <button
          type="button"
          onClick={finish}
          disabled={busy}
          className="min-h-11 px-2 text-sm text-muted"
        >
          跳过全部
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">
        第 {step + 1} / {STEP_TITLES.length} 步 · {STEP_TITLES[step]}
      </p>

      <div className="mt-6 flex-1">{renderStep()}</div>

      <div className="mt-8 flex gap-2 pb-2">
        <Button variant="secondary" className="flex-1" onClick={next} disabled={busy || step === STEP_TITLES.length - 1}>
          跳过这步
        </Button>
        <Button
          className="flex-[2]"
          onClick={step === STEP_TITLES.length - 1 ? finish : next}
          disabled={busy}
        >
          {step === STEP_TITLES.length - 1 ? '完成' : '下一步'}
        </Button>
      </div>
    </main>
  );
}
