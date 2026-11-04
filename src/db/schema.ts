import Dexie, { type Table } from 'dexie';
import type {
  Category,
  ColorSwatch,
  Diagnostic,
  Item,
  ItemPhoto,
  Location,
  Outfit,
  OutfitFeedback,
  OutfitItem,
  PriceQuote,
  Purchase,
  Scene,
  Setting,
  StyleTag,
  WearLog,
  WishlistItem,
} from '../domain/types';

export class ClosetTraceDB extends Dexie {
  items!: Table<Item, string>;
  itemPhotos!: Table<ItemPhoto, string>;
  categories!: Table<Category, string>;
  locations!: Table<Location, string>;
  outfits!: Table<Outfit, string>;
  outfitItems!: Table<OutfitItem, string>;
  wearLogs!: Table<WearLog, string>;
  scenes!: Table<Scene, string>;
  outfitFeedback!: Table<OutfitFeedback, string>;
  purchases!: Table<Purchase, string>;
  wishlistItems!: Table<WishlistItem, string>;
  priceQuotes!: Table<PriceQuote, string>;
  colors!: Table<ColorSwatch, string>;
  styleTags!: Table<StyleTag, string>;
  settings!: Table<Setting, string>;
  diagnostics!: Table<Diagnostic, string>;

  constructor(name = 'closettrace') {
    super(name);
    // Boolean-valued properties (isFavorite, archived, isNeutral) are stored but not
    // indexed: IndexedDB rejects booleans as keys, so those filters run in memory.
    this.version(1).stores({
      items:
        'id, name, categoryId, status, locationId, lastWornAt, updatedAt, archivedAt, *sceneTags, *seasons, *styleTags',
      itemPhotos: 'id, itemId, [itemId+order]',
      categories: 'id, parentId, slot, order',
      locations: 'id, parentId, order',
      outfits: 'id, lastWornAt, updatedAt, *sceneIds',
      outfitItems: 'id, outfitId, itemId, [outfitId+order]',
      wearLogs: 'id, date, outfitId, sceneId, [date+sceneId], *itemIds',
      scenes: 'id, order',
      outfitFeedback: 'id, signature, sceneId',
      purchases: 'id, itemId, purchasedAt, channel',
      wishlistItems: 'id, status, categoryId, priority, updatedAt',
      priceQuotes: 'id, wishlistId, observedAt, [wishlistId+observedAt]',
      colors: 'id, family, order',
      styleTags: 'id, order',
      settings: 'key',
      diagnostics: 'id, at',
    });
  }
}

export const db = new ClosetTraceDB();
