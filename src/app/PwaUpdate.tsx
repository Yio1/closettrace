import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../components/ui/Button';

export function PwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-3 shadow-lg">
      <p className="text-sm">发现新版本，更新不会影响本机数据。</p>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          稍后
        </Button>
        <Button onClick={() => void updateServiceWorker(true)}>更新</Button>
      </div>
    </div>
  );
}
