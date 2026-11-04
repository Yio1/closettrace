# ClosetTrace（衣迹）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first iPhone PWA for wardrobe inventory, outfit building, offline rule-based outfit recommendations, wear tracking, and purchase price comparison.

**Architecture:** React 19 + TypeScript strict + Vite, Dexie/IndexedDB for all data, pure domain functions for recommendation/price/stats/backup, self-built UI atoms, no backend and no runtime network calls. Photos are compressed client-side and stored as Blobs in a dedicated table. Backups are manual ZIP files.

**Tech Stack:** React 19.3, TypeScript 6.0, Vite 8.3, React Router 7.18, Tailwind 3.4, Dexie 4.4, dexie-react-hooks 4.4, Zod 4.6, fflate 0.8, date-fns 4.4, lucide-react 1.62, Vitest 5.0, Testing Library 16.3, fake-indexeddb 6.2, Playwright 1.64, vite-plugin-pwa 2.0, Cloudflare Workers static hosting.

**Spec:** [docs/2026-11-04-wardrobe-app-design.md](file:///C:/Users/Lin/Documents/Qoder/2026-11-04/e6868c34/docs/2026-11-04-wardrobe-app-design.md)

---

## Global Constraints

- **Local-first:** no accounts, no backend, no cloud sync, no telemetry, no third-party scripts, no runtime network requests.
- **New installs start blank:** never seed sample garments, outfits, wear logs, purchases, or quotes. Only seed dictionary content (categories, scenes, colors, style tags).
- **Money:** store integer cents; currency is CNY only; format as `¥199` or `¥199.50`.
- **Dates:** local `YYYY-MM-DD` strings; Monday is week start; no UTC conversion.
- **Recommendations:** deterministic offline rule engine; never call AI or network APIs.
- **Price comparison:** manual quotes only; never scrape or fetch e-commerce URLs.
- **Deletion:** default soft delete (`retired` + `archivedAt`); hard delete requires explicit confirmation.
- **Language:** Simplified Chinese UI; metric units; temperature °C.
- **UI:** iPhone portrait, safe-area insets, 44pt touch targets, CSS variables, light/dark theme, no external fonts.
- **TypeScript:** `strict`, `noUnusedLocals`, `noUnusedParameters`.
- **Every task ends with:** typecheck, relevant tests, and a commit. Full gate before release: `npm run typecheck && npm run lint && npm test && npm run build`.
- **Node:** ≥22 (CI 22; local 24).

---

## File Map

```
package.json
vite.config.ts
tailwind.config.js
postcss.config.js
eslint.config.js
tsconfig.json / tsconfig.app.json / tsconfig.node.json
vitest.config.ts
playwright.config.ts
pwa-assets.config.ts
index.html
public/_headers
public/logo.svg
src/main.tsx
src/app/
  App.tsx AppShell.tsx TabBar.tsx ThemeProvider.tsx DbGate.tsx
  ErrorBoundary.tsx PwaUpdate.tsx
src/components/ui/
  Button.tsx Card.tsx Sheet.tsx SegmentedControl.tsx TextField.tsx
  NumberField.tsx MoneyField.tsx Stepper.tsx EmptyState.tsx PageHeader.tsx
src/components/item/
  ItemCard.tsx PhotoPicker.tsx ColorSwatchPicker.tsx LocationPicker.tsx
  CategoryPicker.tsx
src/components/outfit/
  OutfitCard.tsx SlotPicker.tsx RecommendationCard.tsx
src/components/charts/
  BarList.tsx Sparkline.tsx
src/domain/
  types.ts date.ts money.ts weather.ts color.ts outfit.ts recommend.ts
  price.ts stats.ts backup.ts random.ts
src/db/
  types.ts schema.ts seed.ts
  repositories/
    items.ts photos.ts categories.ts locations.ts outfits.ts wearLogs.ts
    scenes.ts purchases.ts wishlist.ts feedback.ts settings.ts diagnostics.ts
    backup.ts
src/content/
  categories.json scenes.json colors.json style-tags.json
src/features/
  onboarding/ today/ wardrobe/ outfits/ purchase/ settings/ backup/
src/lib/
  cn.ts image.ts money.ts
src/styles/global.css
src/test/setup.ts fixtures/
```

Dependency direction:

```
features → domain + db/repositories + components
db/repositories → db/schema + db/types + domain
domain → no React, no Dexie, no browser APIs
components → no business queries, props only
```

---

# Milestone 1 — Foundation and Wardrobe

## Task 1: Scaffold, design tokens, app shell, PWA base

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`, `tsconfig*.json`, `vitest.config.ts`
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/app/AppShell.tsx`, `src/app/TabBar.tsx`, `src/app/ThemeProvider.tsx`, `src/app/ErrorBoundary.tsx`, `src/app/DbGate.tsx`, `src/app/PwaUpdate.tsx`
- Create: `src/styles/global.css`, `src/lib/cn.ts`, `src/test/setup.ts`
- Create: `src/app/TabBar.test.tsx`

**Interfaces:**
- Produces: `App`, `AppShell`, `TabBar`, `ThemeProvider`, `DbGate`, `ErrorBoundary`, `cn(...classes)`.
- Produces routes: `/` Today, `/wardrobe`, `/outfits`, `/purchase`, `/me`, `/onboarding`.
- Produces CSS tokens listed in design §7.2.

- [ ] **Step 1: Create package.json with exact dependency set**

```json
{
  "name": "closettrace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p tsconfig.app.json && vite build",
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "icons": "pwa-assets-generator --config pwa-assets.config.ts"
  },
  "dependencies": {
    "date-fns": "^4.4.0",
    "dexie": "^4.4.7",
    "dexie-react-hooks": "^4.4.0",
    "fflate": "^0.8.3",
    "lucide-react": "^1.62.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-router-dom": "^7.18.4",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.64.1",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.8",
    "@types/node": "^26.6.5",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vite-pwa/assets-generator": "^2.0.0",
    "@vitejs/plugin-react": "^6.1.2",
    "autoprefixer": "^10.6.2",
    "eslint": "^10.13.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.7",
    "fake-indexeddb": "^6.2.6",
    "globals": "^17.13.0",
    "jsdom": "^30.1.3",
    "postcss": "^8.5.32",
    "prettier": "^3.9.10",
    "tailwindcss": "^3.4.19",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.72.1",
    "vite": "^8.3.5",
    "vite-plugin-pwa": "^2.0.0",
    "vitest": "^5.0.5",
    "wrangler": "^4.155.0"
  }
}
```

Run:

```bash
npm install
```

- [ ] **Step 2: Create Vite, Tailwind, TypeScript, Vitest configs**

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: '衣迹',
        short_name: '衣迹',
        description: '本地优先的衣物与搭配管理',
        lang: 'zh-CN',
        theme_color: '#A9502F',
        background_color: '#F6F2EA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: ['pwa-*.png', 'maskable-*.png', 'manifest.webmanifest', 'apple-touch-icon-*'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
```

`tailwind.config.js` maps CSS variables (`bg`, `surface`, `text`, `muted`, `line`, `accent`, `accent-text`, `on-accent`, `danger`, `danger-text`, `success`, `warning`), `borderRadius.card = 16px`, `borderRadius.sheet = 24px`.

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 3: Create design tokens and base styles**

`src/styles/global.css` must define light/dark variables exactly as design §7.2, set body background/text/font stack, `min-h-dvh`, `.tabular`, safe-area padding, and `prefers-reduced-motion` rules.

- [ ] **Step 4: Create app shell and 5-tab navigation**

`src/app/TabBar.tsx`:

```tsx
import { NavLink } from 'react-router-dom';
import { Layers, Shirt, Sun, User, Wallet } from 'lucide-react';

const tabs = [
  { to: '/', label: '今日', icon: Sun },
  { to: '/wardrobe', label: '衣橱', icon: Shirt },
  { to: '/outfits', label: '搭配', icon: Layers },
  { to: '/purchase', label: '采购', icon: Wallet },
  { to: '/me', label: '我的', icon: User },
];

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
                isActive ? 'text-accent-text' : 'text-muted'
              }`
            }
          >
            <Icon size={20} aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

`AppShell.tsx` wraps `<Outlet />` in `mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-[calc(env(safe-area-inset-top)+16px)]`, plus `TabBar` and `PwaUpdate`.

`App.tsx` uses `BrowserRouter`, `ErrorBoundary`, `ThemeProvider`, `DbGate`, and placeholder pages for the five routes plus `/onboarding`.

- [ ] **Step 5: Write the failing TabBar test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TabBar } from './TabBar';

it('renders all five tabs', () => {
  render(
    <MemoryRouter>
      <TabBar />
    </MemoryRouter>,
  );
  for (const label of ['今日', '衣橱', '搭配', '采购', '我的']) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});
```

