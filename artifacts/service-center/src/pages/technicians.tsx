/**
 * Admin Technicians Management — View, create, edit, and delete mobile technicians.
 * All phone fields enforce strict 10-digit Indian mobile validation.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import {
  Wrench, Plus, Pencil, Trash2, Phone, Hash, Search,
  AlertTriangle, Bot, CheckCircle2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';
import { format } from 'date-fns';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

interface Technician {
  id: number;
  name: string;
  phone: string | null;
  professionType: string;
  uniqueCode: string;
  avatarEmoji: string | null;
  visitingCharge: string | null;
  isActive: boolean;
  isTestData: boolean;
  createdAt: string;
}

const PROFESSION_OPTIONS = [
  { value: 'ac_technician',  label: '❄️ AC Technician' },
  { value: 'electrician',    label: '⚡ Electrician' },
  { value: 'plumber',        label: '🔧 Plumber' },
  { value: 'carpenter',      label: '🪚 Carpenter' },
  { value: 'painter',        label: '🎨 Painter' },
  { value: 'repair',         label: '⚙️ Repair' },
];

const EMPTY_FORM = {
  name: '', phone: '', professionType: '', avatarEmoji: '', visitingCharge: '', isActive: true,
};

// ── Strict 10-digit Indian phone validation ───────────────────────────────────
function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null; // phone is optional
  const clean = phone.trim().replace(/\D/g, '');
  if (clean.length !== 10) return 'Exactly 10 digits required';
  if (!/^[6-9]/.test(clean)) return 'Must start with 6, 7, 8, or 9';
  return null;
}

export default function TechniciansPage() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTech, setEditTech] = useState<Technician | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [phoneError, setPhoneError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Technician | null>(null);

  const { data: techs = [], isLoading } = useQuery<Technician[]>({
    queryKey: ['admin-technicians'],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/technicians`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch');
      return r.json();
    },
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const r = await fetch(`${BASE}/api/admin/technicians`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          phone: data.phone.trim().replace(/\D/g, '') || undefined,
          visitingCharge: data.visitingCharge || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Create failed');
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`✅ Technician "${d.name}" created — Code: ${d.uniqueCode}`);
      qc.invalidateQueries({ queryKey: ['admin-technicians'] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof EMPTY_FORM }) => {
      const r = await fetch(`${BASE}/api/admin/technicians/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          phone: data.phone.trim() ? data.phone.trim().replace(/\D/g, '') : '',
          visitingCharge: data.visitingCharge || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Update failed');
      return r.json();
    },
    onSuccess: () => {
      toast.success('✅ Technician updated');
      qc.invalidateQueries({ queryKey: ['admin-technicians'] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/admin/technicians/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!r.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      toast.success('Technician deleted');
      qc.invalidateQueries({ queryKey: ['admin-technicians'] });
      setDeleteTarget(null);
    },
    onError: () => toast.error('Delete failed'),
  });

  function openCreate() {
    setEditTech(null);
    setForm(EMPTY_FORM);
    setPhoneError('');
    setDialogOpen(true);
  }

  function openEdit(t: Technician) {
    setEditTech(t);
    setForm({
      name: t.name,
      phone: t.phone ?? '',
      professionType: t.professionType,
      avatarEmoji: t.avatarEmoji ?? '',
      visitingCharge: t.visitingCharge ?? '',
      isActive: t.isActive,
    });
    setPhoneError('');
    setDialogOpen(true);
  }

  function handlePhoneChange(val: string) {
    setForm(f => ({ ...f, phone: val }));
    setPhoneError(validatePhone(val) ?? '');
  }

  function handleSubmit() {
    const err = validatePhone(form.phone);
    if (err) { setPhoneError(err); return; }
    if (!form.name.trim() || !form.professionType) { toast.error('Name and profession type required'); return; }
    if (editTech) {
      updateMut.mutate({ id: editTech.id, data: form });
    } else {
      createMut.mutate(form);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  const filtered = techs.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.uniqueCode.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search) || ''
  );

  const realCount = techs.filter(t => !t.isTestData).length;
  const testCount = techs.filter(t => t.isTestData).length;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-foreground">Technicians</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage mobile technician accounts — view codes, edit details, add or remove entries.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Plus className="w-4 h-4 mr-1.5" /> Add Technician
          </Button>
        )}
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <div className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-sm">
          <span className="text-slate-400">Active Technicians: </span>
          <span className="font-bold text-cyan-300">{realCount}</span>
        </div>
        {testCount > 0 && (
          <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-sm">
            <span className="text-slate-400">Sandbox/Test: </span>
            <span className="font-bold text-purple-400">{testCount}</span>
          </div>
        )}
      </div>

      {/* ── Search ─────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search by name, code, or phone…"
          className="pl-9 bg-slate-800 border-slate-700"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Technicians list ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl bg-slate-800" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
          <Wrench className="w-10 h-10 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">No technicians found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tech => (
            <Card key={tech.id} className={`border ${tech.isTestData ? 'border-purple-500/20 bg-purple-500/5' : 'border-slate-700 bg-slate-800/40'}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl shrink-0">
                  {tech.avatarEmoji ?? (tech.isTestData ? '🤖' : '👤')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-100">{tech.name}</span>
                    {tech.isTestData && <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400">TEST</Badge>}
                    {!tech.isActive && <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-400">Inactive</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />{tech.uniqueCode}
                    </span>
                    {tech.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />{tech.phone}
                      </span>
                    )}
                    <span>{PROFESSION_OPTIONS.find(p => p.value === tech.professionType)?.label ?? tech.professionType}</span>
                    {tech.visitingCharge && <span>₹{tech.visitingCharge} visit</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {tech.isActive
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <XCircle className="w-4 h-4 text-slate-600" />}
                  <span className="text-[11px] text-slate-600 ml-2 hidden sm:block">
                    {format(new Date(tech.createdAt), 'dd MMM yy')}
                  </span>
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 ml-1 text-slate-400 hover:text-cyan-400" onClick={() => openEdit(tech)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-rose-400" onClick={() => setDeleteTarget(tech)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-cyan-300 flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              {editTech ? 'Edit Technician' : 'Add New Technician'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Name <span className="text-rose-400">*</span></Label>
              <Input placeholder="Ramesh Kumar" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-slate-800 border-slate-700" />
            </div>

            {/* Phone — strict validation */}
            <div className="space-y-1.5">
              <Label>
                Phone
                <span className="ml-2 text-[11px] text-slate-500">(10-digit Indian mobile)</span>
              </Label>
              <Input
                placeholder="9876543210"
                value={form.phone}
                onChange={e => handlePhoneChange(e.target.value)}
                maxLength={10}
                className={`bg-slate-800 border-slate-700 ${phoneError ? 'border-rose-500 focus-visible:ring-rose-500' : ''}`}
              />
              {phoneError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400">
                  <AlertTriangle className="w-3 h-3" /> {phoneError}
                </div>
              )}
              {form.phone && !phoneError && form.phone.replace(/\D/g, '').length === 10 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Valid Indian mobile number
                </div>
              )}
            </div>

            {/* Profession Type */}
            <div className="space-y-1.5">
              <Label>Profession Type <span className="text-rose-400">*</span></Label>
              <Select value={form.professionType} onValueChange={v => setForm(f => ({ ...f, professionType: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Select profession…" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {PROFESSION_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visiting Charge */}
            <div className="space-y-1.5">
              <Label>Visiting Charge (₹)</Label>
              <Input placeholder="e.g. 200" value={form.visitingCharge}
                onChange={e => setForm(f => ({ ...f, visitingCharge: e.target.value }))}
                className="bg-slate-800 border-slate-700" type="number" />
            </div>

            {/* Avatar Emoji */}
            <div className="space-y-1.5">
              <Label>Avatar Emoji</Label>
              <Input placeholder="🔧" value={form.avatarEmoji}
                onChange={e => setForm(f => ({ ...f, avatarEmoji: e.target.value }))}
                className="bg-slate-800 border-slate-700 w-24" maxLength={4} />
            </div>

            {/* Active toggle (edit only) */}
            {editTech && (
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/60 border border-slate-700">
                <Label className="cursor-pointer">Active</Label>
                <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)} className="text-slate-400">Cancel</Button>
            <Button size="sm" onClick={handleSubmit}
              disabled={isPending || !!phoneError}
              className="bg-cyan-600 hover:bg-cyan-700 text-white">
              {isPending ? 'Saving…' : editTech ? 'Save Changes' : 'Create Technician'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-400">Delete Technician?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-slate-200">{deleteTarget?.name}</span> ({deleteTarget?.uniqueCode}) को permanently delete kar diya jayega.
              Unke KYC documents bhi hata diye jaayenge. Yeh action undo nahi ho sakta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-400">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}>
              {deleteMut.isPending ? 'Deleting…' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
