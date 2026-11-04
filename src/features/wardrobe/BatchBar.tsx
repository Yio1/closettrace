import { Button } from '../../components/ui/Button';

export function BatchBar({
  count,
  onMove,
  onStatus,
  onRetire,
  onCancel,
}: {
  count: number;
  onMove: () => void;
  onStatus: () => void;
  onRetire: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom)+8px)] z-40 px-4">
      <div className="mx-auto flex max-w-lg items-center gap-1 rounded-card border border-line bg-surface p-2 shadow-lg">
        <span className="shrink-0 px-2 text-sm">已选 {count} 件</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" onClick={onMove}>
            移动
          </Button>
          <Button variant="ghost" onClick={onStatus}>
            状态
          </Button>
          <Button variant="ghost" className="text-danger-text" onClick={onRetire}>
            移出
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