- [ ] **Step 6: Run test, verify failure, implement, re-run**

Run: `npm test -- src/app/TabBar.test.tsx`
Expected before implementation: FAIL (module not found). After: PASS.

- [ ] **Step 7: Run build and commit**

```bash
npm run typecheck
npm run build
git add .
git commit -m "chore: scaffold ClosetTrace PWA shell"
```

---

## Task 2: Domain enums, Dexie schema, dictionary seed

**Files:**
- Create: `src/domain/types.ts`, `src/db/types.ts`, `src/db/schema.ts`, `src/db/seed.ts`
- Create: `src/content/categories.json`, `src/content/scenes.json`, `src/content/colors.json`, `src/content/style-tags.json`
- Create: `src/db/repositories/settings.ts`, `src/db/repositories/diagnostics.ts`
- Create: `src/db/seed.test.ts`

**Interfaces:**
- Produces: `Slot`, `Season`, `ItemStatus`, `Pattern`, `Cents`, `ISODate`, `ISODateTime`.
- Produces entities exactly as design §5.3.
- Produces `ClosetTraceDB`, singleton `db`, `seedDatabase(db?)`, `SEED_VERSION`.
- Produces `getSetting<T>(key, fallback)`, `setSetting(key, value)`.

- [ ] **Step 1: Write the failing seed test**

```ts
import { describe, expect, it } from 'vitest';
import { ClosetTraceDB } from './schema';
import { seedDatabase } from './seed';

describe('seedDatabase', () => {
  it('seeds dictionary content but no garments', async () => {
    const db = new ClosetTraceDB('seed-test');
    await seedDatabase(db);
    expect(await db.categories.count()).toBeGreaterThanOrEqual(50);
    expect(await db.scenes.count()).toBe(9);
    expect(await db.colors.count()).toBeGreaterThanOrEqual(20);
    expect(await db.items.count()).toBe(0);
    expect(await db.outfits.count()).toBe(0);
    expect(await db.wearLogs.count()).toBe(0);
    await db.delete();
  });

  it('is idempotent', async () => {
    const db = new ClosetTraceDB('seed-idempotent');
    await seedDatabase(db);
    const before = await db.categories.count();
    await seedDatabase(db);
    expect(await db.categories.count()).toBe(before);
    await db.delete();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/db/seed.test.ts`
Expected: FAIL with missing modules.

- [ ] **Step 3: Define types and schema**

Use design §5.3 verbatim. Add `colors` and `styleTags` tables to the dictionary group, so v1 has **16 tables**:

```
items, itemPhotos, categories, locations, outfits, outfitItems, wearLogs,
scenes, outfitFeedback, purchases, wishlistItems, priceQuotes,
colors, styleTags, settings, diagnostics
```

Dexie v1 stores:

```ts
this.version(1).stores({
  items: 'id, name, categoryId, status, locationId, lastWornAt, updatedAt, archivedAt, *sceneTags, *seasons, *styleTags',
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
```

IndexedDB rejects booleans as index keys, so `isFavorite`, `archived`, and `isNeutral` are stored but filtered in memory (wardrobe ≤ 2000 items).

- [ ] **Step 4: Write dictionary content**

`categories.json` must contain top-level IDs `builtin:cat:top`, `builtin:cat:bottom`, `builtin:cat:dress`, `builtin:cat:outer`, `builtin:cat:shoes`, `builtin:cat:bag`, `builtin:cat:accessory`, `builtin:cat:underwear`, `builtin:cat:sport`, plus at least 50 children with `slot`, `defaultFormality`, `defaultWarmth`, `defaultSeasons`.

`scenes.json` must contain exactly the 9 design scenes with IDs `builtin:scene:commute`, `business`, `casual`, `date`, `party`, `sport`, `home`, `outdoor`, `travel`.

`colors.json` must contain at least 20 swatches with `hue` and `family`; include all design §4.5 colors.

`style-tags.json` must contain 10 tags: 简约、休闲、商务、运动、街头、复古、甜美、机能、文艺、中性.

- [ ] **Step 5: Implement seed upsert**

