import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, Plus, Trash2, Save, GripVertical, FlaskConical,
  Globe, Smartphone, Users, Eye, EyeOff, Check, Pencil,
  Layers, ToggleLeft, Rocket, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScreenRow {
  id: number;
  screenKey: string;
  label: string;
  userType: string;
  isEnabled: boolean;
  sortOrder: number;
}

interface ModuleRow {
  id: number;
  moduleKey: string;
  label: string;
  description: string | null;
  status: string;
}

interface FormOption {
  id?: number;
  label: string;
  value: string;
  icon: string;
  optionType: string;
  sortOrder: number;
  isActive: boolean;
  _isNew?: boolean;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? 'Request failed'); }
  return r.json();
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Form Options
// ══════════════════════════════════════════════════════════════════════════════
function FormOptionsTab() {
  const qc = useQueryClient();
  const [localOptions, setLocalOptions] = useState<FormOption[] | null>(null);
  const [dirty, setDirty] = useState(false);

  const { data: serverOptions, isLoading } = useQuery<FormOption[]>({
    queryKey: ['admin-form-options'],
    queryFn: () => apiFetch('/api/admin/form-options'),
    onSuccess: (data) => {
      if (!dirty) setLocalOptions(data);
    },
  } as any);

  const options = localOptions ?? serverOptions ?? [];

  const saveAll = useMutation({
    mutationFn: (opts: FormOption[]) =>
      apiFetch('/api/admin/form-options/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: opts, optionType: 'service_type' }),
      }),
    onSuccess: (updated: FormOption[]) => {
      setLocalOptions(updated);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['admin-form-options'] });
      toast.success('Form options saved ✅');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addOption() {
    const next: FormOption = { label: '', value: '', icon: '🛠️', optionType: 'service_type', sortOrder: options.length, isActive: true, _isNew: true };
    setLocalOptions([...options, next]);
    setDirty(true);
  }

  function updateOption(idx: number, field: keyof FormOption, val: unknown) {
    const updated = options.map((o, i) => {
      if (i !== idx) return o;
      const next = { ...o, [field]: val };
      // auto-sync value from label if it's a new option
      if (field === 'label' && o._isNew) next.value = String(val);
      return next;
    });
    setLocalOptions(updated);
    setDirty(true);
  }

  function removeOption(idx: number) {
    setLocalOptions(options.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function handleSave() {
    const clean = options.filter(o => o.label.trim());
    saveAll.mutate(clean);
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl bg-slate-800" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
        <ToggleLeft className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          These options appear as chips on the customer booking form. Changes take effect immediately after <strong>Save All</strong>.
        </span>
      </div>

      {/* Option rows */}
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <Card key={idx} className="bg-slate-900 border-slate-800">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />

                {/* Icon emoji */}
                <Input
                  value={opt.icon}
                  onChange={e => updateOption(idx, 'icon', e.target.value)}
                  className="w-16 text-center bg-slate-800 border-slate-700 text-white text-lg"
                  placeholder="🛠️"
                />

                {/* Label */}
                <Input
                  value={opt.label}
                  onChange={e => updateOption(idx, 'label', e.target.value)}
                  placeholder="Option label (e.g. Repair)"
                  className="flex-1 bg-slate-800 border-slate-700 text-white"
                />

                {/* Active toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-medium ${opt.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {opt.isActive ? 'ON' : 'OFF'}
                  </span>
                  <Switch
                    checked={opt.isActive}
                    onCheckedChange={v => updateOption(idx, 'isActive', v)}
                  />
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeOption(idx)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add + Save row */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={addOption}
          className="border-dashed border-slate-600 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/5"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Option
        </Button>

        <Button
          onClick={handleSave}
          disabled={!dirty || saveAll.isPending}
          className="ml-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold min-w-32"
        >
          {saveAll.isPending
            ? <><span className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" />Saving…</>
            : <><Save className="w-4 h-4 mr-2" />Save All</>
          }
        </Button>
      </div>

      {dirty && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Unsaved changes — tap Save All to publish to the booking form.
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Screen Visibility
// ══════════════════════════════════════════════════════════════════════════════
function ScreenVisibilityTab() {
  const qc = useQueryClient();

  const { data: screens, isLoading } = useQuery<ScreenRow[]>({
    queryKey: ['admin-screen-visibility'],
    queryFn: () => apiFetch('/api/admin/screen-visibility'),
  });

  const toggleScreen = useMutation({
    mutationFn: ({ key, isEnabled }: { key: string; isEnabled: boolean }) =>
      apiFetch(`/api/admin/screen-visibility/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-screen-visibility'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleToggle(screen: ScreenRow) {
    toggleScreen.mutate(
      { key: screen.screenKey, isEnabled: !screen.isEnabled },
      {
        onSuccess: () => toast.success(
          screen.isEnabled
            ? `🔴 "${screen.label}" hidden from app`
            : `✅ "${screen.label}" visible in app`
        ),
      }
    );
  }

  const customerScreens  = screens?.filter(s => s.userType === 'customer') ?? [];
  const techScreens      = screens?.filter(s => s.userType === 'technician') ?? [];
  const bothScreens      = screens?.filter(s => s.userType === 'both') ?? [];

  const userTypeIcon = (type: string) => {
    if (type === 'customer')   return <Users    className="w-3.5 h-3.5" />;
    if (type === 'technician') return <Smartphone className="w-3.5 h-3.5" />;
    return <Globe className="w-3.5 h-3.5" />;
  };

  const userTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      customer:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
      technician: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
      both:       'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
    return colors[type] ?? colors.both;
  };

  if (isLoading) return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 rounded-xl bg-slate-800" />)}</div>;

  function ScreenGroup({ title, items, icon }: { title: string; items: ScreenRow[]; icon: React.ReactNode }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
          {icon} {title}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(screen => (
            <Card
              key={screen.screenKey}
              className={`border transition-all ${
                screen.isEnabled
                  ? 'bg-slate-900 border-slate-700'
                  : 'bg-slate-900/40 border-slate-800/50 opacity-60'
              }`}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  screen.isEnabled ? 'bg-emerald-500/15' : 'bg-slate-800'
                }`}>
                  {screen.isEnabled
                    ? <Eye className="w-4 h-4 text-emerald-400" />
                    : <EyeOff className="w-4 h-4 text-slate-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{screen.label}</p>
                  <Badge className={`text-[10px] border mt-1 ${userTypeBadge(screen.userType)}`}>
                    {userTypeIcon(screen.userType)}
                    <span className="ml-1 capitalize">{screen.userType}</span>
                  </Badge>
                </div>
                <Switch
                  checked={screen.isEnabled}
                  onCheckedChange={() => handleToggle(screen)}
                  disabled={toggleScreen.isPending}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-300">
        <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Toggle screens ON/OFF. When a screen is <strong>OFF</strong>, it shows a "Not available" placeholder in the app instead of its content. Changes apply immediately.
        </span>
      </div>

      <ScreenGroup title="Customer Screens" items={customerScreens}  icon={<Users className="w-3.5 h-3.5" />} />
      <ScreenGroup title="Technician Screens" items={techScreens}   icon={<Smartphone className="w-3.5 h-3.5" />} />
      <ScreenGroup title="Shared Screens"    items={bothScreens}     icon={<Globe className="w-3.5 h-3.5" />} />

      {screens?.length === 0 && (
        <div className="text-center py-12 text-slate-500">No screens found. Try refreshing.</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Module Staging
// ══════════════════════════════════════════════════════════════════════════════
function ModuleStagingTab() {
  const qc = useQueryClient();

  const { data: modules, isLoading } = useQuery<ModuleRow[]>({
    queryKey: ['admin-feature-modules'],
    queryFn: () => apiFetch('/api/admin/feature-modules'),
  });

  const updateModule = useMutation({
    mutationFn: ({ key, status }: { key: string; status: string }) =>
      apiFetch(`/api/admin/feature-modules/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feature-modules'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function handleToggle(mod: ModuleRow) {
    const newStatus = mod.status === 'published' ? 'draft' : 'published';
    updateModule.mutate(
      { key: mod.moduleKey, status: newStatus },
      {
        onSuccess: () => toast.success(
          newStatus === 'published'
            ? `🚀 "${mod.label}" is now LIVE`
            : `🔬 "${mod.label}" moved to Sandbox`
        ),
      }
    );
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl bg-slate-800" />)}</div>;

  const published = modules?.filter(m => m.status === 'published') ?? [];
  const drafts    = modules?.filter(m => m.status === 'draft')     ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 px-4 py-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-sm text-violet-300">
        <FlaskConical className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>Draft</strong> modules are only visible in the Admin Sandbox — users never see them.
          Flip to <strong>Published</strong> to make a feature live for everyone.
        </span>
      </div>

      {/* Published */}
      {published.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Rocket className="w-3.5 h-3.5 text-emerald-400" /> Live Features
          </p>
          {published.map(mod => (
            <ModuleCard key={mod.moduleKey} mod={mod} onToggle={handleToggle} isPending={updateModule.isPending} />
          ))}
        </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-violet-400" /> Sandbox / Draft
          </p>
          {drafts.map(mod => (
            <ModuleCard key={mod.moduleKey} mod={mod} onToggle={handleToggle} isPending={updateModule.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleCard({ mod, onToggle, isPending }: { mod: ModuleRow; onToggle: (m: ModuleRow) => void; isPending: boolean }) {
  const isPublished = mod.status === 'published';
  return (
    <Card className={`border transition-all ${isPublished ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/50 border-slate-800/60'}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isPublished ? 'bg-emerald-500/15' : 'bg-violet-500/10'
        }`}>
          {isPublished
            ? <Check className="w-5 h-5 text-emerald-400" />
            : <FlaskConical className="w-5 h-5 text-violet-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{mod.label}</span>
            <Badge className={`text-[10px] border font-semibold ${
              isPublished
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
            }`}>
              {isPublished ? '✅ Published' : '🔬 Draft'}
            </Badge>
          </div>
          {mod.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{mod.description}</p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => onToggle(mod)}
          className={`shrink-0 text-xs font-semibold ${
            isPublished
              ? 'border-slate-600 text-slate-400 hover:text-rose-300 hover:border-rose-500/50 hover:bg-rose-500/5'
              : 'border-violet-500/50 text-violet-300 hover:bg-violet-500/10'
          }`}
        >
          {isPublished ? '↩ Revert to Draft' : '🚀 Publish'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function SuperAdminPage() {
  const { isSuperAdmin, isAdmin } = useRole();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Shield className="w-14 h-14 text-slate-700" />
        <h2 className="text-xl font-bold text-slate-300">Access Denied</h2>
        <p className="text-slate-500">Only admins can view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">Super Admin</h1>
            {isSuperAdmin && (
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                SUPER ADMIN
              </Badge>
            )}
          </div>
          <p className="text-slate-400 mt-1">
            Control form options, screen visibility, and feature staging across the entire app.
          </p>
        </div>
        <div className="shrink-0 w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
          <Shield className="w-6 h-6 text-amber-400" />
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You can view this page as admin, but only a <strong>super_admin</strong> can make changes.
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="form-options" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700 p-1">
          <TabsTrigger value="form-options" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-semibold text-slate-400">
            <Layers className="w-4 h-4 mr-2" />
            Form Options
          </TabsTrigger>
          <TabsTrigger value="screen-visibility" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-semibold text-slate-400">
            <Eye className="w-4 h-4 mr-2" />
            Screen Visibility
          </TabsTrigger>
          <TabsTrigger value="module-staging" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-semibold text-slate-400">
            <FlaskConical className="w-4 h-4 mr-2" />
            Module Staging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form-options">
          <FormOptionsTab />
        </TabsContent>

        <TabsContent value="screen-visibility">
          <ScreenVisibilityTab />
        </TabsContent>

        <TabsContent value="module-staging">
          <ModuleStagingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
