import React, { useEffect } from 'react';
import { useGetSettings, useUpdateSettings, AppSettingsUpdate } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Image as ImageIcon, Type, Bell, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSettingsQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();

  const { register, handleSubmit, setValue, watch, reset } = useForm<AppSettingsUpdate>();

  useEffect(() => {
    if (settings) {
      reset({
        theme: settings.theme,
        globalWallpaper: settings.globalWallpaper || '',
        captionSize: settings.captionSize || 1,
        notificationsEnabled: settings.notificationsEnabled ?? true,
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: AppSettingsUpdate) => {
    updateSettings.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast.success('सेटिंग्स सुरक्षित की गईं (Settings saved successfully)');
      },
      onError: () => toast.error('सुरक्षित करने में विफल (Failed to save)')
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">सेटिंग्स <span className="text-xl font-normal text-muted-foreground ml-2">Settings</span></h1>
        <p className="text-muted-foreground mt-1">ऐप के रूप और व्यवहार को अनुकूलित करें (Customize app appearance and behavior)</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" /> थीम (Theme)
            </CardTitle>
            <CardDescription>ऐप की रंग योजना चुनें (Choose the app color scheme)</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup 
              value={watch('theme')} 
              onValueChange={(val) => setValue('theme', val)}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <div>
                <RadioGroupItem value="light" id="light" className="peer sr-only" />
                <Label htmlFor="light" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                  <div className="w-full h-20 rounded bg-white border mb-2 flex items-center justify-center text-xs text-muted-foreground">Light</div>
                  <span>लाइट (Light)</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                <Label htmlFor="dark" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                  <div className="w-full h-20 rounded bg-slate-950 border border-slate-800 mb-2 flex items-center justify-center text-xs text-slate-500">Dark</div>
                  <span>डार्क (Dark)</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="system" id="system" className="peer sr-only" />
                <Label htmlFor="system" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                  <div className="w-full h-20 rounded bg-gradient-to-r from-white to-slate-950 border mb-2 flex items-center justify-center text-xs text-muted-foreground">System</div>
                  <span>सिस्टम (System)</span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" /> वॉलपेपर (Wallpaper)
            </CardTitle>
            <CardDescription>ऐप की पृष्ठभूमि छवि सेट करें (Set the app background image URL)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="globalWallpaper">छवि URL (Image URL)</Label>
              <Input 
                id="globalWallpaper" 
                placeholder="https://example.com/image.jpg" 
                {...register('globalWallpaper')} 
              />
              <p className="text-xs text-muted-foreground">खाली छोड़ने पर डिफ़ॉल्ट रंग का उपयोग होगा (Leave blank for default color)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="w-5 h-5 text-primary" /> फ़ॉन्ट आकार (Font Size)
            </CardTitle>
            <CardDescription>ऐप का डिफ़ॉल्ट फ़ॉन्ट आकार समायोजित करें (Adjust default font size)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>ज़ूम स्तर (Zoom Level): {watch('captionSize')}x</Label>
              </div>
              <Slider 
                min={0.8} 
                max={1.5} 
                step={0.05} 
                value={[watch('captionSize') || 1]} 
                onValueChange={(val) => setValue('captionSize', val[0])}
              />
              <div className="p-4 bg-muted/50 rounded-lg text-center" style={{ fontSize: `${watch('captionSize')}em` }}>
                यह परीक्षण पाठ है (This is preview text)
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> सूचनाएं (Notifications)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">रिमाइंडर सूचनाएं सक्षम करें (Enable Reminders)</Label>
                <p className="text-sm text-muted-foreground">अतिदेय कार्यों के लिए अलर्ट प्राप्त करें</p>
              </div>
              <Switch 
                checked={watch('notificationsEnabled')} 
                onCheckedChange={(val) => setValue('notificationsEnabled', val)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={updateSettings.isPending}>
            <Save className="w-5 h-5 mr-2" />
            {updateSettings.isPending ? 'सुरक्षित कर रहा है...' : 'सेटिंग्स सुरक्षित करें (Save Settings)'}
          </Button>
        </div>
      </form>
    </div>
  );
}
