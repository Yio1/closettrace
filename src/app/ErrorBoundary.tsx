import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ClosetTrace error boundary', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">衣迹遇到了一个问题</h1>
        <p className="text-sm text-muted">你的数据仍保存在本机。可以先重新加载，或回到今日页。</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>重新加载</Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            回到今日
          </Button>
        </div>
      </main>
    );
  }
}
