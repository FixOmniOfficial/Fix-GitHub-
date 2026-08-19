import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserCog, Plus, Trash2, Shield, Users, BookOpen, BarChart3, ShieldCheck, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
  permissions: string[];
  banned: boolean;
  createdAt: number;
  lastSignInAt: number | null;
}

const PERMISSION_CONFIG = [
  {
    key: 'booking_management',
    label: 'Booking Management',
    labelHi: 'Booking Management',
    icon: BookOpen,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    key: 'user_management',
    label: 'User Management',
    labelHi: 'User Management',
    icon: Users,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    labelHi: 'Analytics',
    icon: BarChart3,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    key: 'kyc_review',
    label: 'KYC Review',
    labelHi: 'KYC Review',
    icon: Fingerprint,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
] as const;

async function fetchStaff(): Promise<StaffMember[]> {
  const r = await authenticatedFetch('/api/admin/staff');
  if (!r.ok) throw new Error('Failed to fetch staff');
  return r.json();
}

async function createStaff(data: {
  firstName: string; lastName: string; email: string; password: string; permissions: string[];
}) {
  const r = await authenticatedFetch('/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

async function updatePermissions(id: string, permissions: string[]) {
  const r = await authenticatedFetch(`/api/admin/staff/${id}/permissions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

async function deleteStaff(id: string) {
  const r = await authenticatedFetch(`/api/admin/staff/${id}`, {
    method: 'DELETE',
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

export default function StaffPage() {
  const { isAdmin, isSuperAdmin } = useRole();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', permissions: [] as string[] });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: fetchStaff,
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      toast.success('Staff account created ✅');
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', email: '', password: '', permissions: [] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      toast.success('Staff account deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handlePermissionToggle(member: StaffMember, permKey: string, enabled: boolean) {
    setTogglingId(`${member.id}-${permKey}`);
    const newPerms = enabled
      ? [...member.permissions, permKey]
      : member.permissions.filter((p) => p !== permKey);
    try {
      await updatePermissions(member.id, newPerms);
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      toast.success(`Permission ${enabled ? 'granted' : 'removed'}`);
    } catch (e: any) {
      toast.error(e.message || 'Permission update failed');
    } finally {
      setTogglingId(null);
    }
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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Staff 
          </h1>
          <p className="text-slate-400 mt-1">Create staff accounts and manage their permissions</p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Staff
          </Button>
        )}
      </div>

      {/* Permission Legend */}
      <div className="flex flex-wrap gap-2">
        {PERMISSION_CONFIG.map((p) => (
          <div key={p.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${p.bg} ${p.color} border border-current/20`}>
            <p.icon className="w-3 h-3" />
            {p.label}
          </div>
        ))}
      </div>

      {/* Staff List */}
      <div className="space-y-4">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl bg-slate-800" />)
        ) : error ? (
          <div className="text-center py-12 text-rose-400">Staff could not be loaded. Check the server.</div>
        ) : staff?.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 border-dashed">
            <CardContent className="py-16 text-center">
              <UserCog className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No staff members yet</p>
              <p className="text-slate-600 text-sm mt-1">Tap "New Staff" above to create an account</p>
            </CardContent>
          </Card>
        ) : (
          staff?.map((member) => (
            <Card key={member.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-violet-400" />
                  </div>

                  {/* Info + Permissions */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-white text-sm">{member.name}</span>
                      <Badge className="text-[10px] bg-violet-500/20 text-violet-400 border-violet-500/30 border">
                        Staff
                      </Badge>
                      {member.banned && (
                        <Badge className="text-[10px] bg-rose-500/20 text-rose-400 border-rose-500/30 border">
                          Blocked
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mb-4">{member.email ?? '—'}</div>

                    {/* Permission Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {PERMISSION_CONFIG.map((perm) => {
                        const enabled = member.permissions.includes(perm.key);
                        const isToggling = togglingId === `${member.id}-${perm.key}`;
                        return (
                          <div
                            key={perm.key}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                              enabled
                                ? `${perm.bg} border-current/20`
                                : 'bg-slate-800/50 border-slate-700'
                            }`}
                          >
                            <perm.icon className={`w-3.5 h-3.5 shrink-0 ${enabled ? perm.color : 'text-slate-600'}`} />
                            <div className="flex-1 min-w-0">
                              <div className={`text-[11px] font-medium leading-tight ${enabled ? perm.color : 'text-slate-500'}`}>
                                {perm.label}
                              </div>
                              <div className="text-[10px] text-slate-600">{perm.labelHi}</div>
                            </div>
                            <Switch
                              checked={enabled}
                              disabled={isToggling}
                              onCheckedChange={(v) => handlePermissionToggle(member, perm.key, v)}
                              className="shrink-0 scale-90"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delete */}
                  {isSuperAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(member)}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Staff Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Staff Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">First Name</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="Ramesh"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Last Name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Kumar"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="staff@example.com"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="At least 8 characters"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Initial Permissions</Label>
              <div className="space-y-2">
                {PERMISSION_CONFIG.map((perm) => {
                  const enabled = form.permissions.includes(perm.key);
                  return (
                    <div key={perm.key} className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <perm.icon className={`w-3.5 h-3.5 ${enabled ? perm.color : 'text-slate-500'}`} />
                        <span className={`text-sm ${enabled ? 'text-slate-200' : 'text-slate-500'}`}>{perm.label}</span>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => setForm(f => ({
                          ...f,
                          permissions: v
                            ? [...f.permissions, perm.key]
                            : f.permissions.filter(p => p !== perm.key),
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button
              onClick={() => createMut.mutate(form)}
              disabled={createMut.isPending || !form.email || !form.password}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            >
              {createMut.isPending ? 'Creating…' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Staff?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <strong className="text-slate-200">{deleteTarget?.name}</strong> 's account will be permanently deleted.
              This action cannot be undone.
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
