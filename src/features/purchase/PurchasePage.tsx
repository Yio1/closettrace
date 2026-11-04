import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

export function PurchasePage() {
  return (
    <div>
      <PageHeader title="采购" subtitle="待购比价、已购花费与穿着成本" />
      <EmptyState
        title="还没有待购记录"
        description="记录想买的衣服，再逐条添加不同渠道的报价，比较最低到手价。"
      />
    </div>
  );
}
