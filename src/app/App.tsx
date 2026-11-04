import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DbGate } from './DbGate';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from './ThemeProvider';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { TodayPage } from '../features/today/TodayPage';
import { WardrobePage } from '../features/wardrobe/WardrobePage';
import { ItemFormPage } from '../features/wardrobe/ItemFormPage';
import { ItemDetailPage } from '../features/wardrobe/ItemDetailPage';
import { LocationsPage } from '../features/wardrobe/LocationsPage';
import { LocationDetailPage } from '../features/wardrobe/LocationDetailPage';
import { WardrobeInsightsPage } from '../features/wardrobe/WardrobeInsightsPage';
import { OutfitsPage } from '../features/outfits/OutfitsPage';
import { OutfitEditorPage } from '../features/outfits/OutfitEditorPage';
import { OutfitDetailPage } from '../features/outfits/OutfitDetailPage';
import { PurchasePage } from '../features/purchase/PurchasePage';
import { WishlistDetailPage } from '../features/purchase/WishlistDetailPage';
import { SpendingPage } from '../features/purchase/SpendingPage';
import { CpwPage } from '../features/purchase/CpwPage';
import { MePage } from '../features/settings/MePage';
import { ScenesPage } from '../features/settings/ScenesPage';
import { StyleProfilePage } from '../features/settings/StyleProfilePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<AppShell />}>
        <Route index element={<TodayPage />} />
        <Route path="/wardrobe" element={<WardrobePage />} />
        <Route path="/wardrobe/item/new" element={<ItemFormPage />} />
        <Route path="/wardrobe/item/:id" element={<ItemDetailPage />} />
        <Route path="/wardrobe/item/:id/edit" element={<ItemFormPage />} />
        <Route path="/wardrobe/locations" element={<LocationsPage />} />
        <Route path="/wardrobe/locations/:id" element={<LocationDetailPage />} />
        <Route path="/wardrobe/insights" element={<WardrobeInsightsPage />} />
        <Route path="/outfits" element={<OutfitsPage />} />
        <Route path="/outfits/new" element={<OutfitEditorPage />} />
        <Route path="/outfits/:id" element={<OutfitDetailPage />} />
        <Route path="/outfits/:id/edit" element={<OutfitEditorPage />} />
        <Route path="/purchase" element={<PurchasePage />} />
        <Route path="/purchase/wishlist/:id" element={<WishlistDetailPage />} />
        <Route path="/purchase/spending" element={<SpendingPage />} />
        <Route path="/purchase/cpw" element={<CpwPage />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/me/style" element={<StyleProfilePage />} />
        <Route path="/me/scenes" element={<ScenesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeProvider>
          <DbGate>
            <AppRoutes />
          </DbGate>
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
