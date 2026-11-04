import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/wardrobe', label: '单品', end: true },
  { to: '/wardrobe/locations', label: '位置', end: false },
  { to: '/wardrobe/insights', label: '分析', end: false },
];

export function WardrobeTabs() {
  return (
    <nav
      aria-label="衣橱视图"
      className="mb-3 flex rounded-full border border-line bg-bg p-1"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `flex min-h-9 flex-1 items-center justify-center rounded-full px-3 text-sm ${
              isActive ? 'bg-surface font-medium text-text shadow-sm' : 'text-muted'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
