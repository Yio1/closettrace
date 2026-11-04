import type { ColorSwatch } from '../../domain/types';
import type { Recommendation } from '../../domain/recommend';
import { Button } from '../ui/Button';

export function RecommendationCard({
  recommendation,
  colors,
  index,
  rating,
  saved,
  onWear,
  onLike,
  onDislike,
  onSave,
}: {
  recommendation: Recommendation;
  colors: ColorSwatch[];
  index: number;
  rating?: 'like' | 'dislike';
  saved: boolean;
  onWear: () => void;
  onLike: () => void;
  onDislike: () => void;
  onSave: () => void;
}) {
  const colorById = new Map(colors.map((color) => [color.id, color]));

  return (
    <article
      aria-label={`推荐 ${index + 1}`}
      className="rounded-card border border-line bg-surface p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">匹配度 {recommendation.score}</p>
        {saved ? <span className="text-xs text-accent-text">已保存</span> : null}
      </div>

      <p className="mt-1 text-sm font-medium">
        {recommendation.items.map((item) => item.name).join(' + ')}
      </p>

      <div className="mt-2 flex gap-1" aria-hidden>
        {recommendation.items.map((item) => {
          const color = colorById.get(item.colorPrimaryId);
          return (
            <span
              key={item.id}
              className="h-4 w-4 rounded-full border border-line"
              style={{ backgroundColor: color?.hex ?? 'var(--line)' }}
            />
          );
        })}
      </div>

      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {recommendation.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      {recommendation.relaxed.length > 0 ? (
        <p className="mt-2 text-xs text-accent-text">
          已放宽条件：{recommendation.relaxed.join(' ')}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={onWear}>穿这套</Button>
        <Button variant="secondary" onClick={onSave} disabled={saved}>
          {saved ? '已保存' : '保存'}
        </Button>
        <Button
          variant="secondary"
          onClick={onLike}
          disabled={rating === 'like'}
        >
          {rating === 'like' ? '已喜欢' : '喜欢'}
        </Button>
        <Button
          variant="secondary"
          onClick={onDislike}
          disabled={rating === 'dislike'}
        >
          不喜欢
        </Button>
      </div>
    </article>
  );
}
