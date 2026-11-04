import type { Table } from 'dexie';
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

export interface ClosetTraceTables {
  items: Table<Item, string>;
  itemPhotos: Table<ItemPhoto, string>;
  categories: Table<Category, string>;
  locations: Table<Location, string>;
  outfits: Table<Outfit, string>;
  outfitItems: Table<OutfitItem, string>;
  wearLogs: Table<WearLog, string>;
  scenes: Table<Scene, string>;
  outfitFeedback: Table<OutfitFeedback, string>;
  purchases: Table<Purchase, string>;
  wishlistItems: Table<WishlistItem, string>;
  priceQuotes: Table<PriceQuote, string>;
  colors: Table<ColorSwatch, string>;
  styleTags: Table<StyleTag, string>;
  settings: Table<Setting, string>;
  diagnostics: Table<Diagnostic, string>;
}
