import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Recommendation } from '../../domain/recommend';
import { autoOutfitName } from '../../domain/outfit';
import { todayISO } from '../../domain/date';
import type { TempSensitivity } from '../../domain/profile';
import { saveOutfit } from '../../db/repositories/outfits';
import { recordFeedback } from '../../db/repositories/feedback';
import { setSetting } from '../../db/repositories/settings';
import { RecommendationCard } from '../../components/outfit/RecommendationCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { NumberField } from '../../components/ui/NumberField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Sheet } from '../../components/ui/Sheet';
import { WearLogSheet } from '../today/WearLogSheet';
import { useRecommendations } from './useRecommendations';

const DEFAULT_SCENE_ID = 'builtin:scene:casual';
const DEFAULT_TEMP_C = 20;

const SENSITIVITY_OPTIONS: Array<{ value: TempSensitivity; label: string }> = [
  { value: 'cold', label: '怕冷' },
  { value: 'normal', label: '正常' },
  { value: 'hot', label: '怕热' },
];

export interface RecommendationPanelProps {
  open: boolean;
  onClose: () => void;
  initialSceneId?: string;
  initialTempC?: number;
}

export function RecommendationPanel({
  open,
  onClose,
  initialSceneId = DEFAULT_SCENE_ID,
  initialTempC = DEFAULT_TEMP_C,
}: RecommendationPanelProps) {
  const navigate = useNavigate();
  const [sceneId, setSceneId] = useState(initialSceneId);
  const [tempC, setTempC] = useState(initialTempC);
  const [nonce, setNonce] = useState(0);
  const [rated, setRated] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [wearTarget, setWearTarget] = useState<Recommendation | null>(null);
  const [error, setError] = useState('');

  const { data, results, gaps } = useRecommendations({ sceneId, tempC, nonce });
  const visible = results.filter((result) => rated.get(result.signature) !== 'dislike');

  async function handleRate(result: Recommendation, rating: 'like' | 'dislike') {
    setRated((current) => {
      const next = new Map(current);
      next.set(result.signature, rating);
      return next;
    });
    await recordFeedback({ signature: result.signature, sceneId, rating });
  }

  async function handleSave(result: Recommendation) {
    if (!data) return;
    const categoryById = new Map(data.categories.map((category) => [category.id, category]));
    try {
      const id = await saveOutfit({
        name: autoOutfitName(result.items, data.colors),
        sceneIds: [sceneId],
        source: 'recommended',
        items: result.items.map((item, index) => ({
          itemId: item.id,
          slot: categoryById.get(item.categoryId)?.slot ?? 'top',
          order: index,
        })),
      });
      setSaved((current) => new Set(current).add(result.signature));
      navigate(`/outfits/${id}`);
    } catch {
      setError('保存失败，请重试');
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="衣迹推荐">
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(data?.scenes ?? []).map((scene) => (
              <button
                key={scene.id}
                type="button"
                aria-pressed={scene.id === sceneId}
                onClick={() => setSceneId(scene.id)}
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
            onChange={setTempC}
          />

          <SegmentedControl
            ariaLabel="体感偏好"
            options={SENSITIVITY_OPTIONS}
            value={data?.styleProfile.tempSensitivity ?? 'normal'}
            onChange={(value) => {
              if (!data) return;
              void setSetting('styleProfile', {
                ...data.styleProfile,
                tempSensitivity: value,
              });
            }}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">按场景、温度和穿着记录生成</p>
            <Button variant="secondary" onClick={() => setNonce((current) => current + 1)}>
              换一套
            </Button>
          </div>

          {!data ? (
            <p className="py-6 text-center text-sm text-muted">正在准备推荐…</p>
          ) : gaps.length > 0 ? (
            <Card>
              <p className="text-sm font-medium">衣柜还缺这几类</p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
              <Link
                to="/wardrobe/item/new"
                className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm text-on-accent"
              >
                去添加
              </Link>
            </Card>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              暂时没有可推荐的搭配，换个场景或温度试试。
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((result, index) => (
                <li key={result.signature}>
                  <RecommendationCard
                    recommendation={result}
                    colors={data.colors}
                    index={index}
                    rating={rated.get(result.signature)}
                    saved={saved.has(result.signature)}
                    onWear={() => setWearTarget(result)}
                    onLike={() => void handleRate(result, 'like')}
                    onDislike={() => void handleRate(result, 'dislike')}
                    onSave={() => void handleSave(result)}
                  />
                </li>
              ))}
            </ul>
          )}

          {error ? <p className="text-sm text-danger-text">{error}</p> : null}
        </div>
      </Sheet>

      {wearTarget ? (
        <WearLogSheet
          open
          onClose={() => setWearTarget(null)}
          date={todayISO()}
          presetItems={wearTarget.items}
          sceneId={sceneId}
          tempC={tempC}
        />
      ) : null}
    </>
  );
}
