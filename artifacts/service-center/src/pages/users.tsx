import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCircle, Shield, Ban, CheckCircle2, Clock, Crown, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';
import { useAuthContext } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

interface ClerkUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  banned: boolean;
  createdAt: number;
  lastSignInAt: number | null;
  imageUrl: string;
}

async function fetchAdminUsers(): Promise<ClerkUser[]> {
  const r = await authenticatedFetch('/api/admin/users');
  if (!r.ok) throw new Error('Failed to fetch users');
  return r.json();
}

async function setRole(id: string, role: string) {
  const r = await authenticatedFetch(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

async function setBan(id: string, ban: boolean) {
  const r = await authenticatedFetch(`/api/admin/users/${id}/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ban }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  super_admin: { label: 'Super Admin', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', icon: Shield },
  admin:       { label: 'Admin',            color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',    icon: Crown },
  staff:       { label: 'Staff',                color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       icon: UserCircle },
  technician:  { label: 'Technician',        color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',       icon: UserCircle },
  viewer:      { label: 'Viewer',                color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',    icon: UserCircle },
  user:        { label: 'User',              color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',   icon: UserCircle },
};

export default function Users() {
  const { isAdmin } = useRole();
  const { meUser: me } = useAuthContext();
  const qc = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchAdminUsers,
    enabled: isAdmin,
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => setRole(id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Role updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const banMut = useMutation({
    mutationFn: ({ id, ban }: { id: string; ban: boolean }) => setBan(id, ban),
    onSuccess: (_, { ban }) => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success(ban ? 'User blocked' : 'User unblocked'); },
    onError: (e: Error) => toast.error(e.message),
  });

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Users 
        </h1>
        <p className="text-slate-400 mt-1">Manage all users — change roles, block/unblock</p>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'user').map(([role, cfg]) => (
          <span key={role} className={`px-2 py-1 rounded-full border font-medium ${cfg.color}`}>{cfg.label}</span>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl bg-slate-800" />)
        ) : error ? (
          <div className="text-center py-12 text-rose-400">Users could not be loaded. Check the server.</div>
        ) : users?.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-xl">
            <UserCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">No users yet.</p>
          </div>
        ) : (
          users?.map(user => {
            const cfg = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.user;
            const RoleIcon = cfg.icon;
            const isMe = user.id === me?.id;

            return (
              <Card key={user.id} className={`bg-slate-900 border-slate-800 ${user.banned ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img src={user.imageUrl} alt={user.name}
                        className="w-11 h-11 rounded-full border-2 border-slate-700 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-slate-900">
                        <RoleIcon className={`w-3 h-3 ${cfg.color.split(' ')[1]}`} />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm truncate">{user.name}</span>
                        {isMe && <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 border">(You)</Badge>}
                        {user.banned && <Badge className="text-[10px] bg-rose-500/20 text-rose-400 border-rose-500/30 border">Blocked</Badge>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{user.email ?? '—'}</div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-600">
                        <Clock className="w-3 h-3" />
                        <span>Last login: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString('hi-IN') : 'Never'}</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role selector */}
                      <Select
                        value={user.role}
                        onValueChange={(role) => roleMut.mutate({ id: user.id, role })}
                        disabled={isMe || roleMut.isPending}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs bg-slate-800 border-slate-700 text-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="super_admin" className="text-violet-400">🛡️ Super Admin</SelectItem>
                          <SelectItem value="admin" className="text-amber-400">👑 Admin</SelectItem>
                          <SelectItem value="staff" className="text-blue-400">🧑‍💼 Staff</SelectItem>
                          <SelectItem value="technician" className="text-cyan-400">🔧 Technician</SelectItem>
                          <SelectItem value="viewer" className="text-slate-300">👁 Viewer</SelectItem>
                          <SelectItem value="user" className="text-slate-400">👤 User</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Ban/Unban */}
                      {!isMe && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => banMut.mutate({ id: user.id, ban: !user.banned })}
                          disabled={banMut.isPending}
                          className={user.banned
                            ? 'h-8 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                            : 'h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                          }
                          title={user.banned ? 'Unblock' : 'Block'}
                        >
                          {user.banned ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
