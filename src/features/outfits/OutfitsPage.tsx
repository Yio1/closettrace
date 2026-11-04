import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Layers, Shirt } from 'lucide-react';
import type { OutfitItem } from '../../domain/types';
import { listItems } from '../../db/repositories/items';
import { listAllOutfitItems, listOutfits } from '../../db/repositories/outfits';
import { listScenes } from '../../db/repositories/scenes';
import { listColors } from '../../db/repositories/dictionaries';
import { OutfitCard, type OutfitEntry } from '../../components/outfit/OutfitCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';

type OutfitView = 'mine' | 'recommend';

const VIEW_OPTIONS: Array<{ value: OutfitView; label: string }> = [
  { value: 'mine', label: '我的搭配' },
  { value: 'recommend', label: '为我推荐' },
];

export function OutfitsPage() {
  const [view, setView] = useState<OutfitView>('mine');
  const outfits = useLiveQuery(() => listOutfits(), []) ?? [];
  const links = useLiveQuery(() => listAllOutfitItems(), []) ?? [];
  const items = useLiveQuery(() => listItems({ includeRetired: true }), []) ?? [];
  const scenes = useLiveQuery(() => listScenes(true), []) ?? [];
  const colors = useLiveQuery(() => listColors(), []) ?? [];

  const itemById = new Map(items.map((item) => [item.id, item]));
  const linksByOutfit = new Map<string, OutfitItem[]>();
  for (const link of links) {
    const bucket = linksByOutfit.get(link.outfitId) ?? [];
    bucket.push(link);
    linksByOutfit.set(link.outfitId, bucket);
  }

  function entriesFor(outfitId: string): OutfitEntry[] {
    return (linksByOutfit.get(outfitId) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap((link) => {
        const item = itemById.get(link.itemId);
        return item ? [{ item, slot: link.slot }] : [];
      });
  }

  return (
    <div>
      <PageHeader
        title="搭配"
        subtitle="手动搭一套，或让衣迹推荐"
        action={
          view === 'mine' ? (
            <Link
              to="/outfits/new"
              className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm text-on-accent"
            >
              新建
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4">
        <SegmentedControl
          ariaLabel="搭配视图"
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
        />
      </div>

      {view === 'recommend' ? (
        <EmptyState
          icon={<Layers size={28} aria-hidden />}
          title="推荐即将上线"
          description="填写场景和温度后会生成可解释的搭配。至少需要上装、下装和鞋。"
          action={
            <Button variant="secondary" onClick={() => setView('mine')}>
              返回我的搭配
            </Button>
          }
        />
      ) : outfits.length === 0 ? (
        <EmptyState
          icon={<Shirt size={28} aria-hidden />}
          title="还没有搭配"
          description="添加至少一件上装、一件下装和一双鞋后，就可以开始搭配。"
          action={
            <div className="flex gap-2">
              <Link
                to="/outfits/new"
                className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm text-on-accent"
              >
                手动搭一套
              </Link>
              <Button variant="secondary" onClick={() => setView('recommend')}>
                让衣迹推荐
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="space-y-3">
          {outfits.map((outfit) => (
            <li key={outfit.id}>
              <OutfitCard
                outfit={outfit}
                entries={entriesFor(outfit.id)}
                scenes={scenes}
                colors={colors}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
