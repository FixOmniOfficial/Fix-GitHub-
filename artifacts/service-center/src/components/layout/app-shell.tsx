import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Home, 
  Users, 
  Wrench, 
  Bell, 
  Calculator as CalculatorIcon, 
  BarChart, 
  Settings, 
  UserCircle 
} from 'lucide-react';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from '@/components/ui/sidebar';
import { useGetSettings, useListReminders } from '@workspace/api-client-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const { data: reminders } = useListReminders({ isActive: true });

  const dueRemindersCount = useMemo(() => {
    if (!reminders) return 0;
    const now = new Date();
    return reminders.filter(r => new Date(r.reminderAt) <= now).length;
  }, [reminders]);

  useEffect(() => {
    if (settings?.theme) {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      if (settings.theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(settings.theme);
      }
    }
  }, [settings?.theme]);

  // Handle caption zoom level on root
  useEffect(() => {
    if (settings?.captionSize) {
      document.documentElement.style.fontSize = `${16 * settings.captionSize}px`;
    }
  }, [settings?.captionSize]);

  const navItems = [
    { label: 'डैशबोर्ड', subtitle: 'Dashboard', icon: Home, href: '/' },
    { label: 'ग्राहक सूची', subtitle: 'Customers', icon: Users, href: '/customers' },
    { label: 'कार्य सूची', subtitle: 'Jobs', icon: Wrench, href: '/jobs' },
    { label: 'रिमाइंडर', subtitle: 'Reminders', icon: Bell, href: '/reminders', badge: dueRemindersCount },
    { label: 'कैलकुलेटर', subtitle: 'Calculator', icon: CalculatorIcon, href: '/calculator' },
    { label: 'रिपोर्ट्स', subtitle: 'Reports', icon: BarChart, href: '/reports' },
    { label: 'यूज़र्स', subtitle: 'Users', icon: UserCircle, href: '/users' },
    { label: 'सेटिंग्स', subtitle: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <SidebarProvider>
      <div 
        className="flex min-h-screen w-full bg-background"
        style={{
          backgroundImage: settings?.globalWallpaper ? `url(${settings.globalWallpaper})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        {settings?.globalWallpaper && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-none" />
        )}
        <Sidebar className="border-r shadow-sm bg-card/95 backdrop-blur-md z-10">
          <SidebarHeader className="p-4 border-b">
            <h1 className="text-xl font-bold text-primary flex flex-col">
              <span>सर्विस मैनेजर</span>
              <span className="text-xs font-normal text-muted-foreground uppercase tracking-widest">Service Center</span>
            </h1>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location === item.href || (item.href !== '/' && location.startsWith(item.href))}
                      >
                        <Link href={item.href} className="flex items-center gap-3 w-full py-2">
                          <item.icon className="w-5 h-5" />
                          <div className="flex flex-col flex-1">
                            <span className="font-semibold leading-none">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                          </div>
                          {item.badge > 0 && (
                            <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 overflow-auto relative z-0">
          <div className="container mx-auto p-6 max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