`seedDatabase` reads JSON, upserts by ID with `bulkPut`, updates `seedVersion` setting only after success. Never deletes user rows. Never writes items/outfits/wearLogs.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/db/seed.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/domain src/db src/content
git commit -m "feat: add Dexie schema and dictionary seed"
```

---

## Task 3: Pure domain primitives — date, money, weather, color

**Files:**
- Create: `src/domain/date.ts`, `src/domain/money.ts`, `src/domain/weather.ts`, `src/domain/color.ts`, `src/domain/random.ts`
- Create: `src/domain/date.test.ts`, `src/domain/money.test.ts`, `src/domain/weather.test.ts`, `src/domain/color.test.ts`, `src/domain/random.test.ts`

**Interfaces:**
- `todayISO(): ISODate`
- `weekStart(date: ISODate): ISODate`
- `diffDays(from: ISODate, to: ISODate): number`
- `formatDateZh(date: ISODate): string`
- `parseYuanToCents(input: string): Cents | null`
- `formatCents(cents: Cents): string`
- `landedCents(price: Cents, shipping: Cents, discount: Cents): Cents`
- `tempBand(tempC: number, sensitivity: 'cold' | 'normal' | 'hot'): { targetWarmth: number; needsOuter: boolean; label: string }`
- `colorPairScore(a: ColorSwatch, b: ColorSwatch): number`
- `outfitColorScore(colors: ColorSwatch[], patternCount: number): number` (0-30)
- `mulberry32(seed: number): () => number`, `hashSeed(...parts: string[]): number`

- [ ] **Step 1: Write failing tests**

Include boundary cases:

```ts
describe('tempBand', () => {
  it.each([
    [30, 1.0, false],
    [29, 1.5, false],
    [24, 2.0, false],
    [18, 3.0, false],
    [12, 4.0, true],
    [5, 5.0, true],
  ])('%i°C → warmth %f', (temp, warmth, outer) => {
    expect(tempBand(temp, 'normal')).toMatchObject({ targetWarmth: warmth, needsOuter: outer });
  });
  it('shifts for cold sensitivity', () => {
    expect(tempBand(12, 'cold').targetWarmth).toBe(4.5);
  });
});

describe('money', () => {
  it('parses yuan to cents', () => {
    expect(parseYuanToCents('199.5')).toBe(19950);
    expect(parseYuanToCents('0')).toBe(0);
    expect(parseYuanToCents('abc')).toBeNull();
  });
  it('computes landed price', () => {
    expect(landedCents(19900, 1000, 500)).toBe(20400);
  });
});

