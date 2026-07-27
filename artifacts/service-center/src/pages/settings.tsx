import React, { useEffect } from 'react';
import { useGetSettings, useUpdateSettings, AppSettingsUpdate } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Palette,
  Image as ImageIcon,
  Type,
  Bell,
  Save,
  Sun,
  Moon,
  Monitor,
  Info,
  CheckCircle2,
  Languages,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSettingsQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';

const THEME_OPTIONS = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
    preview: 'bg-white border-slate-200',
    barColor: 'bg-slate-200',
    dotColor: 'bg-blue-500',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    preview: 'bg-slate-950 border-slate-700',
    barColor: 'bg-slate-700',
    dotColor: 'bg-blue-400',
  },
  {
    value: 'system',
    label: 'System',
    icon: Monitor,
    preview: 'bg-gradient-to-br from-white to-slate-900 border-slate-400',
    barColor: 'bg-slate-400',
    dotColor: 'bg-amber-400',
  },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();

  const { register, handleSubmit, setValue, watch, reset } = useForm<AppSettingsUpdate>({
    defaultValues: { theme: 'light', language: 'both', globalWallpaper: '', captionSize: 1, notificationsEnabled: true },
  });

  useEffect(() => {
    if (settings) {
      reset({
        theme: settings.theme ?? 'light',
        language: (settings.language as 'hi' | 'en' | 'both') ?? 'both',
        globalWallpaper: settings.globalWallpaper ?? '',
        captionSize: settings.captionSize ?? 1,
        notificationsEnabled: settings.notificationsEnabled ?? true,
      });
    }
  }, [settings, reset]);

  const captionSize = watch('captionSize') ?? 1;
  const theme = watch('theme');
  const language = watch('language') ?? 'both';

  const onSubmit = (data: AppSettingsUpdate) => {
    updateSettings.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast.success('Settings saved successfully');
        },
        onError: () => toast.error('Failed to save settings'),
      }
    );
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customize the app appearance and behavior
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="appearance" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-sm">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          {/* ── Appearance Tab ── */}
          <TabsContent value="appearance" className="space-y-5">

            {/* Theme */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="w-4 h-4 text-primary" />
                  Theme
                </CardTitle>
                <CardDescription>Choose the app color scheme</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setValue('theme', opt.value)}
                        className={cn(
                          'relative rounded-xl border-2 p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          selected
                            ? 'border-primary ring-1 ring-primary/30'
                            : 'border-border hover:border-muted-foreground/40'
                        )}
                      >
                        {/* Mini preview */}
                        <div
                          className={cn(
                            'h-14 rounded-lg border overflow-hidden mb-2',
                            opt.preview
                          )}
                        >
                          <div className={cn('h-3 w-full', opt.barColor)} />
                          <div className="flex gap-1 p-1.5">
                            <div className={cn('h-2 w-2 rounded-full', opt.dotColor)} />
                            <div className={cn('h-2 flex-1 rounded', opt.barColor, 'opacity-60')} />
                          </div>
                          <div className="flex gap-1 px-1.5">
                            <div className={cn('h-2 flex-1 rounded', opt.barColor, 'opacity-40')} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium flex items-center gap-1">
                            <Icon className="w-3 h-3" />
                            {opt.label}
                          </span>
                          {selected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                          )}
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
                  <Languages className="w-4 h-4 text-primary" />
                  Language
                </CardTitle>
                <CardDescription>Choose the display language for labels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'en', label: 'English', sub: 'English only' },
                    { value: 'hi', label: 'हिन्दी', sub: 'Hindi only' },
                    { value: 'both', label: 'Both', sub: 'Hindi + English' },
                  ].map((opt) => {
                    const selected = language === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setValue('language', opt.value as 'hi' | 'en' | 'both')}
                        className={cn(
                          'rounded-xl border-2 px-3 py-3 text-left transition-all focus:outline-none',
                          selected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border hover:border-muted-foreground/40'
                        )}
                      >
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{opt.sub}</div>
                        {selected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Wallpaper */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Background Wallpaper
                </CardTitle>
                <CardDescription>
                  Paste an image URL to set a background. Leave blank for default.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="https://example.com/background.jpg"
                  {...register('globalWallpaper')}
                />
                {watch('globalWallpaper') && (
                  <div
                    className="h-24 rounded-lg border bg-cover bg-center bg-no-repeat relative overflow-hidden"
                    style={{ backgroundImage: `url(${watch('globalWallpaper')})` }}
                  >
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                        Preview
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Caption / Highlight Text Size */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Type className="w-4 h-4 text-primary" />
                  Caption Text Size
                </CardTitle>
                <CardDescription>
                  Controls the size of highlight captions only — not the whole app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-semibold tabular-nums">
                    {captionSize === 1 ? 'Normal (1×)' : `${captionSize.toFixed(2)}×`}
                  </span>
                </div>
                <Slider
                  min={0.85}
                  max={1.3}
                  step={0.05}
                  value={[captionSize]}
                  onValueChange={(val) => setValue('captionSize', val[0])}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Smaller</span>
                  <span>Normal</span>
                  <span>Larger</span>
                </div>
                {/* Live caption preview */}
                <div className="mt-1 p-3 rounded-lg bg-muted/50 border border-dashed flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-200 font-medium"
                    style={{ fontSize: `${captionSize}em` }}
                  >
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] flex items-center justify-center font-bold">
                      1
                    </span>
                    AC Gas Filled
                  </span>
                  <span className="text-xs text-muted-foreground">← caption preview</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Notifications Tab ── */}
          <TabsContent value="notifications" className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="w-4 h-4 text-primary" />
                  Reminders & Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-sm">Enable Reminder Notifications</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Show alerts for due and overdue reminders
                    </div>
                  </div>
                  <Switch
                    checked={watch('notificationsEnabled') ?? true}
                    onCheckedChange={(val) => setValue('notificationsEnabled', val)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2 opacity-50 pointer-events-none">
                  <div>
                    <div className="font-medium text-sm">Overdue Payment Alerts</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Badge on jobs with pending payments (coming soon)
                    </div>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── About Tab ── */}
          <TabsContent value="about" className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="w-4 h-4 text-primary" />
                  App Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { label: 'App Name', value: 'Service Center Manager' },
                  { label: 'Version', value: '1.0.0' },
                  { label: 'Language', value: 'Hindi + English (Bilingual)' },
                  { label: 'Database', value: 'PostgreSQL (Neon)' },
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

        {/* Save button — visible on Appearance + Notifications tabs */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={updateSettings.isPending} className="min-w-28">
            <Save className="w-4 h-4 mr-2" />
            {updateSettings.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
