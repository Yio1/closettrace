import { useEffect, useState, type ReactNode } from 'react';
import { DatabaseZap, Loader2 } from 'lucide-react';
import { seedDatabase } from '../db/seed';
import { Button } from '../components/ui/Button';

type GateState = 'loading' | 'ready' | 'error';

export function DbGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    seedDatabase()
      .then(() => {
        if (!cancelled) setState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : '数据库初始化失败');
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted">
        <Loader2 size={22} className="animate-spin" aria-hidden />
        正在准备衣橱…
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <DatabaseZap size={28} aria-hidden className="text-muted" />
        <h1 className="text-lg font-semibold">无法打开本地数据库</h1>
        <p className="text-sm text-muted">
          请检查浏览器是否允许本站存储数据，然后重试。已有的衣物不会上传到任何服务器。
        </p>
        <p className="text-xs text-danger-text">{message}</p>
        <Button
          onClick={() => {
            setState('loading');
            setAttempt((value) => value + 1);
          }}
        >
          重新尝试
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
