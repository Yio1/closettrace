import { Link } from 'react-router-dom';
import { Shirt } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

export function TodayPage() {
  return (
    <div>
      <PageHeader title="今日" subtitle="从衣橱里穿出今天" />
      <Card className="mb-4">
        <p className="text-sm text-muted">本地优先</p>
        <p className="mt-1 text-sm">
          衣迹没有账号，也不会上传数据。衣物照片、搭配和价格只保存在这台设备上。
        </p>
      </Card>
      <EmptyState
        icon={<Shirt size={28} aria-hidden />}
        title="衣橱还是空的"
        description="先添加几件常穿的衣服，衣迹就能按场景和温度为你推荐搭配。"
        action={
          <Link to="/wardrobe">
            <Button>去整理衣橱</Button>
          </Link>
        }
      />
    </div>
  );
}
