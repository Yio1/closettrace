import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DbGate } from './DbGate';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from './ThemeProvider';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { TodayPage } from '../features/today/TodayPage';
import { WardrobePage } from '../features/wardrobe/WardrobePage';
import { OutfitsPage } from '../features/outfits/OutfitsPage';
import { PurchasePage } from '../features/purchase/PurchasePage';
import { MePage } from '../features/settings/MePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<AppShell />}>
        <Route index element={<TodayPage />} />
        <Route path="/wardrobe" element={<WardrobePage />} />
        <Route path="/outfits" element={<OutfitsPage />} />
        <Route path="/purchase" element={<PurchasePage />} />
        <Route path="/me" element={<MePage />} />
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