describe('color', () => {
  it('scores neutral pairs highest', () => {
    expect(colorPairScore(white, black)).toBe(100);
  });
  it('scores neutral + color high', () => {
    expect(colorPairScore(white, red)).toBe(92);
  });
  it('penalizes two patterns', () => {
    expect(outfitColorScore([white, black, brown], 2)).toBeLessThan(
      outfitColorScore([white, black, brown], 0),
    );
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/domain`
Expected: FAIL missing modules.

- [ ] **Step 3: Implement functions**

`colorPairScore` rules exactly as design §6.1. Use `Math.min(Math.abs(a.hue - b.hue), 360 - Math.abs(a.hue - b.hue))` for hue distance. `outfitColorScore` = `0.6 * min + 0.4 * avg`, mapped /100*30, then pattern penalty −10 and >3 non-neutral hues penalty −8, clamped to 0.

`tempBand` uses design §4.4; sensitivity shifts target by −0.5 (cold) or +0.5 (hot), clamped 1-5; `needsOuter` true at ≤12°C.

`mulberry32` is a standard 32-bit PRNG; `hashSeed` uses FNV-1a over joined parts.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: add date, money, weather, color domain primitives"
```

---

## Task 4: Item repository and filters

**Files:**
- Create: `src/db/repositories/items.ts`
- Create: `src/domain/itemFilter.ts`
- Create: `src/db/repositories/items.test.ts`, `src/domain/itemFilter.test.ts`

**Interfaces:**
- `createItem(input: NewItemInput): Promise<string>`
- `updateItem(id: string, patch: Partial<Item>): Promise<void>`
- `getItem(id: string): Promise<Item | undefined>`
- `listItems(filter?: ItemFilter): Promise<Item[]>`
- `setItemsStatus(ids: string[], status: ItemStatus): Promise<void>`
- `moveItems(ids: string[], locationId?: string): Promise<void>`
- `retireItem(id: string): Promise<void>`, `restoreItem(id: string): Promise<void>`
- `purgeItem(id: string): Promise<void>`
- `recalcItemStats(itemId: string): Promise<void>`
- `filterItems(items: Item[], filter: ItemFilter): Item[]`

**ItemFilter:**

```ts
export interface ItemFilter {
  query?: string;
  categoryId?: string;
  status?: ItemStatus | 'all';
  season?: Season;
  locationId?: string;
  colorId?: string;
  sceneId?: string;
  styleTag?: string;
  includeRetired?: boolean;
}
```

- [ ] **Step 1: Write failing repository tests**

Use `new ClosetTraceDB('items-test')`. Test:

1. `createItem` writes defaults (`status: 'available'`, `wearCount: 0`, `totalCostCents: 0`, `avoidRecommend: false`).
2. `listItems` hides `retired` by default and includes it with `includeRetired: true`.
3. `setItemsStatus` batch updates.
4. `moveItems` batch updates location.
5. `retireItem` sets `retired` + `archivedAt`; `restoreItem` clears it.
6. `purgeItem` deletes item + photos + purchases + outfitItems; wearLogs remain.

- [ ] **Step 2: Write failing filter tests**

`filterItems` matches Chinese substring in name/brand/note/tags; combines category/status/season/location/color/scene/style; returns sorted by `updatedAt` desc by default.

- [ ] **Step 3: Implement repository**

Use `db.transaction('rw', [db.items, db.itemPhotos, db.purchases, db.outfitItems, db.wearLogs], ...)` for purge. Never delete `wearLogs`; snapshots preserve history. Throwing on missing item is not necessary; return silently or log diagnostic.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/db/repositories/items.test.ts src/domain/itemFilter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: add item repository, filters, and soft delete"
```

---

## Task 5: Photo pipeline and photo repository

**Files:**
- Create: `src/lib/image.ts`, `src/db/repositories/photos.ts`
- Create: `src/lib/image.test.ts`, `src/db/repositories/photos.test.ts`
- Create: `src/components/item/PhotoPicker.tsx`, `src/components/item/PhotoPicker.test.tsx`

**Interfaces:**
- `fitDimensions(width, height, maxEdge): { width, height }`
- `compressImage(file: File): Promise<CompressedPhoto>` where `CompressedPhoto = { blob, thumbBlob, width, height, bytes }`
- `addPhoto(itemId, file): Promise<ItemPhoto>`
- `removePhoto(photoId): Promise<void>`
- `setCover(itemId, photoId): Promise<void>`
- `getPhoto(id)`, `getThumb(id)`, `listPhotos(itemId)`
- `PhotoPicker` props: `photos: ItemPhoto[]`, `onAdd(file: File)`, `onRemove(id)`, `onSetCover(id)`, `max?: number` (default 5).

- [ ] **Step 1: Write failing dimension tests**

```ts
it('scales landscape to max edge', () => {
  expect(fitDimensions(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
});
it('scales portrait to max edge', () => {
  expect(fitDimensions(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
});
it('keeps small images unchanged', () => {
  expect(fitDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
});
```

- [ ] **Step 2: Write failing photo repository test**

Create an item, add a `new Blob(['fake'], { type: 'image/jpeg' })` as photo, assert `itemPhotos` row, cover/thumb set on item; remove photo clears cover; setCover changes `coverPhotoId`.

- [ ] **Step 3: Implement compression**

`compressImage` uses `createImageBitmap(file, { imageOrientation: 'from-image' })`; fallback to `<img>` + object URL. Draw to canvas, encode JPEG quality 0.82 (retry 0.72, 0.65 if >600KB), thumb 320px q0.70. Flatten transparency on white. Throw a typed `ImageError` on decode failure.

- [ ] **Step 4: Implement PhotoPicker**

- Hidden file input with `accept="image/*" capture="environment"`.
- 5 slots grid; add tile; each photo has remove and “设为封面”.
- Shows compression spinner; disables add while uploading.
- Accessible labels: `添加照片`, `移除照片`, `设为封面`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/lib/image.test.ts src/db/repositories/photos.test.ts src/components/item/PhotoPicker.test.tsx`
Expected: PASS. Canvas compression itself is covered by E2E/manual, not jsdom.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: add client-side photo compression and photo repository"
```

---

## Task 6: Categories and locations repositories

**Files:**
- Create: `src/db/repositories/categories.ts`, `src/db/repositories/locations.ts`
- Create: `src/domain/locationTree.ts`
- Create: `src/db/repositories/categories.test.ts`, `src/db/repositories/locations.test.ts`, `src/domain/locationTree.test.ts`
- Create: `src/components/item/CategoryPicker.tsx`, `src/components/item/LocationPicker.tsx`

**Interfaces:**
- `listCategories(includeArchived?)`
- `createCategory(input)`, `updateCategory(id, patch)`, `deleteCategory(id)`
- `listLocations()`, `createLocation(input)`, `updateLocation`, `deleteLocation(id)`
- `buildLocationTree(locations): LocationNode[]`
- `locationPath(locations, id): string`
- `CategoryPicker` props: `value?: string`, `onChange(id: string)`, `label?`.
- `LocationPicker` props: `value?: string`, `onChange(id?: string)`, `allowCreate?: boolean`.

- [ ] **Step 1: Write failing tests**

- `deleteCategory` throws if category has items or children; succeeds when empty custom.
- Built-in category cannot be deleted.
- `deleteLocation` throws if it has items or child locations.
- `buildLocationTree` nests by `parentId`, preserves order, computes `totalCount` including descendants.
- `locationPath` returns `卧室 / 主衣柜 / 挂杆`; unknown returns `未指定`.

- [ ] **Step 2: Implement**

Use Dexie transactions. Category delete: check `items.where('categoryId').equals(id).count()` and child `categories.where('parentId').equals(id).count()`. Location delete: check items and child locations. Error messages in Chinese: `该类型下还有衣物，先迁移后再删除`, `该位置下还有衣物或子位置，先清空后再删除`.

- [ ] **Step 3: Implement pickers**

CategoryPicker is a Sheet with two-level list and search; selecting a leaf triggers `onChange(leafId)`. LocationPicker shows tree with `未指定` option and “新建位置” inline form (name + parent). Both keep focus return behavior.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/db/repositories/categories.test.ts src/db/repositories/locations.test.ts src/domain/locationTree.test.ts
git commit -am "feat: add category and location repositories with delete guards"
```

---

## Task 7: Wardrobe list, search, filters, batch selection

**Files:**
- Create: `src/features/wardrobe/WardrobePage.tsx`, `src/features/wardrobe/WardrobeFilters.tsx`, `src/features/wardrobe/BatchBar.tsx`
- Create: `src/components/item/ItemCard.tsx`
- Create: `src/features/wardrobe/WardrobePage.test.tsx`, `src/components/item/ItemCard.test.tsx`
- Modify: `src/app/App.tsx` to route `/wardrobe`

**Interfaces:**
- `WardrobePage` uses `useLiveQuery(() => listItems({ includeRetired: true }))` and `filterItems` in memory.
- `ItemCard` props: `item`, `category?`, `locationPath?`, `thumbUrl?`, `selected?`, `onClick`, `onLongPress?`.
- `BatchBar` props: `count`, `onMove`, `onStatus`, `onRetire`, `onCancel`.

- [ ] **Step 1: Write failing ItemCard test**

Render an item with no photo; assert name, category label, status text `待洗`, and color swatch fallback. Render with photo; assert `<img>` alt equals item name.

- [ ] **Step 2: Write failing WardrobePage test**

Seed 3 items (one laundry, one retired, one available) in fake DB; render with `MemoryRouter`; assert default list shows 2 (retired hidden), query search narrows, status filter shows laundry only. Use `findByText` with `waitFor`.

- [ ] **Step 3: Implement**

- Header: `衣橱` + count + `选择` + `+`.
- Search input with `useDeferredValue`.
- Filter chips: category, status, season, more sheet.
- Grid 2 columns; `ItemCard` uses thumb URL from `photosRepo.getThumb` via a small `useObjectUrl` hook; revoke on unmount.
- Empty state with add CTA; no fake data.
- Selection mode: tap toggles; BatchBar fixed above TabBar.
- Add button navigates `/wardrobe/item/new`.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/components/item/ItemCard.test.tsx src/features/wardrobe/WardrobePage.test.tsx
git commit -am "feat: add wardrobe list with search, filters, and batch selection"
```

---

## Task 8: Item form, item detail, move/status/delete

**Files:**
- Create: `src/features/wardrobe/ItemFormPage.tsx`, `src/features/wardrobe/ItemDetailPage.tsx`
- Create: `src/domain/itemForm.ts`
- Create: `src/features/wardrobe/ItemFormPage.test.tsx`, `src/features/wardrobe/ItemDetailPage.test.tsx`
- Modify: `src/app/App.tsx` routes `/wardrobe/item/new`, `/wardrobe/item/:id`

**Interfaces:**
- `defaultItemInput(category?: Category): NewItemInput`
- `validateItemInput(input): { ok: true } | { ok: false; errors: Record<string, string> }`
- `autoItemName(colorName: string, categoryName: string): string` → `白色 T 恤`
- `ItemFormPage` supports create and edit (`:id`).

- [ ] **Step 1: Write failing form tests**

- Selecting category fills `formality`, `warmth`, `seasons`, and auto name.
- Empty name after auto-fill shows validation error.
- Price `199.5` saves as `19950` cents and creates a purchase record.
- Photo add calls compressed photo mock; max 5.
- Cancel with draft restores from `sessionStorage`; save clears draft.

- [ ] **Step 2: Write failing detail tests**

- Shows location path and purchase total.
- “移出衣橱” calls retire; “彻底删除” requires confirmation.
- “加入待洗” changes status to `laundry`; button becomes “标记已洗”.
- “穿一次” opens date sheet and writes wear log.

- [ ] **Step 3: Implement form**

Sections: 基本信息 / 外观 / 属性 / 位置与购买. Use self-built `TextField`, `NumberField`, `MoneyField`, `SegmentedControl`, `CategoryPicker`, `ColorSwatchPicker`, `LocationPicker`, `PhotoPicker`. Sticky save bar. `sessionStorage` key `closet:draft:item:new` or `closet:draft:item:{id}`. On save, call `createItem`/`updateItem` in a transaction with photos and purchase.

- [ ] **Step 4: Implement detail**

Photo carousel (swipe/buttons), attributes, location, wear stats, CPW, purchase records, outfits using item, danger zone. Move sheet uses `LocationPicker`; status sheet; delete sheet with soft/hard options.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- src/features/wardrobe/ItemFormPage.test.tsx src/features/wardrobe/ItemDetailPage.test.tsx
git commit -am "feat: add item form and detail with delete semantics"
```

---

## Task 9: Locations view, batch organize, wardrobe insights

**Files:**
- Create: `src/features/wardrobe/LocationsPage.tsx`, `src/features/wardrobe/LocationDetailPage.tsx`, `src/features/wardrobe/WardrobeInsightsPage.tsx`
- Create: `src/domain/stats.ts`, `src/domain/stats.test.ts`
- Create: `src/features/wardrobe/WardrobeInsightsPage.test.tsx`
- Modify routes.

**Interfaces:**
- `utilization(items, wearLogs, nowISO, windowDays=90): number`
- `idleItems(items, nowISO, idleDays=90, minAgeDays=30): Item[]`
- `mostWorn(items, limit)`, `leastWorn(items, limit)`
- `categoryDistribution(items, categories)`, `colorDistribution(items, colors)`

- [ ] **Step 1: Write failing stats tests**

- Item worn today counts toward utilization; item only worn 100 days ago does not.
- Item added 10 days ago with no wear is not idle (min age 30).
- Idle item added 100 days ago and never worn is idle.
- Distribution excludes retired items.

- [ ] **Step 2: Implement pages**

LocationsPage shows tree with counts and `未指定`; create/edit/delete with guards. LocationDetailPage filters items by location subtree and supports batch move. WardrobeInsightsPage shows totals, utilization, idle top 10, category/color bars; empty state if no wear data.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/domain/stats.test.ts src/features/wardrobe/WardrobeInsightsPage.test.tsx
git commit -am "feat: add location views, batch organize, and wardrobe insights"
```

---

## Task 10: Onboarding, settings shell, Me page

**Files:**
- Create: `src/features/onboarding/OnboardingPage.tsx`, `src/features/settings/MePage.tsx`
- Create: `src/features/onboarding/OnboardingPage.test.tsx`, `src/features/settings/MePage.test.tsx`
- Modify: `src/app/App.tsx`, `src/app/DbGate.tsx`

**Interfaces:**
- `DbGate` runs `seedDatabase` then renders children; shows loading/error.
- `OnboardingPage` steps: privacy → style profile (skippable) → sizes (skippable) → location template (optional) → add first item (optional) → backup reminder.
- Settings keys: `onboardingDone`, `styleProfile`, `sizes`, `todaySceneId`, `todayTempC`, `backupReminderDays`, `lastBackupAt`, `theme`.
- `StyleProfile = { styleTags: string[]; favoriteColorIds: string[]; avoidColorIds: string[]; tempSensitivity: 'cold'|'normal'|'hot' }`.

- [ ] **Step 1: Write failing onboarding test**

- Fresh DB: onboarding renders; skip all → `onboardingDone=true`; `items.count()` stays 0.
- No sample garments are created.

- [ ] **Step 2: Write failing Me test**

- Shows count of items, backup entry, storage entry, style profile entry, scenes/categories/locations entries.
- No network links.

- [ ] **Step 3: Implement**

Onboarding uses a simple step state, not a router; each step has “跳过”. Location template button creates `卧室/主衣柜`, `玄关/鞋柜`, `储物间/换季收纳` only on explicit click. Add first item routes to `/wardrobe/item/new`.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/features/onboarding/OnboardingPage.test.tsx src/features/settings/MePage.test.tsx
git commit -am "feat: add onboarding and settings shell"
```

---

# Milestone 2 — Outfits and Wear Tracking

## Task 11: Outfit domain and repository

**Files:**
- Create: `src/domain/outfit.ts`, `src/domain/outfit.test.ts`
- Create: `src/db/repositories/outfits.ts`, `src/db/repositories/outfits.test.ts`

**Interfaces:**
- `outfitSignature(itemIds: string[]): string` (sorted, joined by `|`)
- `outfitCompleteness(itemSlots: Slot[], scene: Scene): { complete: boolean; missing: Slot[] }`
- `autoOutfitName(items: Item[], colors: ColorSwatch[]): string`
- `saveOutfit(input: { name?; sceneIds: string[]; items: Array<{ itemId; slot; order }>; isFavorite?; note? }): Promise<string>`
- `getOutfit(id)`, `listOutfits()`, `updateOutfit(id, patch, items?)`, `deleteOutfit(id)`, `toggleOutfitFavorite(id)`, `listOutfitsUsingItem(itemId)`

- [ ] **Step 1: Write failing tests**

- Signature is order-insensitive.
- Complete outfit needs top+bottom+shoes; dress replaces top+bottom.
- Outdoor ≤18°C requires outer; >18°C does not.
- Auto name uses color + category, e.g. `米白衬衫 + 黑西裤 + 棕色乐福鞋`.
- Repository save writes outfit + join rows in one transaction; update replaces joins; delete removes joins but leaves wearLogs.

- [ ] **Step 2: Implement**

Use `db.transaction('rw', db.outfits, db.outfitItems, ...)`. Set `updatedAt` on every change. `listOutfitsUsingItem` queries `outfitItems.where('itemId').equals(itemId)` then loads outfits.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/domain/outfit.test.ts src/db/repositories/outfits.test.ts
git commit -am "feat: add outfit domain and repository"
```

---

## Task 12: Outfit list, editor, detail

**Files:**
- Create: `src/features/outfits/OutfitsPage.tsx`, `src/features/outfits/OutfitEditorPage.tsx`, `src/features/outfits/OutfitDetailPage.tsx`
- Create: `src/components/outfit/OutfitCard.tsx`, `src/components/outfit/SlotPicker.tsx`
- Create: `src/features/outfits/OutfitEditorPage.test.tsx`, `src/features/outfits/OutfitDetailPage.test.tsx`
- Modify routes.

**Interfaces:**
- `OutfitsPage` segmented `我的搭配 / 为我推荐`; recommendation tab is a placeholder until Task 16.
- `OutfitEditorPage` handles create/edit; slot list in order top, bottom, dress, outer, shoes, bag, accessory.
- `SlotPicker` props: `slot`, `value?`, `sceneId?`, `onSelect(itemId?)`.

- [ ] **Step 1: Write failing editor test**

- Selecting items for top/bottom/shoes shows `可穿`.
- Removing shoes shows `缺鞋`.
- Saving calls `saveOutfit` with correct slots/order.
- Dress selection hides top/bottom slots.

- [ ] **Step 2: Write failing detail test**

- Shows items, scene chips, wear count, total cost, CPW.
- Favorite toggles.
- Delete asks confirmation; after delete, wear log still visible (test at repo level).

- [ ] **Step 3: Implement**

OutfitCard shows cover photo/mosaic, name, scene, wear count. Editor uses `useLiveQuery` for items; filter to available items by default with toggle “显示待洗/收纳”. Auto name preview. Detail actions: 穿这套 (Task 14), 编辑, 复制, 收藏, 删除.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/features/outfits/OutfitEditorPage.test.tsx src/features/outfits/OutfitDetailPage.test.tsx
git commit -am "feat: add outfit list, editor, and detail"
```

---

## Task 13: Wear log repository and stat recalculation

**Files:**
- Create: `src/db/repositories/wearLogs.ts`, `src/domain/wear.ts`
- Create: `src/db/repositories/wearLogs.test.ts`, `src/domain/wear.test.ts`

**Interfaces:**
- `logWear(input: { date: ISODate; outfitId?: string; sceneId?: string; tempC?: number; items: Item[]; note?: string }): Promise<string>`
- `deleteWearLog(id): Promise<void>`
- `listWearLogs(range?: { from: ISODate; to: ISODate })`
- `wearDaysForItem(itemId): Promise<number>`
- `recalcItemStats(itemId)`, `recalcOutfitStats(outfitId)`
- `distinctWearDates(logs, itemId): number`

- [ ] **Step 1: Write failing tests**

- Logging the same item on the same date twice does not increment `wearCount`.
- Logging on two dates increments to 2.
- `lastWornAt` is max date.
- Deleting a log recomputes `wearCount` and `lastWornAt` from remaining logs.
- Wear log stores item snapshots even if item is later purged.
- Outfit wear count uses distinct dates.

- [ ] **Step 2: Implement**

`logWear` transaction writes `wearLogs`, updates item caches, outfit cache. Store `itemIds` and `items` snapshots. `deleteWearLog` deletes and calls recalc for affected items/outfit.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/db/repositories/wearLogs.test.ts src/domain/wear.test.ts
git commit -am "feat: add wear logging with distinct-date statistics"
```

---

## Task 14: Today page with wear logging and laundry

**Files:**
- Create: `src/features/today/TodayPage.tsx`, `src/features/today/WearLogSheet.tsx`, `src/features/today/TodayPage.test.tsx`
- Modify routes.

**Interfaces:**
- `TodayPage` reads settings `todaySceneId`, `todayTempC`; shows recommendation placeholder until Task 16.
- `WearLogSheet` props: `open`, `onClose`, `date`, `presetOutfit?`, `presetItems?`.
- Supports logging by outfit or by items; optional scene/temp; “加入待洗” quick action.

- [ ] **Step 1: Write failing Today test**

- Empty wardrobe shows “先添加第一件衣服”.
- With items, shows temp control and scene chips.
- Logging a wear increases item wear count and shows “今天已穿”.
- Laundry card shows count and opens filtered wardrobe.

- [ ] **Step 2: Implement**

Header date + temp stepper; scene chips; recommendation placeholder card; today wear card; laundry card; idle card; backup reminder. Use `useLiveQuery` for items, wear logs, settings. No network.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/features/today/TodayPage.test.tsx
git commit -am "feat: add today page with wear logging and laundry"
```

---

# Milestone 3 — Recommendation Engine

## Task 15: Recommendation domain

**Files:**
- Create: `src/domain/recommend.ts`, `src/domain/recommend.test.ts`
- Create: `src/test/fixtures/wardrobe.ts`

**Interfaces:**

```ts
export interface RecommendationInput {
  scene: Scene;
  tempC: number;
  items: Item[];
  categories: Category[];
  colors: ColorSwatch[];
  outfits: Array<{ outfit: Outfit; items: Item[] }>;
  feedback: OutfitFeedback[];
  styleProfile: StyleProfile;
  seed: number;
}

export interface Recommendation {
  signature: string;
  items: Item[];
  score: number;
  reasons: string[];
  savedOutfitId?: string;
  relaxed: string[];
}
```

- [ ] **Step 1: Write failing tests**

Cover at minimum:

1. Required slots; ≤12°C adds outer; dress replaces top+bottom.
2. Excludes `laundry`, `repair`, `stored`, `retired`.
3. Scene formality filtering; style tags.
4. Temperature scoring; cold/hot sensitivity.
5. Color harmony: neutral combo beats clash.
6. Freshness: item worn yesterday is avoided when alternative exists.
7. Feedback: disliked signature excluded; liked saved outfit boosted.
8. Determinism: same seed → same result; different nonce → different result when alternatives exist.
9. Relaxation order and `relaxed` messages; status is never relaxed.
10. Insufficient slots returns `[]` and reasons include missing slot names.
11. Every result has at least one reason.
12. Saved outfits are included as candidates.

- [ ] **Step 2: Implement**

Follow design §4.7 and §6.2. Suggested structure:

```ts
export function recommend(input: RecommendationInput): Recommendation[] {
  const templates = buildTemplates(input.scene, input.tempC);
  const relaxing: RelaxLevel[] = ['strict', 'warmth', 'season', 'formality', 'freshness'];
  for (const level of relaxing) {
    const candidates = filterCandidates(input, level);
    const missing = missingSlots(input.scene, candidates, input.categories);
    if (missing.length > 0) continue;
    const combos = sampleCombos(candidates, templates, input.seed, input.categories);
    const results = [...combos, ...savedCombos(input)]
      .map((combo) => scoreCombo(combo, input))
      .filter((r) => !isDisliked(r.signature, input.feedback))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (results.length > 0) {
      return results.map((r) => ({ ...r, relaxed: level === 'strict' ? [] : [relaxMessage(level)] }));
    }
  }
  return [];
}
```

Scoring weights exactly as design §6.2: color 30, formality 20, warmth 20, style 10, freshness 10, feedback 5, novelty 5. Use `outfitColorScore` from Task 3. Use `mulberry32` from Task 3.

- [ ] **Step 3: Run tests**

```bash
npm test -- src/domain/recommend.test.ts
```

Expected: PASS all cases. Target <80ms for 500 items in a benchmark test (optional).

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: add deterministic outfit recommendation engine"
```

---

## Task 16: Recommendation panel and Today integration

**Files:**
- Create: `src/features/outfits/RecommendationPanel.tsx`
- Create: `src/components/outfit/RecommendationCard.tsx`
- Create: `src/features/outfits/RecommendationPanel.test.tsx`
- Modify: `src/features/today/TodayPage.tsx`, `src/features/outfits/OutfitsPage.tsx`

**Interfaces:**
- `RecommendationPanel` opens from Today/Outfits; props `open`, `onClose`, `initialSceneId?`, `initialTempC?`.
- Calls `recommend` with live items/outfits/feedback/style profile.
- “换一套” increments `nonce`.
- “喜欢/不喜欢” writes `outfitFeedback`.
- “保存” calls `saveOutfit`.
- “穿这套” opens `WearLogSheet` with preset.

- [ ] **Step 1: Write failing component test**

Mock `recommend` to return two results; assert scene/temp controls, reasons, and actions. Click “换一套” asserts recommend called with different seed. Click “不喜欢” asserts feedback repo called. Click “保存” asserts saveOutfit called. Missing-slot state shows CTA.

- [ ] **Step 2: Implement**

Use a Sheet with scene chips, temp stepper, sensitivity control, generate button, result cards. Show “已放宽季节限制” notice when `relaxed` non-empty. Empty state with missing slots and link to `/wardrobe/item/new`.

- [ ] **Step 3: Integrate Today**

Today hero shows top recommendation; “就穿这套” opens wear log; “换一套” regenerates; “查看 N 套” opens panel. If insufficient items, show setup checklist.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/features/outfits/RecommendationPanel.test.tsx src/features/today/TodayPage.test.tsx
git commit -am "feat: add recommendation panel and today integration"
```

---

## Task 17: Scene and style profile settings

**Files:**
- Create: `src/features/settings/ScenesPage.tsx`, `src/features/settings/StyleProfilePage.tsx`
- Create: `src/db/repositories/scenes.ts`, `src/db/repositories/scenes.test.ts`
- Create: `src/features/settings/StyleProfilePage.test.tsx`
- Modify routes and Me page.

**Interfaces:**
- `listScenes`, `createScene`, `updateScene`, `archiveScene`
- Style profile read/write via `settings` key `styleProfile`.
- Sizes via settings key `sizes` (`{ top?, bottom?, shoes?, dress? }`).

- [ ] **Step 1: Write failing tests**

- Built-in scenes read-only; custom scene create/update/archive.
- Archiving a scene used by outfits keeps the history and hides it from new selection.
- Style profile saves and reloads; no sample values.

- [ ] **Step 2: Implement**

ScenesPage lists built-in/custom, create/edit form with formality range, required/optional slots, style tags. StyleProfilePage has tag chips, color multi-select, temp sensitivity, sizes. All optional; empty is valid.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/db/repositories/scenes.test.ts src/features/settings/StyleProfilePage.test.tsx
git commit -am "feat: add scene and style profile settings"
```

---

# Milestone 4 — Purchase and Insights

## Task 18: Price domain, purchase/wishlist/quote repositories

**Files:**
- Create: `src/domain/price.ts`, `src/domain/price.test.ts`
- Create: `src/db/repositories/purchases.ts`, `src/db/repositories/wishlist.ts`
- Create: `src/db/repositories/purchases.test.ts`, `src/db/repositories/wishlist.test.ts`

**Interfaces:**
- `cpw(totalCostCents, wearCount): number | null`
- `lowestQuote(quotes): PriceQuote | null`
- `sortQuotesByLanded(quotes): PriceQuote[]`
- `priceDelta(quote, target?): { kind: 'below'|'above'|'equal'|'none'; cents: number }`
- `groupSpending(purchases, key: 'month'|'category'|'channel', items/categories): Array<{ key; cents }>`
- `addPurchase(input)`, `updatePurchase`, `deletePurchase`, `listPurchases(itemId?)`
- `addQuote(wishlistId, input)`, `deleteQuote`, `listQuotes(wishlistId)`
- `convertWishlistToPurchase(wishlistId, quoteId, itemId, purchaseInput)`

- [ ] **Step 1: Write failing domain tests**

- Landed price includes shipping/discount.
- CPW is null for 0 wears; 19900/12 ≈ 1658.33 cents.
- Lowest quote tie picks latest `observedAt`.
- Price delta below/above/equal/none.
- Spending groups by month/category/channel excluding quotes not purchased.

- [ ] **Step 2: Write failing repository tests**

- Purchase CRUD updates `items.totalCostCents` in same transaction.
- Deleting purchase recomputes.
- Wishlist create/update/status.
- Quote CRUD; sorting.
- Convert creates purchase, sets status `bought`, `convertedItemId`; quote history retained.

- [ ] **Step 3: Implement**

Use integer math for CPW; return a number rounded to cents for display but keep raw calculation in domain. Recalculate item cost after every purchase mutation.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/domain/price.test.ts src/db/repositories/purchases.test.ts src/db/repositories/wishlist.test.ts
git commit -am "feat: add price domain and purchase/wishlist repositories"
```

---

## Task 19: Purchase pages — wishlist, quotes, convert

**Files:**
- Create: `src/features/purchase/PurchasePage.tsx`, `src/features/purchase/WishlistDetailPage.tsx`, `src/features/purchase/WishlistFormSheet.tsx`, `src/features/purchase/QuoteFormSheet.tsx`
- Create: `src/features/purchase/PurchasePage.test.tsx`, `src/features/purchase/WishlistDetailPage.test.tsx`
- Modify routes.

**Interfaces:**
- `PurchasePage` segmented `待购比价 / 已购花费 / 穿着成本`.
- `WishlistFormSheet` fields: name, brand, category, size, color preference, target price, priority, note.
- `QuoteFormSheet` fields: channel, price, shipping, discount, date, URL, note.
- Wishlist detail shows quotes sorted by landed price, lowest badge, target delta, sparkline, `标记已购`.

- [ ] **Step 1: Write failing tests**

- Empty state has “记一件想买”.
- Add wishlist item → appears in list with target price.
- Add 3 quotes → sorted by landed price, lowest marked.
- Target delta correct.
- Mark purchased → item form prefilled; save creates item + purchase; wishlist status `bought`.
- Dropped wishlist hidden from default list with toggle to show.

- [ ] **Step 2: Implement**

Use `Sheet` for forms; `MoneyField` for prices. Quote URL rendered as `<a target="_blank" rel="noreferrer">` only after user click; no fetch. Price history via `Sparkline` (hand-written SVG). Keep all labels Chinese.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/features/purchase/PurchasePage.test.tsx src/features/purchase/WishlistDetailPage.test.tsx
git commit -am "feat: add purchase comparison and wishlist flows"
```

---

## Task 20: Spending, CPW, wardrobe insights integration

**Files:**
- Create: `src/features/purchase/SpendingPage.tsx`, `src/features/purchase/CpwPage.tsx`
- Create: `src/components/charts/BarList.tsx`, `src/components/charts/Sparkline.tsx`
- Create: `src/features/purchase/SpendingPage.test.tsx`, `src/features/purchase/CpwPage.test.tsx`
- Modify `WardrobeInsightsPage` to link to CPW.

**Interfaces:**
- `SpendingPage` shows month total, category/channel bars, recent purchases.
- `CpwPage` shows average CPW, top 10 highest CPW, zero-wear list, utilization.
- `BarList` props: `data: Array<{ label; value; hint? }>`, `max?`.
- `Sparkline` props: `values: number[]`, `width?`, `height?`, `label`.

- [ ] **Step 1: Write failing tests**

- Spending groups by month and category; empty state when no purchases.
- CPW list excludes zero-wear items; zero-wear section shows them separately.
- “再穿 X 次，CPW 降到 ¥Y” calculation correct.
- Sparkline renders no path with <2 points and a path with ≥2.

- [ ] **Step 2: Implement**

Hand-written SVG only; no chart library. Use `tabular-nums`. No guilt copy; neutral wording.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/features/purchase/SpendingPage.test.tsx src/features/purchase/CpwPage.test.tsx
git commit -am "feat: add spending, CPW, and chart components"
```

---

# Milestone 5 — Backup, PWA, Ship

## Task 21: Backup domain and repository

**Files:**
- Create: `src/domain/backup.ts`, `src/domain/backup.test.ts`
- Create: `src/db/repositories/backup.ts`, `src/db/repositories/backup.test.ts`
- Create: `src/test/fixtures/backup-v1.ts`

**Interfaces:**
- `BackupManifestSchema`, `BackupDataSchema` (Zod)
- `buildBackup(db, { includePhotos }): Promise<{ manifest; data; photos: Map<string, Uint8Array> }>`
- `validateBackup(zipBytes): Promise<{ manifest; data; photos }>`
- `importBackup(db, backup, mode: 'merge'|'replace'): Promise<Summary>`
- `exportBackupZip(backup, includePhotos): Uint8Array`

- [ ] **Step 1: Write failing tests**

- Manifest contains schema/seed versions and counts.
- Export excludes diagnostics.
- Validate rejects missing manifest / invalid JSON / newer schema.
- Merge keeps newer `items` by `updatedAt`, appends new wear logs, dedupes by ID.
- Merge replaces child rows for updated outfits.
- Replace clears all tables and restores.
- Photos round-trip as bytes; data-only import leaves photo refs and reports missing.
- Invalid import leaves original data unchanged.

- [ ] **Step 2: Implement**

Use fflate `zipSync`/`unzipSync`. Convert Blob ↔ Uint8Array. Zod parse with clear Chinese error messages. Merge in a single Dexie transaction. Never import diagnostics. Re-seed dictionary content after import.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/domain/backup.test.ts src/db/repositories/backup.test.ts
git commit -am "feat: add ZIP backup export/import with merge and replace"
```

---

## Task 22: Backup UI, diagnostics, storage usage

**Files:**
- Create: `src/features/backup/BackupPage.tsx`, `src/features/settings/DiagnosticsPage.tsx`, `src/features/settings/InstallGuidePage.tsx`
- Create: `src/features/backup/BackupPage.test.tsx`
- Modify routes and Me page.

**Interfaces:**
- Backup page: export complete/data-only, import merge/replace, preview counts, progress, last backup time.
- Diagnostics page: last 50 entries, copy text.
- Install guide: Safari add-to-home steps.
- Storage: `navigator.storage.estimate()` display; warn at 80%.

- [ ] **Step 1: Write failing tests**

- Export button calls export with correct mode.
- Import preview shows counts and requires mode selection.
- Replace requires confirmation checkbox.
- Data-only import shows photo warning.
- Backup reminder shows when last backup older than setting.

- [ ] **Step 2: Implement**

Use `Sheet` for import preview and confirmations. Web Share API when available; fallback download via `<a download>`. Show file size. Do not upload anywhere.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/features/backup/BackupPage.test.tsx
git commit -am "feat: add backup UI, diagnostics, and install guide"
```

---

## Task 23: PWA icons, security headers, E2E, final QA

**Files:**
- Create: `public/logo.svg`, `public/_headers`, `pwa-assets.config.ts`, `playwright.config.ts`, `e2e/onboarding.ts`, `e2e/smoke.spec.ts`, `e2e/wardrobe.spec.ts`, `e2e/recommend.spec.ts`, `e2e/backup.spec.ts`
- Modify: `README.md`

**Interfaces:**
- E2E runs against `npm run preview` after `npm run build`.
- Security headers exactly as design §8.5.

- [ ] **Step 1: Add logo and generate icons**

Create an SVG mark (hanger + garment silhouette) using the terracotta accent. Run `npm run icons`; ensure `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` exist.

- [ ] **Step 2: Add security headers**

Copy design §8.5 `_headers` verbatim. Verify no `_redirects` (Workers SPA fallback is in `wrangler.jsonc`).

- [ ] **Step 3: Add Playwright config and E2E**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

E2E cases:

1. Onboarding → skip → empty wardrobe → add item with photo placeholder → reload persists.
2. Add top/bottom/shoes → Today → recommend → wear → item wear count increments.
3. Manual outfit → save → favorite → delete → wear history remains.
4. Wishlist → 3 quotes → lowest → convert to item/purchase → CPW page.
5. Export backup (data-only is enough for test speed) → clear → import → counts match.

- [ ] **Step 4: Run full QA**

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run e2e -- --project=chromium
```

Expected: all pass. If WebKit is not installed, document it as manual/iPhone-only.

- [ ] **Step 5: Write README**

Include: local dev, scripts, install to iPhone, backup routine, privacy, data model summary, known limits (manual price quotes, no weather API, no AI, WebKit manual).

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add PWA icons, security headers, E2E, and release docs"
```

---

## Self-Review Checklist

- [ ] Every design requirement maps to a task: wardrobe CRUD, photos, locations, batch organize, manual outfits, recommendation, scenes, price comparison, spending, CPW, backup, PWA, tests.
- [ ] No task uses sample garments or personal defaults.
- [ ] All money paths use cents; all dates use local `YYYY-MM-DD`.
- [ ] Recommendation is pure, deterministic, and tested for exclusion/relaxation.
- [ ] Price comparison never fetches network.
- [ ] Deletion defaults to soft delete; hard delete cascades only intended rows and preserves wear snapshots.
- [ ] Backup includes photos optionally and validates before writing.
- [ ] Type names/signatures match across tasks (`Item`, `Scene`, `Outfit`, `WearLog`, `Recommendation`, `PriceQuote`).
- [ ] Full gate commands are listed and runnable.
