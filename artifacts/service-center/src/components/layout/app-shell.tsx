import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home, Users, Wrench, Bell,
  Calculator as CalculatorIcon,
  BarChart3, Settings, UserCircle, Menu, LogOut,
  UserCog, Layers, Fingerprint, FlaskConical, Hammer,
} from 'lucide-react';
import { useGetSettings, useListReminders } from '@workspace/api-client-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useUser, useClerk } from '@clerk/react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';

// All nav items — label = Hindi, subtitle = English
const NAV_ITEMS = [
  { label: 'डैशबोर्ड', subtitle: 'Dashboard',   icon: Home,            href: '/' },
  { label: 'ग्राहक / कार्य', subtitle: 'Customers & Jobs', icon: Users, href: '/customers' },
  { label: 'रिमाइंडर', subtitle: 'Reminders',    icon: Bell,            href: '/reminders' },
  { label: 'कैलकुलेटर', subtitle: 'Calculator',  icon: CalculatorIcon,  href: '/calculator' },
  { label: 'रिपोर्ट्स', subtitle: 'Reports',     icon: BarChart3,       href: '/reports' },
];

// Admin-only items in the System section
const ADMIN_ITEMS = [
  { label: 'तकनीशियन',  subtitle: 'Technicians',          icon: Hammer,      href: '/technicians' },
  { label: 'स्टाफ',      subtitle: 'Staff',               icon: UserCog,     href: '/staff' },
  { label: 'कैटेगरी',   subtitle: 'Service Categories',   icon: Layers,      href: '/service-categories' },
];

// Items visible to admin OR staff with kyc_review permission
const KYC_ITEMS = [
  { label: 'KYC समीक्षा', subtitle: 'KYC Review', icon: Fingerprint, href: '/kyc-review' },
];

// Super-admin only
const SUPER_ADMIN_ITEMS = [
  { label: 'सैंडबॉक्स', subtitle: 'Testing Sandbox', icon: FlaskConical, href: '/sandbox' },
];

const BOTTOM_ITEMS = [
  { label: 'यूज़र्स',  subtitle: 'Users',    icon: UserCircle, href: '/users' },
  { label: 'सेटिंग्स', subtitle: 'Settings', icon: Settings,   href: '/settings' },
];

/** Pick the display text based on language setting */
function navLabel(item: { label: string; subtitle: string }, lang: string) {
  if (lang === 'en') return { primary: item.subtitle, secondary: null };
  if (lang === 'hi') return { primary: item.label,    secondary: null };
  return { primary: item.label, secondary: item.subtitle }; // both
}

