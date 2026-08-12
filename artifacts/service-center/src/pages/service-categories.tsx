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
import { Plus, Trash2, Pencil, Shield, ChevronUp, ChevronDown, ToggleLeft, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

interface ServiceCategory {
  id: number;
  name: string;
  icon: string;
  accent: string;
  professionType: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

const EMPTY_FORM = { name: '', icon: '🔧', accent: '#6b7280', professionType: 'ac_technician', sortOrder: 0 };

export default function ServiceCategoriesPage() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategory | null>(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ name: '', icon: '', accent: '', professionType: '' });

  const { data: cats, isLoading, error } = useQuery({
    queryKey: ['admin-service-categories'],
    queryFn: fetchCategories,
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
      toast.success('Category बन गई ✅');
      setShowAdd(false);
      setAddForm({ ...EMPTY_FORM });
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
      toast.success('Category हटा दी गई');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleToggleActive(cat: ServiceCategory) {
    updateMut.mutate(
      { id: cat.id, data: { isActive: !cat.isActive } },
      {
        onSuccess: () => toast.success(cat.isActive ? '❌ Category बंद कर दी' : '✅ Category चालू कर दी'),
      }
    );
  }

  function handleReorder(cat: ServiceCategory, direction: 'up' | 'down') {
    if (!cats) return;
    const idx = cats.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cats.length) return;
    const swap = cats[swapIdx];
    // Swap sort orders
    Promise.all([
      updateCategory(cat.id,  { sortOrder: swap.sortOrder }),
      updateCategory(swap.id, { sortOrder: cat.sortOrder }),
    ]).then(() => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
    }).catch((e) => toast.error(e.message));
  }

  function openEdit(cat: ServiceCategory) {
    setEditTarget(cat);
    setEditForm({ name: cat.name, icon: cat.icon, accent: cat.accent, professionType: cat.professionType });
  }

  function saveEdit() {
    if (!editTarget) return;
    updateMut.mutate(
      { id: editTarget.id, data: editForm },
      {
        onSuccess: () => {
          toast.success('Category update हो गई ✅');
          setEditTarget(null);
        },
      }
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Shield className="w-14 h-14 text-slate-700" />
        <h2 className="text-xl font-bold text-slate-300">Admin Only</h2>
        <p className="text-slate-500">यह पेज सिर्फ Admin देख सकता है।</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            सर्विस कैटेगरी{' '}
            <span className="text-xl font-normal text-slate-500 ml-2">Service Categories</span>
          </h1>
          <p className="text-slate-400 mt-1">
            Categories manage करें — ON/OFF toggle, नाम, icon, और order बदलें
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          नई Category
        </Button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
        <ToggleLeft className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>Master Toggle:</strong> जब category OFF होती है, वो customer booking form से hide हो जाती है।
        </span>
      </div>

      {/* Category List */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl bg-slate-800" />)
        ) : error ? (
          <div className="text-center py-12 text-rose-400">Categories load नहीं हुईं।</div>
        ) : cats?.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 border-dashed">
            <CardContent className="py-16 text-center">
              <Layers className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">कोई Category नहीं है</p>
              <p className="text-slate-600 text-sm mt-1">ऊपर "नई Category" बटन से जोड़ें</p>
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

                  {/* Icon + accent dot */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border"
                    style={{ background: `${cat.accent}20`, borderColor: `${cat.accent}40` }}
                  >
                    {cat.icon}
                  </div>

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
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Order: {cat.sortOrder}</div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* ON/OFF Toggle */}
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

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(cat)}
                      className="text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete */}
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

      {/* Add Category Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">नई Service Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Category Name *</Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="जैसे: AC Service, Painting"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Icon (Emoji) *</Label>
                <Input
                  value={addForm.icon}
                  onChange={(e) => setAddForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="🔧"
                  className="bg-slate-800 border-slate-700 text-white text-xl"
                />
              </div>
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
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border"
                  style={{ background: `${addForm.accent}20`, borderColor: `${addForm.accent}40` }}
                >
                  {addForm.icon}
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
              onClick={() => createMut.mutate(addForm)}
              disabled={createMut.isPending || !addForm.name || !addForm.professionType}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            >
              {createMut.isPending ? 'बन रही है…' : 'Category जोड़ें'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Category Edit करें</DialogTitle>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Icon (Emoji)</Label>
                <Input
                  value={editForm.icon}
                  onChange={(e) => setEditForm(f => ({ ...f, icon: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white text-xl"
                />
              </div>
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)} className="text-slate-400">Cancel</Button>
            <Button
              onClick={saveEdit}
              disabled={updateMut.isPending}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            >
              {updateMut.isPending ? 'Save हो रही है…' : 'Save करें'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Category हटाएं?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <strong className="text-slate-200">{deleteTarget?.icon} {deleteTarget?.name}</strong> permanently delete होगी।
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
              {deleteMut.isPending ? 'हटा रहे हैं…' : 'हाँ, हटाएं'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
