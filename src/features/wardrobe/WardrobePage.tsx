import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

export function WardrobePage() {
  return (
    <div>
      <PageHeader
        title="衣橱"
        subtitle="0 件"
        action={
          <Button variant="secondary" aria-label="添加衣物">
            <Plus size={18} aria-hidden />
          </Button>
        }
      />
      <EmptyState
        title="衣橱还是空的"
        description="拍照或从相册选择，添加第一件衣服。类型、颜色和位置都可以稍后补。"
        action={
          <Link to="/wardrobe">
            <Button>添加第一件</Button>
          </Link>
        }
      />
    </div>
  );
}
