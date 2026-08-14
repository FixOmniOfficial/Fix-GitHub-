import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Pencil, Shield, ChevronUp, ChevronDown, ToggleLeft, Layers, Image as ImageIcon, Type } from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

// ── Common Feather icon names available in the mobile app ─────────────────────
const FEATHER_ICONS = [
  'settings','tool','zap','droplet','wind','scissors','truck','home','box','grid',
  'sun','star','shield','phone','wifi','cpu','thermometer','wrench','layers',
  'package','monitor','camera','radio','cast','compass','anchor','command',
  'activity','award','briefcase','codesandbox','coffee','database','feather',
  'filter','flag','gift','globe','headphones','heart','inbox','key','map',
  'music','navigation','paperclip','printer','refresh-cw','send','shopping-cart',
  'sliders','speaker','tablet','tag','thumbs-up','toggle-left','trending-up',
  'unlock','upload','user','users','video','volume-2','watch','x-circle',
];

interface ServiceCategory {
  id: number;
  name: string;
  icon: string;
  imageUrl?: string | null;
  accent: string;
  professionType: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type MediaMode = 'icon' | 'image';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const r = await fetch(`${BASE}/api/admin/service-categories`, { credentials: 'include' });
  if (!r.ok) throw new Error('Failed to fetch categories');
  return r.json();
}

