import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Item } from '../../domain/types';
import { locationPath } from '../../domain/locationTree';
import { listCategories } from '../../db/repositories/categories';
import { listColors } from '../../db/repositories/dictionaries';
import { listLocations } from '../../db/repositories/locations';
import { getThumb } from '../../db/repositories/photos';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { ItemCard } from '../../components/item/ItemCard';

export function WardrobeItemCard({
  item,
  selectionMode,
  selected,
  onClick,
  onLongPress,
}: {
  item: Item;
  selectionMode: boolean;
  selected: boolean;
  onClick: () => void;
  onLongPress: () => void;
}) {
  const navigate = useNavigate();
  const categories = useLiveQuery(() => listCategories(), []);
  const locations = useLiveQuery(() => listLocations(), []);
  const colors = useLiveQuery(() => listColors(), []);
  const thumb = useLiveQuery<Blob | undefined>(
    async () => (item.thumbPhotoId ? await getThumb(item.thumbPhotoId) : undefined),
    [item.thumbPhotoId],
  );
  const thumbUrl = useObjectUrl(thumb);

  return (
    <ItemCard
      item={item}
      category={categories?.find((category) => category.id === item.categoryId)}
      color={colors?.find((color) => color.id === item.colorPrimaryId)}
      locationPath={item.locationId ? locationPath(locations ?? [], item.locationId) : undefined}
      thumbUrl={thumbUrl}
      selected={selectionMode ? selected : undefined}
      onClick={() => {
        if (selectionMode) onClick();
        else navigate(`/wardrobe/item/${item.id}`);
      }}
      onLongPress={onLongPress}
    />
  );
}
