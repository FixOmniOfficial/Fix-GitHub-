import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home,
  Users,
  Wrench,
  Bell,
  Calculator as CalculatorIcon,
  BarChart3,
  Settings,
  UserCircle,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useGetSettings, useListReminders } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'डैशबोर्ड', subtitle: 'Dashboard', icon: Home, href: '/' },
  { label: 'ग्राहक', subtitle: 'Customers', icon: Users, href: '/customers' },
  { label: 'कार्य', subtitle: 'Jobs', icon: Wrench, href: '/jobs' },
  { label: 'रिमाइंडर', subtitle: 'Reminders', icon: Bell, href: '/reminders' },
  { label: 'कैलकुलेटर', subtitle: 'Calculator', icon: CalculatorIcon, href: '/calculator' },
  { label: 'रिपोर्ट्स', subtitle: 'Reports', icon: BarChart3, href: '/reports' },
];

const bottomItems = [
  { label: 'यूज़र्स', subtitle: 'Users', icon: UserCircle, href: '/users' },
  { label: 'सेटिंग्स', subtitle: 'Settings', icon: Settings, href: '/settings' },
];

function NavLink({
  item,
  isActive,
  badge,
  onClick,
}: {
  item: typeof navItems[0];
  isActive: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link href={item.href} onClick={onClick}>
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 transition-all duration-150 cursor-pointer group',
          isActive
            ? 'bg-amber-500/15 border-l-[3px] border-amber-400 text-amber-300 font-semibold pl-2.5'
            : 'border-l-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}
      >
        <item.icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors',
            isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm leading-none', isActive ? 'text-amber-200' : '')}>
            {item.label}
          </div>
          <div className="text-[10px] mt-0.5 text-slate-600 group-hover:text-slate-500 leading-none">
            {item.subtitle}
          </div>
        </div>
        {badge != null && badge > 0 && (
          <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: settings } = useGetSettings();
  const { data: reminders } = useListReminders({ isActive: true });

  const dueRemindersCount = useMemo(() => {
    if (!reminders) return 0;
    const now = new Date();
    return reminders.filter((r) => new Date(r.reminderAt) <= now).length;
  }, [reminders]);

  // Theme
  useEffect(() => {
    if (!settings?.theme) return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (settings.theme === 'system') {
      root.classList.add(
        window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      );
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings?.theme]);

  // Caption zoom — stored as CSS variable, only applies to .caption-text elements
  useEffect(() => {
    const size = settings?.captionSize ?? 1;
    // Keep page font normal; only highlights/captions read this variable
    document.documentElement.style.setProperty('--caption-zoom', String(size));
  }, [settings?.captionSize]);

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">सर्विस मैनेजर</div>
            <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">
              Service Center
            </div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
        <div className="px-3 mb-1">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
            Menu
          </span>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            badge={item.href === '/reminders' ? dueRemindersCount : undefined}
            onClick={onNav}
          />
        ))}

        <div className="px-3 pt-4 mb-1">
          <div className="border-t border-slate-800/60 mb-3" />
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
            System
          </span>
        </div>
        {bottomItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            onClick={onNav}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800/60">
        <div className="text-[10px] text-slate-700 text-center">v1.0 · सर्विस सेंटर</div>
      </div>
    </div>
  );

  return (
    <div
      className="flex min-h-screen w-full"
      style={{
        backgroundImage: settings?.globalWallpaper ? `url(${settings.globalWallpaper})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {settings?.globalWallpaper && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm pointer-events-none z-0" />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-slate-900 border-r border-slate-800 z-10 fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-56 bg-slate-900 border-r border-slate-800 z-40 md:hidden transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent onNav={() => setMobileOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:ml-56 relative z-10 min-h-screen">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">सर्विस मैनेजर</span>
          </div>
          {dueRemindersCount > 0 && (
            <span className="ml-auto bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {dueRemindersCount}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-auto bg-background">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