async function createCategory(data: Partial<ServiceCategory>) {
  const r = await fetch(`${BASE}/api/admin/service-categories`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

async function updateCategory(id: number, data: Partial<ServiceCategory>) {
  const r = await fetch(`${BASE}/api/admin/service-categories/${id}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

async function deleteCategory(id: number) {
  const r = await fetch(`${BASE}/api/admin/service-categories/${id}`, {
    method: 'DELETE', credentials: 'include',
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

const EMPTY_FORM = { name: '', icon: 'settings', imageUrl: '', accent: '#6b7280', professionType: 'ac_technician', sortOrder: 0 };

// ── Media Mode Toggle ─────────────────────────────────────────────────────────
function MediaModeToggle({ mode, onChange }: { mode: MediaMode; onChange: (m: MediaMode) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs font-semibold">
      <button
        type="button"
        onClick={() => onChange('icon')}
        className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
          mode === 'icon' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        <Type className="w-3 h-3" />
        Vector Icon
      </button>
      <button
        type="button"
        onClick={() => onChange('image')}
        className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
          mode === 'image' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        <ImageIcon className="w-3 h-3" />
        Image URL
      </button>
    </div>
  );
}

// ── Icon Picker Grid ──────────────────────────────────────────────────────────
function IconPicker({ selected, onSelect, accent }: { selected: string; onSelect: (name: string) => void; accent: string }) {
  const [filter, setFilter] = useState('');
  const filtered = FEATHER_ICONS.filter(i => i.includes(filter.toLowerCase()));
  return (
    <div className="space-y-2">
      <Input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter icons…"
        className="bg-slate-800 border-slate-700 text-white text-xs h-8"
      />
      <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto p-1 bg-slate-800 rounded-lg border border-slate-700">
        {filtered.map(name => (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => onSelect(name)}
            className={`w-8 h-8 flex items-center justify-center rounded text-xs transition-all ${
              selected === name
                ? 'ring-2 ring-amber-400 bg-amber-500/20'
                : 'hover:bg-slate-700 text-slate-400 hover:text-white'
            }`}
            style={{ color: selected === name ? accent : undefined }}
          >
            {/* Render icon name initial as a stand-in — real icon renders in app */}
            <span className="text-[9px] font-mono leading-none text-center break-all" style={{ fontSize: 8 }}>
              {name.slice(0, 4)}
            </span>
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-500">
        Selected: <span className="text-amber-400 font-mono">{selected}</span>
        <span className="ml-2 text-slate-600">(renders as Feather icon in the app)</span>
      </div>
    </div>
  );
}

// ── Card Media Preview ────────────────────────────────────────────────────────
function CategoryMedia({ cat }: { cat: ServiceCategory }) {
  if (cat.imageUrl) {
    return (
      <div
        className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border"
        style={{ borderColor: `${cat.accent}40` }}
      >
        <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border font-mono text-[10px] text-center"
      style={{ background: `${cat.accent}20`, borderColor: `${cat.accent}40`, color: cat.accent }}
    >
      {cat.icon}
    </div>
  );
}

export default function ServiceCategoriesPage() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategory | null>(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [addMode, setAddMode] = useState<MediaMode>('icon');
  const [editForm, setEditForm] = useState({ name: '', icon: '', imageUrl: '', accent: '', professionType: '' });
  const [editMode, setEditMode] = useState<MediaMode>('icon');

  const { data: cats, isLoading, error } = useQuery({
    queryKey: ['admin-service-categories'],
    queryFn: fetchCategories,
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
      toast.success('Category created ✅');
      setShowAdd(false);
      setAddForm({ ...EMPTY_FORM });
      setAddMode('icon');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServiceCategory> }) => updateCategory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
      toast.success('Category deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleToggleActive(cat: ServiceCategory) {
    updateMut.mutate(
      { id: cat.id, data: { isActive: !cat.isActive } },
      {
        onSuccess: () => toast.success(cat.isActive ? '❌ Category disabled' : '✅ Category enabled'),
      }
    );
  }

  function handleReorder(cat: ServiceCategory, direction: 'up' | 'down') {
    if (!cats) return;
    const idx = cats.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cats.length) return;
    const swap = cats[swapIdx];
    Promise.all([
      updateCategory(cat.id,  { sortOrder: swap.sortOrder }),
      updateCategory(swap.id, { sortOrder: cat.sortOrder }),
    ]).then(() => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
    }).catch((e) => toast.error(e.message));
  }

  function openEdit(cat: ServiceCategory) {
    setEditTarget(cat);
    setEditForm({ name: cat.name, icon: cat.icon, imageUrl: cat.imageUrl ?? '', accent: cat.accent, professionType: cat.professionType });
    setEditMode(cat.imageUrl ? 'image' : 'icon');
  }

  function saveEdit() {
    if (!editTarget) return;
    const payload: Partial<ServiceCategory> = {
      name: editForm.name,
      icon: editForm.icon,
      imageUrl: editMode === 'image' ? (editForm.imageUrl || null) : null,
      accent: editForm.accent,
      professionType: editForm.professionType,
    };
    updateMut.mutate(
      { id: editTarget.id, data: payload },
      {
        onSuccess: () => {
          toast.success('Category updated ✅');
          setEditTarget(null);
        },
      }
    );
  }

  function handleCreate() {
    const payload = {
      ...addForm,
      imageUrl: addMode === 'image' ? (addForm.imageUrl || null) : null,
    };
    createMut.mutate(payload);
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Shield className="w-14 h-14 text-slate-700" />
        <h2 className="text-xl font-bold text-slate-300">Admin Only</h2>
        <p className="text-slate-500">Only the Admin can view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Service Categories{' '}
            <span className="text-xl font-normal text-slate-500 ml-2">Service Categories</span>
          </h1>
          <p className="text-slate-400 mt-1">
            Manage categories — ON/OFF toggle, name, icon or image, and order
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Category
        </Button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
        <ToggleLeft className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>Master Toggle:</strong> When a category is OFF, it is hidden from the customer booking form.
          Each category can display a <strong>Vector Icon</strong> (Feather icon set) or an <strong>Image URL</strong>.
        </span>
      </div>

      {/* Category List */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl bg-slate-800" />)
        ) : error ? (
          <div className="text-center py-12 text-rose-400">Categories could not be loaded.</div>
        ) : cats?.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 border-dashed">
            <CardContent className="py-16 text-center">
              <Layers className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No categories yet</p>
              <p className="text-slate-600 text-sm mt-1">Tap "New Category" above to add one</p>
            </CardContent>
          </Card>
        ) : (
          cats?.map((cat, idx) => (
            <Card
              key={cat.id}
              className={`border transition-all ${
                cat.isActive
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-slate-900/50 border-slate-800/50 opacity-60'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Order buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleReorder(cat, 'up')}
                      disabled={idx === 0 || updateMut.isPending}
                      className="p-0.5 rounded text-slate-600 hover:text-slate-300 disabled:opacity-30"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleReorder(cat, 'down')}
                      disabled={idx === (cats?.length ?? 0) - 1 || updateMut.isPending}
                      className="p-0.5 rounded text-slate-600 hover:text-slate-300 disabled:opacity-30"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Media preview: image or icon name */}
                  <CategoryMedia cat={cat} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{cat.name}</span>
                      <Badge
                        className="text-[10px] border"
                        style={{
                          background: `${cat.accent}15`,
                          borderColor: `${cat.accent}40`,
                          color: cat.accent,
                        }}
                      >
                        {cat.professionType}
                      </Badge>
                      {cat.imageUrl ? (
                        <Badge className="text-[10px] border border-blue-500/40 bg-blue-500/10 text-blue-400">
                          <ImageIcon className="w-2.5 h-2.5 mr-1" /> Image
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] border border-slate-600 bg-slate-800 text-slate-400">
                          <Type className="w-2.5 h-2.5 mr-1" /> {cat.icon}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Order: {cat.sortOrder}</div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-medium ${cat.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {cat.isActive ? 'ON' : 'OFF'}
                      </span>
                      <Switch
                        checked={cat.isActive}
                        onCheckedChange={() => handleToggleActive(cat)}
                        disabled={updateMut.isPending}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(cat)}
                      className="text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(cat)}
                      className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ── Add Category Modal ─────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">New Service Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Category Name *</Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. AC Service, Painting"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* ── Dual Media Selector ── */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Service Icon / Image</Label>
              <MediaModeToggle mode={addMode} onChange={m => setAddMode(m)} />
              {addMode === 'icon' ? (
                <IconPicker
                  selected={addForm.icon}
                  onSelect={name => setAddForm(f => ({ ...f, icon: name }))}
                  accent={addForm.accent}
                />
              ) : (
                <div className="space-y-2">
                  <Input
                    value={addForm.imageUrl}
                    onChange={e => setAddForm(f => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://example.com/icon.png"
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                  />
                  {addForm.imageUrl && (
                    <div className="flex items-center gap-3 p-2 bg-slate-800 rounded-lg">
                      <img src={addForm.imageUrl} alt="preview" className="w-10 h-10 rounded-xl object-cover border border-slate-700" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                      <span className="text-xs text-slate-400">Preview</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={addForm.accent}
                    onChange={(e) => setAddForm(f => ({ ...f, accent: e.target.value }))}
                    className="w-12 h-9 p-1 bg-slate-800 border-slate-700 cursor-pointer"
                  />
                  <Input
                    value={addForm.accent}
                    onChange={(e) => setAddForm(f => ({ ...f, accent: e.target.value }))}
                    placeholder="#6b7280"
                    className="bg-slate-800 border-slate-700 text-white text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={addForm.sortOrder}
                  onChange={(e) => setAddForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Profession Type *</Label>
              <Input
                value={addForm.professionType}
                onChange={(e) => setAddForm(f => ({ ...f, professionType: e.target.value }))}
                placeholder="ac_technician / carpenter / painter…"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Preview */}
            {addForm.name && (
              <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center border overflow-hidden"
                  style={{ background: `${addForm.accent}20`, borderColor: `${addForm.accent}40` }}
                >
                  {addMode === 'image' && addForm.imageUrl
                    ? <img src={addForm.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                    : <span className="font-mono text-[9px] text-center leading-none" style={{ color: addForm.accent }}>{addForm.icon}</span>
                  }
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{addForm.name}</div>
                  <div className="text-xs" style={{ color: addForm.accent }}>{addForm.professionType}</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="text-slate-400">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createMut.isPending || !addForm.name || !addForm.professionType}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            >
              {createMut.isPending ? 'Creating…' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Category Modal ────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* ── Dual Media Selector ── */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Service Icon / Image</Label>
              <MediaModeToggle mode={editMode} onChange={m => setEditMode(m)} />
              {editMode === 'icon' ? (
                <IconPicker
                  selected={editForm.icon}
                  onSelect={name => setEditForm(f => ({ ...f, icon: name }))}
                  accent={editForm.accent}
                />
              ) : (
                <div className="space-y-2">
                  <Input
                    value={editForm.imageUrl}
                    onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://example.com/icon.png"
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                  />
                  {editForm.imageUrl && (
                    <div className="flex items-center gap-3 p-2 bg-slate-800 rounded-lg">
                      <img src={editForm.imageUrl} alt="preview" className="w-10 h-10 rounded-xl object-cover border border-slate-700" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                      <span className="text-xs text-slate-400">Preview</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editForm.accent}
                    onChange={(e) => setEditForm(f => ({ ...f, accent: e.target.value }))}
                    className="w-12 h-9 p-1 bg-slate-800 border-slate-700 cursor-pointer"
                  />
                  <Input
                    value={editForm.accent}
                    onChange={(e) => setEditForm(f => ({ ...f, accent: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Profession Type</Label>
                <Input
                  value={editForm.professionType}
                  onChange={(e) => setEditForm(f => ({ ...f, professionType: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)} className="text-slate-400">Cancel</Button>
            <Button
              onClick={saveEdit}
              disabled={updateMut.isPending}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            >
              {updateMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Category?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <strong className="text-slate-200">{deleteTarget?.name}</strong> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {deleteMut.isPending ? 'Deleting…' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
