import React, { useEffect } from 'react';
import { useGetSettings, useUpdateSettings } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Palette, Image as ImageIcon, Type, Bell, Save,
  Sun, Moon, Monitor, Info, CheckCircle2, Languages,
  Store, Upload, ShieldAlert, Power,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSettingsQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { useRole } from '@/lib/use-role';

type SettingsForm = {
  theme: string;
  language: string;
  globalWallpaper: string;
  captionSize: number;
  notificationsEnabled: boolean;
  shopName: string;
  logoUrl: string;
};

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun, preview: 'bg-white border-slate-200', barColor: 'bg-slate-200', dotColor: 'bg-blue-500' },
  { value: 'dark',  label: 'Dark',  icon: Moon, preview: 'bg-slate-950 border-slate-700', barColor: 'bg-slate-700', dotColor: 'bg-blue-400' },
  { value: 'system',label: 'System',icon: Monitor, preview: 'bg-gradient-to-br from-white to-slate-900 border-slate-400', barColor: 'bg-slate-400', dotColor: 'bg-amber-400' },
];

const LANG_OPTIONS = [
  { value: 'en',   label: 'English', sub: 'English only' },
  { value: 'hi',   label: 'हिन्दी',   sub: 'Hindi only' },
  { value: 'both', label: 'Both',    sub: 'Hindi + English' },
];

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { isSuperAdmin } = useRole();

  // ── Master Panel Toggle state ─────────────────────────────────────────────
  const [panelEnabled,      setPanelEnabled]      = React.useState<boolean | null>(null);
  const [panelToggling,     setPanelToggling]     = React.useState(false);

  // Fetch panel status on mount (super_admin only)
  React.useEffect(() => {
    if (!isSuperAdmin) return;
    fetch(`${BASE}/api/settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPanelEnabled(d?.panelEnabled ?? true))
      .catch(() => setPanelEnabled(true));
  }, [isSuperAdmin]);

  const handlePanelToggle = async (enable: boolean) => {
    setPanelToggling(true);
    try {
      const r = await fetch(`${BASE}/api/admin/panel-toggle`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enable }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      setPanelEnabled(enable);
      toast.success(enable ? '✅ Admin panel ENABLED' : '🔴 Admin panel DISABLED');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPanelToggling(false);
    }
  };

  const { register, handleSubmit, setValue, watch, reset } = useForm<SettingsForm>({
    defaultValues: { theme: 'light', language: 'both', globalWallpaper: '', captionSize: 1, notificationsEnabled: true, shopName: 'Fix Omni', logoUrl: '/service-center/fixomni-logo.jpg' },
  });

  useEffect(() => {
    if (settings) {
      const s = settings as typeof settings & { shopName?: string; logoUrl?: string };
      reset({
        theme: settings.theme ?? 'light',
        language: (settings.language as string) ?? 'both',
        globalWallpaper: settings.globalWallpaper ?? '',
        captionSize: settings.captionSize ?? 1,
        notificationsEnabled: settings.notificationsEnabled ?? true,
        shopName: s.shopName ?? 'Fix Omni',
        logoUrl: s.logoUrl ?? '/service-center/fixomni-logo.jpg',
      });
    }
  }, [settings, reset]);

  const captionSize = watch('captionSize') ?? 1;
  const theme      = watch('theme');
  const language   = watch('language') ?? 'both';
  const logoUrl    = watch('logoUrl');
  const shopName   = watch('shopName');

  const onSubmit = (data: SettingsForm) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateSettings.mutate({ data: data as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast.success('Settings saved');
      },
      onError: () => toast.error('Failed to save'),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Customize app appearance and behavior</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="appearance" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-sm">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          {/* ── Appearance ── */}
          <TabsContent value="appearance" className="space-y-5">

            {/* Shop identity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="w-4 h-4 text-primary" /> Shop Identity
                </CardTitle>
                <CardDescription>Name and logo shown in the sidebar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Shop name */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Shop Name</label>
                  <Input
                    placeholder="e.g. Sharma AC Service"
                    {...register('shopName')}
                  />
                  <p className="text-xs text-muted-foreground">This name appears at the top of the sidebar.</p>
                </div>

                {/* Logo URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Logo Image URL <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <div className="flex gap-3 items-start">
                    <Avatar className="w-14 h-14 rounded-xl border-2 border-dashed border-border shrink-0">
                      <AvatarImage src={logoUrl || ''} className="object-cover rounded-xl" />
                      <AvatarFallback className="rounded-xl bg-amber-500/10 text-amber-600 text-xs font-bold">
                        {(shopName || 'SC').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1.5">
                      <Input
                        placeholder="https://example.com/logo.png"
                        {...register('logoUrl')}
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste a direct image URL. If blank, initials are shown.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Theme */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="w-4 h-4 text-primary" /> Theme
                </CardTitle>
                <CardDescription>Choose the app color scheme</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = theme === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setValue('theme', opt.value)}
                        className={cn('relative rounded-xl border-2 p-3 text-left transition-all focus:outline-none',
                          selected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-muted-foreground/40')}>
                        <div className={cn('h-14 rounded-lg border overflow-hidden mb-2', opt.preview)}>
                          <div className={cn('h-3 w-full', opt.barColor)} />
                          <div className="flex gap-1 p-1.5">
                            <div className={cn('h-2 w-2 rounded-full', opt.dotColor)} />
                            <div className={cn('h-2 flex-1 rounded opacity-60', opt.barColor)} />
                          </div>
                          <div className="flex gap-1 px-1.5">
                            <div className={cn('h-2 flex-1 rounded opacity-40', opt.barColor)} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium flex items-center gap-1"><Icon className="w-3 h-3" />{opt.label}</span>
                          {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Language */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Languages className="w-4 h-4 text-primary" /> Language
                </CardTitle>
                <CardDescription>
                  Controls nav labels throughout the app
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {LANG_OPTIONS.map((opt) => {
                    const selected = language === opt.value;
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setValue('language', opt.value)}
                        className={cn('rounded-xl border-2 px-3 py-3 text-left transition-all focus:outline-none',
                          selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground/40')}>
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{opt.sub}</div>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-1" />}
                      </button>
                    );
                  })}
                </div>
                {/* Live preview */}
                <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-dashed text-sm space-y-1">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Preview</p>
                  {language === 'hi'   && <><div className="font-semibold">डैशबोर्ड</div><div className="font-semibold">ग्राहक</div><div className="font-semibold">कार्य</div></>}
                  {language === 'en'   && <><div className="font-semibold">Dashboard</div><div className="font-semibold">Customers</div><div className="font-semibold">Jobs</div></>}
                  {language === 'both' && <>
                    <div><span className="font-semibold">डैशबोर्ड</span> <span className="text-muted-foreground text-xs">Dashboard</span></div>
                    <div><span className="font-semibold">ग्राहक</span> <span className="text-muted-foreground text-xs">Customers</span></div>
                    <div><span className="font-semibold">कार्य</span> <span className="text-muted-foreground text-xs">Jobs</span></div>
                  </>}
                </div>
              </CardContent>
            </Card>

            {/* Wallpaper */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="w-4 h-4 text-primary" /> Background Wallpaper
                </CardTitle>
                <CardDescription>Paste an image URL. Leave blank for default.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="https://example.com/bg.jpg" {...register('globalWallpaper')} />
                {watch('globalWallpaper') && (
                  <div className="h-24 rounded-lg border bg-cover bg-center relative overflow-hidden"
                    style={{ backgroundImage: `url(${watch('globalWallpaper')})` }}>
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Preview</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Caption size */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Type className="w-4 h-4 text-primary" /> Caption Text Size
                </CardTitle>
                <CardDescription>Controls highlight caption size only — not the whole app</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-semibold tabular-nums">
                    {captionSize === 1 ? 'Normal (1×)' : `${captionSize.toFixed(2)}×`}
                  </span>
                </div>
                <Slider min={0.85} max={1.3} step={0.05} value={[captionSize]}
                  onValueChange={(v) => setValue('captionSize', v[0])} />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Smaller</span><span>Normal</span><span>Larger</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-dashed flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-200 font-medium"
                    style={{ fontSize: `${captionSize}em` }}>
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] flex items-center justify-center font-bold">1</span>
                    AC Gas Filled
                  </span>
                  <span className="text-xs text-muted-foreground">← caption preview</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Notifications ── */}
          <TabsContent value="notifications" className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="w-4 h-4 text-primary" /> Reminders & Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-sm">Enable Reminder Notifications</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Show alerts for due reminders</div>
                  </div>
                  <Switch checked={watch('notificationsEnabled') ?? true}
                    onCheckedChange={(v) => setValue('notificationsEnabled', v)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2 opacity-50 pointer-events-none">
                  <div>
                    <div className="font-medium text-sm">Overdue Payment Alerts</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Coming soon</div>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── About ── */}
          <TabsContent value="about" className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="w-4 h-4 text-primary" /> App Info
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {[
                  { label: 'App Name', value: 'Fix Omni' },
                  { label: 'Version', value: '1.0.0' },
                  { label: 'Language', value: 'Hindi + English (Bilingual)' },
                  { label: 'Database', value: 'PostgreSQL' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-1.5 border-b border-dashed last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={updateSettings.isPending} className="min-w-28">
            <Save className="w-4 h-4 mr-2" />
            {updateSettings.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </form>

      {/* ── Master Panel Toggle — Super Admin Only ─────────────────────────── */}
      {isSuperAdmin && panelEnabled !== null && (
        <Card className={`border-2 mt-6 ${panelEnabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/10'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className={`w-5 h-5 ${panelEnabled ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className={panelEnabled ? 'text-emerald-300' : 'text-rose-300'}>
                Master Panel Access Control
              </span>
              <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                Super Admin Only
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400">
              Turn OFF to completely block all staff and admin access to this panel.
              Only you (super_admin) can turn it back ON.
            </p>
            <div className="flex items-center justify-between rounded-xl p-4 border border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Power className={`w-5 h-5 ${panelEnabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                <div>
                  <div className={`font-semibold text-sm ${panelEnabled ? 'text-emerald-300' : 'text-slate-400'}`}>
                    Admin Panel is <strong>{panelEnabled ? 'ENABLED ✅' : 'DISABLED 🔴'}</strong>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {panelEnabled
                      ? 'All authorized users can access the panel normally.'
                      : 'Panel is locked — only super_admin can re-enable it.'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={panelToggling || !panelEnabled}
                  onClick={() => handlePanelToggle(false)}
                  className="border-rose-500/50 text-rose-400 hover:bg-rose-500/10 disabled:opacity-30">
                  {panelToggling && !panelEnabled ? '…' : '🔴 Disable'}
                </Button>
                <Button size="sm" variant="outline" disabled={panelToggling || !!panelEnabled}
                  onClick={() => handlePanelToggle(true)}
                  className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30">
                  {panelToggling && panelEnabled ? '…' : '✅ Enable'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
