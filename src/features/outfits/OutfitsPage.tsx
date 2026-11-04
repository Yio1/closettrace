import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

export function OutfitsPage() {
  return (
    <div>
      <PageHeader title="搭配" subtitle="手动搭一套，或让衣迹推荐" />
      <EmptyState
        title="还没有搭配"
        description="添加至少一件上装、一件下装和一双鞋后，就可以开始搭配。"
      />
    </div>
  );
}
