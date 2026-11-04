import type { ItemStatus } from './types';

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  available: '在穿',
  laundry: '待洗',
  repair: '维修',
  stored: '收纳',
  retired: '已移出',
};

export const ITEM_STATUS_OPTIONS: Array<{ value: ItemStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'available', label: '在穿' },
  { value: 'laundry', label: '待洗' },
  { value: 'repair', label: '维修' },
  { value: 'stored', label: '收纳' },
];
