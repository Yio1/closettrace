import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';

const STEPS = [
  '用 Safari 打开衣迹的网址。',
  '点击底部工具栏的「分享」按钮。',
  '向下找到「添加到主屏幕」，名称填写「衣迹」。',
  '从主屏幕图标打开，确认是独立窗口、没有地址栏。',
];

export function InstallGuidePage() {
  return (
    <div>
      <PageHeader title="安装指南" subtitle="将衣迹添加到 iPhone 主屏幕" />

      <Card>
        <h2 className="text-base font-semibold">添加到主屏幕</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>

      <Card className="mt-3">
        <h2 className="text-base font-semibold">关于数据</h2>
        <p className="mt-1 text-sm text-muted">
          衣迹没有账号、后端或云同步。衣物、照片、价格和穿着记录只保存在这台设备的浏览器里。
        </p>
        <p className="mt-2 text-sm text-muted">
          清理 Safari 网站数据或存储紧张时，本地数据可能被清除。请定期在「备份与恢复」导出 ZIP，
          并保存到「文件」App 或自己信任的位置。
        </p>
      </Card>
    </div>
  );
}
