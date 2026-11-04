import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';

const items = ['风格与尺码', '场景管理', '类型管理', '位置管理', '备份与恢复', '存储与诊断'];

export function MePage() {
  return (
    <div>
      <PageHeader title="我的" subtitle="设置与数据" />
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item} className="flex items-center justify-between py-3">
            <span className="text-sm">{item}</span>
            <span className="text-xs text-muted">即将可用</span>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        衣迹 v0.1.0 · 本地优先 · 无账号 · 无云同步
      </p>
    </div>
  );
}
