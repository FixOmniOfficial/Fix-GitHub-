/**
 * Admin Testing Sandbox — SUPER ADMIN ONLY, never accessible from public app.
 * Generate fake test technicians, view test data, and 1-click delete everything.
 * Click any technician card to open a "Preview as this tech" panel with their
 * unique code + instructions for the booking-app Test Mode.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FlaskConical, Trash2, Plus, RefreshCw, ShieldAlert,
  Bot, Phone, Wrench, Hash, AlertTriangle, Play, Copy, Check,
  Smartphone, ChevronRight, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

interface TestTech {
  id: number;
  name: string;
  phone: string | null;
  professionType: string;
  uniqueCode: string;
  avatarEmoji: string | null;
  createdAt: string;
}

async function fetchSandboxData(): Promise<{ technicians: TestTech[]; total: number }> {
  const r = await fetch(`${BASE}/api/admin/sandbox/data`, { credentials: 'include' });
  if (!r.ok) throw new Error('Failed to fetch sandbox data');
  return r.json();
}

const PROFESSION_LABELS: Record<string, string> = {
  ac_technician: '❄️ AC Technician', electrician: '⚡ Electrician',
  plumber: '🔧 Plumber', carpenter: '🪚 Carpenter',
  painter: '🎨 Painter', repair: '⚙️ Repair',
};

// ── Preview Modal — shown when clicking a test tech card ─────────────────────
function PreviewModal({
  tech,
  open,
  onClose,
}: {
  tech: TestTech | null;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!tech) return;
    try {
      await navigator.clipboard.writeText(tech.uniqueCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied!');
    } catch {
      toast.error('Copy failed — please copy manually');
    }
  };

  if (!tech) return null;

  const profLabel = PROFESSION_LABELS[tech.professionType] ?? tech.professionType;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-purple-300 flex items-center gap-2 text-base">
            <Play className="w-4 h-4 fill-purple-400 text-purple-400" />
            Preview as this Technician
          </DialogTitle>
        </DialogHeader>

        {/* Tech summary */}
        <div className="flex items-center gap-3 bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl shrink-0">
            {tech.avatarEmoji ?? '🤖'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-200 text-sm">{tech.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{profLabel}</div>
            {tech.phone && (
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <Phone className="w-3 h-3" />{tech.phone}
              </div>
            )}
          </div>
        </div>

        {/* Unique code — the key piece for test mode */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Technician Code — use this in the booking app
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-800 border border-purple-500/40 rounded-lg px-4 py-3 font-mono text-purple-300 font-bold text-lg tracking-widest text-center select-all">
              {tech.uniqueCode}
            </div>
            <button
              onClick={copyCode}
              className="p-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg transition-colors shrink-0"
              title="Copy code"
            >
              {copied
                ? <Check className="w-4 h-4 text-green-400" />
                : <Copy className="w-4 h-4 text-purple-400" />}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-blue-300 font-semibold text-sm">
            <Smartphone className="w-4 h-4" />
            How to preview in the mobile app
          </div>
          {[
            { n: '1', text: 'Open the Fix Omni booking app on your phone or emulator.' },
            { n: '2', text: 'On the home screen, tap "🧪 Developer / Test Mode" link (below the login button).' },
            { n: '3', text: 'Select any Technician profile from the list — it logs in instantly.' },
            { n: '4', text: 'A purple banner appears at the top showing the active test role.' },
            { n: '5', text: 'Use "Switch" in the banner to change profiles, "✕ Exit" to leave test mode.' },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/25 border border-blue-500/40 text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step.n}
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-slate-600 text-center">
          This code is only valid while the test data exists. Clear all test data before going live.
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400">
            <X className="w-3.5 h-3.5 mr-1.5" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SandboxPage() {
  const { isSuperAdmin } = useRole();
  const qc = useQueryClient();
  const [confirmClear, setConfirmClear] = useState(false);
  const [generateCount, setGenerateCount] = useState(1);
  const [previewTech, setPreviewTech] = useState<TestTech | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sandbox-data'],
    queryFn: fetchSandboxData,
    enabled: isSuperAdmin,
    staleTime: 10000,
  });

  const generateMutation = useMutation({
    mutationFn: async (count: number) => {
      const r = await fetch(`${BASE}/api/admin/sandbox/generate`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Generate failed');
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`✅ ${d.count} test technician${d.count > 1 ? 's' : ''} created`);
      qc.invalidateQueries({ queryKey: ['sandbox-data'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/admin/sandbox/clear`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Clear failed');
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`🗑️ ${d.deleted} test entries deleted`);
      qc.invalidateQueries({ queryKey: ['sandbox-data'] });
      setConfirmClear(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <ShieldAlert className="w-16 h-16 text-slate-700 mb-4" />
        <h2 className="text-xl font-bold text-slate-300">Super Admin Only</h2>
        <p className="text-slate-500 mt-2 text-sm">This section is restricted to super administrators.</p>
      </div>
    );
  }

  const techs = data?.technicians ?? [];

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-foreground">Testing Sandbox</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Internal testing only — generate fake data, simulate flows, delete all after testing.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="border-slate-700 text-slate-400 hover:text-purple-400 hover:bg-purple-500/5">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Warning banner ──────────────────────────────────────────── */}
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200">
          <span className="font-bold">Internal Use Only.</span> Test data is marked with 🤖 avatar and
          "TEST SANDBOX" shop name. It is completely hidden from the public booking app and customer forms.
          Always click <em>Clear All</em> before going live.
        </div>
      </div>

      {/* ── Generate panel ──────────────────────────────────────────── */}
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-purple-300 flex items-center gap-2">
            <Bot className="w-4 h-4" /> Generate Test Technicians
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">
            Creates fake technicians with random Indian names, phone numbers, and profession types.
            All marked as test data (invisible to public).
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Count:</span>
              {[1, 3, 5, 10].map(n => (
                <button key={n} onClick={() => setGenerateCount(n)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold border transition-all ${
                    generateCount === n
                      ? 'bg-purple-500/30 border-purple-400 text-purple-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}>{n}</button>
              ))}
            </div>
            <Button
              onClick={() => generateMutation.mutate(generateCount)}
              disabled={generateMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {generateMutation.isPending ? 'Generating…' : `Generate ${generateCount}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Test data list ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Test Technicians
              <span className="ml-2 text-purple-400">({techs.length})</span>
            </h2>
            {techs.length > 0 && (
              <p className="text-xs text-slate-600 mt-0.5">
                Click any card to preview in the booking app
              </p>
            )}
          </div>
          {techs.length > 0 && (
            <Button variant="destructive" size="sm"
              onClick={() => setConfirmClear(true)}
              className="h-7 text-xs bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/40">
              <Trash2 className="w-3 h-3 mr-1" />
              Clear All Test Data
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl bg-slate-800" />)}</div>
        ) : techs.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-slate-800 rounded-xl">
            <Bot className="w-10 h-10 mx-auto text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">No test data yet. Generate some above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {techs.map(tech => (
              <button
                key={tech.id}
                onClick={() => setPreviewTech(tech)}
                className="w-full flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-xl px-4 py-3 transition-all group text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-lg shrink-0">
                  {tech.avatarEmoji ?? '🤖'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-200 text-sm">{tech.name}</div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      {PROFESSION_LABELS[tech.professionType] ?? tech.professionType}
                    </span>
                    {tech.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{tech.phone}</span>}
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{tech.uniqueCode}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400 bg-purple-500/10 shrink-0">
                  TEST
                </Badge>
                <span className="text-[10px] text-slate-600 shrink-0">
                  {format(new Date(tech.createdAt), 'dd MMM, HH:mm')}
                </span>
                {/* Preview arrow — visible on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-purple-400 font-semibold">Preview</span>
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview modal ───────────────────────────────────────────── */}
      <PreviewModal
        tech={previewTech}
        open={!!previewTech}
        onClose={() => setPreviewTech(null)}
      />

      {/* ── Confirm clear dialog ────────────────────────────────────── */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Confirm: Delete All Test Data
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-400 space-y-2">
            <p>This will permanently delete:</p>
            <ul className="list-disc list-inside text-slate-500 space-y-1 text-xs">
              <li>All {techs.length} test technician{techs.length !== 1 ? 's' : ''}</li>
              <li>Their KYC documents, customers, payments, reminders</li>
              <li>All other is_test_data entries</li>
            </ul>
            <p className="text-rose-400 text-xs font-semibold mt-3">This cannot be undone.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)} className="text-slate-400">Cancel</Button>
            <Button size="sm" disabled={clearMutation.isPending}
              onClick={() => clearMutation.mutate()}
              className="bg-rose-600 hover:bg-rose-700 text-white">
              {clearMutation.isPending ? 'Deleting…' : '🗑️ Delete All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
