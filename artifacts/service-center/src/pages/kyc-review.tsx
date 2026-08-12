import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShieldCheck, ShieldX, Clock, Eye, CheckCircle2, XCircle,
  FileText, User, Phone, Wrench, RefreshCw, FileImage,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';
import { format } from 'date-fns';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

interface KycEntry {
  id: number;
  professionalId: number;
  fullName: string;
  email: string | null;
  panCardPath: string | null;
  addressProofPath: string | null;
  status: 'pending' | 'verified' | 'rejected';
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  tech: {
    id: number;
    name: string;
    professionType: string;
    phone: string | null;
    uniqueCode: string;
    avatarEmoji: string | null;
  };
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  labelHi: 'लंबित',   icon: Clock,         color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30' },
  verified: { label: 'Verified', labelHi: 'सत्यापित', icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  rejected: { label: 'Rejected', labelHi: 'अस्वीकृत', icon: XCircle,      color: 'text-rose-400',   bg: 'bg-rose-500/15 border-rose-500/30' },
};

async function fetchKyc(status: string): Promise<KycEntry[]> {
  const r = await fetch(`${BASE}/api/admin/kyc?status=${status}`, { credentials: 'include' });
  if (!r.ok) throw new Error('Failed to fetch KYC list');
  return r.json();
}

function DocPreviewButton({ path, label }: { path: string | null; label: string }) {
  if (!path) return <span className="text-xs text-slate-600 italic">Not uploaded</span>;
  const url = `${BASE}/api/storage${path}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50">
        <FileImage className="w-3 h-3 mr-1" /> {label}
      </Button>
    </a>
  );
}

export default function KycReviewPage() {
  const { isAdmin, hasPermission } = useRole();
  const canReview = isAdmin || hasPermission('kyc_review');
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewTarget, setReviewTarget] = useState<KycEntry | null>(null);
  const [reviewAction, setReviewAction] = useState<'verified' | 'rejected'>('verified');
  const [reviewNotes, setReviewNotes]   = useState('');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-kyc', filterStatus],
    queryFn:  () => fetchKyc(filterStatus),
    enabled:  canReview,
    staleTime: 20000,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, notes }: { id: number; action: string; notes: string }) => {
      const r = await fetch(`${BASE}/api/admin/kyc/${id}/review`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Review failed');
      return r.json();
    },
    onSuccess: (_, vars) => {
      toast.success(`KYC ${vars.action === 'verified' ? '✅ Verified' : '❌ Rejected'} successfully`);
      qc.invalidateQueries({ queryKey: ['admin-kyc'] });
      setReviewTarget(null);
      setReviewNotes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canReview) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldX className="w-16 h-16 text-slate-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-300">Access Denied</h2>
        <p className="text-slate-500 mt-2 text-sm">You need KYC Review permission to access this page.</p>
      </div>
    );
  }

  const counts = {
    all:      data?.length ?? 0,
    pending:  data?.filter(d => d.status === 'pending').length ?? 0,
    verified: data?.filter(d => d.status === 'verified').length ?? 0,
    rejected: data?.filter(d => d.status === 'rejected').length ?? 0,
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            KYC Review
            <span className="ml-2 text-base font-normal text-muted-foreground">तकनीशियन सत्यापन</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review and approve technician identity documents</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-amber-500/5">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Status filter tabs ──────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'verified', 'rejected'] as const).map((s) => {
          const cfg = s === 'all' ? null : STATUS_CONFIG[s];
          const active = filterStatus === s;
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                active
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}>
              {cfg && <cfg.icon className={`w-3 h-3 ${active ? 'text-amber-400' : cfg.color}`} />}
              <span className="capitalize">{s === 'all' ? 'All' : cfg!.label}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                active ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-700 text-slate-400'
              }`}>
                {counts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl bg-slate-800" />)}</div>
      ) : !data?.length ? (
        <div className="text-center py-20">
          <ShieldCheck className="w-14 h-14 mx-auto text-slate-700 mb-4" />
          <p className="text-slate-400 font-medium">
            {filterStatus === 'all' ? 'No KYC submissions yet' : `No ${filterStatus} submissions`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((entry) => {
            const cfg = STATUS_CONFIG[entry.status];
            const StatusIcon = cfg.icon;
            return (
              <Card key={entry.id} className="border-slate-800 hover:border-slate-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Avatar + Tech info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                        {entry.tech.avatarEmoji ?? '👤'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-200">{entry.tech.name}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label} — {cfg.labelHi}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            {entry.tech.professionType.replace('_', ' ')}
                          </span>
                          {entry.tech.phone && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {entry.tech.phone}
                            </span>
                          )}
                          <span className="text-xs text-slate-600">{entry.tech.uniqueCode}</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Submitted: {format(new Date(entry.submittedAt), 'dd MMM yyyy, hh:mm a')}
                          {entry.reviewedAt && (
                            <span className="ml-2">
                              · Reviewed: {format(new Date(entry.reviewedAt), 'dd MMM yyyy')}
                              {entry.reviewerName && ` by ${entry.reviewerName}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* KYC details */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <User className="w-3 h-3" />
                        <span>{entry.fullName}</span>
                        {entry.email && <span className="text-slate-600">· {entry.email}</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <DocPreviewButton path={entry.panCardPath} label="PAN Card" />
                        <DocPreviewButton path={entry.addressProofPath} label="Address Proof" />
                      </div>
                      {entry.reviewNotes && (
                        <div className="text-xs text-slate-500 bg-slate-800/50 rounded px-2 py-1 max-w-xs">
                          <FileText className="w-3 h-3 inline mr-1" />
                          {entry.reviewNotes}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline"
                        className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-8 text-xs"
                        onClick={() => { setReviewTarget(entry); setReviewAction('verified'); setReviewNotes(''); }}>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verify
                      </Button>
                      <Button size="sm" variant="outline"
                        className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 h-8 text-xs"
                        onClick={() => { setReviewTarget(entry); setReviewAction('rejected'); setReviewNotes(''); }}>
                        <ShieldX className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Review Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!reviewTarget} onOpenChange={(o) => !o && setReviewTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className={reviewAction === 'verified' ? 'text-emerald-400' : 'text-rose-400'}>
              {reviewAction === 'verified' ? '✅ Verify KYC' : '❌ Reject KYC'}
            </DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-1 text-sm">
                <p className="font-semibold text-slate-200">{reviewTarget.tech.name}</p>
                <p className="text-slate-400 text-xs">KYC Name: {reviewTarget.fullName}</p>
                <p className="text-slate-500 text-xs">{reviewTarget.tech.uniqueCode}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Notes (optional)
                  {reviewAction === 'rejected' && <span className="text-rose-400 ml-1">— reason for rejection</span>}
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder={reviewAction === 'rejected' ? 'Document unclear, PAN mismatch...' : 'All documents verified...'}
                  className="bg-slate-800 border-slate-700 text-sm resize-none h-20"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReviewTarget(null)} className="text-slate-400">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={reviewMutation.isPending}
              onClick={() => reviewTarget && reviewMutation.mutate({ id: reviewTarget.id, action: reviewAction, notes: reviewNotes })}
              className={reviewAction === 'verified'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'}>
              {reviewMutation.isPending ? 'Saving…' : reviewAction === 'verified' ? 'Confirm Verify' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