function NavLink({
  item, isActive, badge, lang, onClick,
}: {
  item: { label: string; subtitle: string; icon: React.ElementType; href: string };
  isActive: boolean;
  badge?: number;
  lang: string;
  onClick?: () => void;
}) {
  const { primary, secondary } = navLabel(item, lang);
  return (
    <Link href={item.href} onClick={onClick}>
      <div className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 transition-all duration-150 cursor-pointer group',
        isActive
          ? 'bg-amber-500/15 border-l-[3px] border-amber-400 text-amber-300 font-semibold pl-2.5'
          : 'border-l-[3px] border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5',
      )}>
        <item.icon className={cn('w-4 h-4 shrink-0 transition-colors',
          isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300')} />
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm leading-none', isActive ? 'text-amber-200' : '')}>
            {primary}
          </div>
          {secondary && (
            <div className="text-[10px] mt-0.5 text-slate-600 group-hover:text-slate-500 leading-none">
              {secondary}
            </div>
          )}
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
  const [location]    = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoZoomOpen, setLogoZoomOpen] = useState(false);
  const { data: settings }  = useGetSettings();
  const { data: reminders } = useListReminders({ isActive: true });
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isAdmin, isStaff, hasPermission, isSuperAdmin } = useRole();

  // Cast to extended type that includes our extra fields
  const ext = settings as typeof settings & { shopName?: string; logoUrl?: string };
  const shopName = ext?.shopName || 'Fix Omni';
  const logoUrl  = ext?.logoUrl  || '';
  const lang     = (settings?.language as string) || 'both';

  const dueCount = useMemo(() => {
    if (!reminders) return 0;
    const now = new Date();
    return reminders.filter(r => new Date(r.reminderAt) <= now).length;
  }, [reminders]);

  // Theme
  useEffect(() => {
    if (!settings?.theme) return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (settings.theme === 'system') {
      root.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings?.theme]);

  // Caption zoom
  useEffect(() => {
    document.documentElement.style.setProperty('--caption-zoom', String(settings?.captionSize ?? 1));
  }, [settings?.captionSize]);

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  // Decide which nav items are visible for staff based on permissions
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (isAdmin) return true;     // admins see everything
    if (!isStaff) return true;    // non-staff (technician, viewer) see all nav
    // Staff: filter by permissions
    if (item.href === '/customers') return hasPermission('booking_management');
    if (item.href === '/reports') return hasPermission('analytics');
    return true; // dashboard, reminders, calculator always visible
  });

  function SidebarContent({ onNav }: { onNav?: () => void }) {
    return (
      <div className="flex flex-col h-full">
        {/* Logo / shop identity */}
        <div className="px-4 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            {/* Clickable logo — opens zoom overlay */}
            <button
              type="button"
              onClick={() => setLogoZoomOpen(true)}
              className="shrink-0 rounded-xl ring-0 hover:ring-2 hover:ring-amber-400/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              title="Logo zoom करें"
            >
              <Avatar className="w-9 h-9 rounded-xl border border-amber-500/30">
                <AvatarImage src={logoUrl} className="object-cover rounded-xl" />
                <AvatarFallback className="rounded-xl bg-amber-500/20 text-amber-400 text-xs font-bold">
                  {shopName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white leading-tight truncate">{shopName}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Service Center</div>
            </div>
          </div>
        </div>

        {/* Main nav */}
        <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
          <div className="px-3 mb-1">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Menu</span>
          </div>
          {visibleNavItems.map(item => (
            <NavLink
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              badge={item.href === '/reminders' ? dueCount : undefined}
              lang={lang}
              onClick={onNav}
            />
          ))}

          {/* Admin-only system section */}
          <div className="px-3 pt-4 mb-1">
            <div className="border-t border-slate-800/60 mb-3" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">System</span>
          </div>

          {/* Admin-only nav (Staff + Categories) */}
          {isAdmin && ADMIN_ITEMS.map(item => (
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} lang={lang} onClick={onNav} />
          ))}

          {/* KYC Review — admin or staff with kyc_review permission */}
          {(isAdmin || hasPermission('kyc_review')) && KYC_ITEMS.map(item => (
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} lang={lang} onClick={onNav} />
          ))}

          {/* Sandbox — super_admin only */}
          {isSuperAdmin && SUPER_ADMIN_ITEMS.map(item => (
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} lang={lang} onClick={onNav} />
          ))}

          {BOTTOM_ITEMS.map(item => (
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} lang={lang} onClick={onNav} />
          ))}
        </div>

        {/* User + Logout */}
        <div className="px-3 py-3 border-t border-slate-800/60 space-y-2">
          {user && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-amber-400">
                  {(user.firstName || user.emailAddresses?.[0]?.emailAddress || 'U').slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-300 truncate">
                  {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.emailAddresses?.[0]?.emailAddress}
                </div>
                <div className="text-[10px] text-slate-600 truncate">{user.emailAddresses?.[0]?.emailAddress}</div>
              </div>
            </div>
          )}
          <button
            onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout / लॉगआउट</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen w-full"
      style={{
        backgroundImage: settings?.globalWallpaper ? `url(${settings.globalWallpaper})` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
      }}
    >
      {settings?.globalWallpaper && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm pointer-events-none z-0" />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-slate-900 border-r border-slate-800 z-10 fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Logo Zoom Modal ─────────────────────────────────────────────── */}
      {logoZoomOpen && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex flex-col items-center justify-center cursor-zoom-out"
          onClick={() => setLogoZoomOpen(false)}
        >
          <div className="animate-in zoom-in-50 fade-in duration-300 flex flex-col items-center gap-5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={shopName}
                className="w-72 h-72 object-contain shadow-2xl"
              />
            ) : (
              <div className="w-72 h-72 flex items-center justify-center">
                <span className="text-9xl font-black text-white">
                  {shopName.slice(0, 2)}
                </span>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{shopName}</div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      <aside className={cn(
        'fixed inset-y-0 left-0 w-56 bg-slate-900 border-r border-slate-800 z-40 md:hidden transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <SidebarContent onNav={() => setMobileOpen(false)} />
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col md:ml-56 relative z-10 min-h-screen">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <Avatar className="w-6 h-6 rounded-lg">
            <AvatarImage src={logoUrl} className="object-cover rounded-lg" />
            <AvatarFallback className="rounded-lg bg-amber-500/20 text-amber-400 text-[10px] font-bold">
              {shopName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-bold text-white truncate">{shopName}</span>
          {dueCount > 0 && (
            <span className="ml-auto bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {dueCount}
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
