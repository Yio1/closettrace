import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function OnboardingPage() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-8 pt-[calc(env(safe-area-inset-top)+48px)]">
      <p className="text-sm font-medium text-accent-text">衣迹 / ClosetTrace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">把衣橱录清楚，穿得更明白</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        衣物、照片、搭配、穿着记录和价格只保存在这台设备上。没有账号，没有云同步，也不会向任何服务器发送数据。
      </p>
      <Card className="mt-8 space-y-2 text-sm">
        <p>· 拍照录入，记录类型、颜色和存放位置</p>
        <p>· 按场景和温度获得可解释的搭配推荐</p>
        <p>· 记录购买价格，查看单次穿着成本</p>
      </Card>
      <div className="mt-auto pt-8">
        <Button size="lg" className="w-full" onClick={() => navigate('/')}>
          开始使用
        </Button>
        <p className="mt-3 text-center text-xs text-muted">新装默认空白，不会预置任何衣物或记录。</p>
      </div>
    </main>
  );
}
