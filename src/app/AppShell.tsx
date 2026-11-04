import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Layers, Shirt, Sun, User, Wallet } from 'lucide-react';
import { getSetting } from '../db/repositories/settings';
import { PwaUpdate } from './PwaUpdate';

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

export function AppShell() {
  const onboardingDone = useLiveQuery(
    () => getSetting<boolean>('onboardingDone', false),
    [],
  );

  if (onboardingDone === false) return <Navigate to="/onboarding" replace />;

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-[calc(env(safe-area-inset-top)+16px)]">
        <Outlet />
      </main>
      <PwaUpdate />
      <TabBar />
    </>
  );
}
