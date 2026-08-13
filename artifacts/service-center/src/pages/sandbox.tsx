/**
 * Admin Testing Sandbox — SUPER ADMIN ONLY
 *
 * Generate fake technicians & customers for QA/testing.
 * Click any card → "Login as this User (Web)" opens the booking app
 * in a new tab with the test user already logged in.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FlaskConical, Trash2, Plus, RefreshCw, ShieldAlert, Bot, Phone,
  Wrench, Hash, AlertTriangle, Monitor, Smartphone, X, Check,
  Copy, Users, ChevronRight, LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { useTestImpersonation } from '@/contexts/TestImpersonationContext';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

// ── Booking-app web URL construction ─────────────────────────────────────────
// Both apps share the same origin; booking app lives at /booking-app/
const BOOKING_WEB_ORIGIN = window.location.origin;
function buildBookingUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${BOOKING_WEB_ORIGIN}/booking-app/test-mode?${qs}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface TestTech {
  id: number;
  name: string;
  phone: string | null;
  professionType: string;
  uniqueCode: string;
  avatarEmoji: string | null;
  createdAt: string;
}
interface TestCustomer {
  id: number;
  name: string;
  phone: string | null;
  uniqueCode: string;
  createdAt: string;
}

const PROFESSION_LABELS: Record<string, string> = {
  ac_technician: '❄️ AC Technician', electrician: '⚡ Electrician',
  plumber: '🔧 Plumber', carpenter: '🪚 Carpenter',
  painter: '🎨 Painter', repair: '⚙️ Repair',
};
const PROFESSION_EMOJIS: Record<string, string> = {
  ac_technician: '❄️', electrician: '⚡', plumber: '🔧',
  carpenter: '🪚', painter: '🎨', repair: '⚙️',
};

async function fetchSandboxData(): Promise<{
  technicians: TestTech[];
  customers: TestCustomer[];
  total: number;
}> {
  const r = await fetch(`${BASE}/api/admin/sandbox/data`, { credentials: 'include' });
  if (!r.ok) throw new Error('Failed to fetch sandbox data');
  return r.json();
}

// ── Compact card row used for both techs and customers ───────────────────────
function SandboxCard({
  emoji, title, subtitle, code, createdAt, badge, onPreview,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  code: string;
  createdAt: string;
  badge?: string;
  onPreview: () => void;
}) {
  return (
    <button
      onClick={onPreview}
      className="w-full flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-xl px-4 py-3 transition-all group text-left cursor-pointer"
    >
      <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-lg shrink-0">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-200 text-sm">{title}</div>
        <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
          <span>{subtitle}</span>
          {badge && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{code}</span>}
        </div>
      </div>
      <span className="text-[10px] text-slate-600 shrink-0 hidden sm:block">
        {format(new Date(createdAt), 'dd MMM, HH:mm')}
      </span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-purple-400 font-semibold">Preview</span>
        <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
      </div>
    </button>
  );
}

// ── Preview / Login Modal ─────────────────────────────────────────────────────
type PreviewTarget =
  | { kind: 'tech';     tech: TestTech }
  | { kind: 'customer'; customer: TestCustomer };

function PreviewModal({
  target, open, onClose,
}: { target: PreviewTarget | null; open: boolean; onClose: () => void }) {
  const [copied, setCopied]     = useState(false);
  const [webOpened, setWebOpened] = useState(false);
  const [activeTab, setActiveTab] = useState<'web' | 'mobile'>('web');
  const { startImpersonation }  = useTestImpersonation();

  // Reset state on open
  React.useEffect(() => {
    if (open) { setCopied(false); setWebOpened(false); setActiveTab('web'); }
  }, [open]);

  if (!target) return null;

  const istech = target.kind === 'tech';
  const name    = istech ? target.tech.name     : target.customer.name;
  const code    = istech ? target.tech.uniqueCode : target.customer.uniqueCode;
  const phone   = istech ? target.tech.phone    : target.customer.phone;
  const emoji   = istech ? (target.tech.avatarEmoji ?? (PROFESSION_EMOJIS[target.tech.professionType] ?? '🤖')) : '👤';
  const roleLabel = istech
    ? (PROFESSION_LABELS[target.tech.professionType] ?? target.tech.professionType)
    : '👤 Customer';
  const role    = istech ? 'technician' : 'customer';
  const profType = istech ? target.tech.professionType : undefined;

  const bookingUrl = buildBookingUrl({
    autoLogin: '1',
    code,
    name,
    role,
    ...(profType ? { type: profType } : {}),
    emoji,
  });

  const handleWebLogin = () => {
    startImpersonation({
      name, code, role: role as 'technician' | 'customer',
      professionType: profType,
      emoji,
      bookingAppUrl: bookingUrl,
    });
    window.open(bookingUrl, '_blank', 'noopener,noreferrer');
    setWebOpened(true);
    toast.success(`Opened ${name}'s dashboard in a new tab!`);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied!');
    } catch { toast.error('Copy failed — copy manually'); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-purple-300 flex items-center gap-2 text-base">
            <LogIn className="w-4 h-4" />
            {istech ? 'Preview as this Technician' : 'Preview as this Customer'}
          </DialogTitle>
        </DialogHeader>

        {/* User summary */}
        <div className="flex items-center gap-3 bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl shrink-0">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-200 text-sm">{name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{roleLabel}</div>
            {phone && (
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <Phone className="w-3 h-3" />{phone}
              </div>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400 bg-purple-500/10 shrink-0">
            TEST
          </Badge>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('web')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'web'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Web Dashboard
          </button>
          <button
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'mobile'
                ? 'bg-slate-700 text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Mobile App
          </button>
        </div>

        {/* ── WEB TAB ── */}
        {activeTab === 'web' && (
          <div className="space-y-4">
            <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-4 space-y-2">
              <p className="text-sm text-slate-300 font-medium">
                Opens the Fix Omni booking app (web) instantly logged in as this {role}.
              </p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li>No password or OTP needed</li>
                <li>A purple "TEST MODE" banner appears at the top</li>
                <li>Full {role === 'technician' ? 'technician dashboard — customers, payments, reminders' : 'customer view — booking flow, history'}</li>
                <li>Session persists — log out &amp; back in to re-test</li>
              </ul>
            </div>

            {/* Login button */}
            <button
              onClick={handleWebLogin}
              className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold text-sm transition-all ${
                webOpened
                  ? 'bg-green-600/20 border border-green-500/40 text-green-400'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/40'
              }`}
            >
              {webOpened ? (
                <><Check className="w-4 h-4" /> Opened in New Tab — Switch to see it</>
              ) : (
                <><LogIn className="w-4 h-4" /> Login as this User (Web)</>
              )}
            </button>

            {webOpened && (
              <p className="text-center text-xs text-slate-500">
                A banner now appears at the top of this page too. Use "Switch" to test another profile.
              </p>
            )}
          </div>
        )}

        {/* ── MOBILE TAB ── */}
        {activeTab === 'mobile' && (
          <div className="space-y-4">
            {/* Code block */}
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                {role === 'technician' ? 'Technician' : 'Customer'} Code
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-800 border border-purple-500/40 rounded-lg px-4 py-3 font-mono text-purple-300 font-bold text-lg tracking-widest text-center select-all">
                  {code}
                </div>
                <button
                  onClick={copyCode}
                  className="p-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg transition-colors shrink-0"
                  title="Copy code"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-purple-400" />}
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
                'Open the Fix Omni booking app on your phone or emulator.',
                'On the home screen, tap "🧪 Developer / Test Mode" link.',
                'Select any profile — it logs in instantly.',
                'A purple banner appears at the top showing the active test role.',
                'Use "Switch" to change profiles, "✕ Exit" to leave test mode.',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/25 border border-blue-500/40 text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400">
            <X className="w-3.5 h-3.5 mr-1.5" />Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SandboxPage() {
  const { isSuperAdmin } = useRole();
  const qc = useQueryClient();
  const [confirmClear,   setConfirmClear]   = useState(false);
  const [generateCount,  setGenerateCount]  = useState(1);
  const [custCount,      setCustCount]      = useState(1);
  const [previewTarget,  setPreviewTarget]  = useState<PreviewTarget | null>(null);

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

  const generateCustMutation = useMutation({
    mutationFn: async (count: number) => {
      const r = await fetch(`${BASE}/api/admin/sandbox/generate-customers`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Generate failed');
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`✅ ${d.count} test customer${d.count > 1 ? 's' : ''} created`);
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

  const techs     = data?.technicians ?? [];
  const customers = (data as any)?.customers ?? [];

  const CountPicker = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400">Count:</span>
      {[1, 3, 5, 10].map(n => (
        <button key={n} onClick={() => onChange(n)}
          className={`w-8 h-8 rounded-lg text-sm font-bold border transition-all ${
            value === n
              ? 'bg-purple-500/30 border-purple-400 text-purple-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}>{n}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-foreground">Testing Sandbox</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Generate fake data, simulate flows, and preview any role's web dashboard in one click.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}
            className="border-slate-700 text-slate-400 hover:text-purple-400 hover:bg-purple-500/5">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {(techs.length > 0 || customers.length > 0) && (
            <Button variant="destructive" size="sm"
              onClick={() => setConfirmClear(true)}
              className="h-8 text-xs bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/40">
              <Trash2 className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* ── Warning ── */}
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200">
          <span className="font-bold">Internal Use Only.</span> Test users are hidden from the public app.
          Click any card below → <span className="font-bold text-purple-300">"Login as this User (Web)"</span> to instantly preview their dashboard in a new tab.
          Clear all before going live.
        </div>
      </div>

      {/* ── Generate panels (side by side on wide, stacked on mobile) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Technician generator */}
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-purple-300 flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Generate Test Technicians
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-400">Fake technicians with random Indian names &amp; TEST-XXXX codes.</p>
            <div className="flex flex-wrap items-center gap-3">
              <CountPicker value={generateCount} onChange={setGenerateCount} />
              <Button onClick={() => generateMutation.mutate(generateCount)}
                disabled={generateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                {generateMutation.isPending ? 'Generating…' : `Generate ${generateCount}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customer generator */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-300 flex items-center gap-2">
              <Users className="w-4 h-4" /> Generate Test Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-400">Fake customers with CUST-XXXX codes for customer flow testing.</p>
            <div className="flex flex-wrap items-center gap-3">
              <CountPicker value={custCount} onChange={setCustCount} />
              <Button onClick={() => generateCustMutation.mutate(custCount)}
                disabled={generateCustMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                {generateCustMutation.isPending ? 'Generating…' : `Generate ${custCount}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Test data lists ── */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl bg-slate-800" />)}</div>
      ) : (techs.length === 0 && customers.length === 0) ? (
        <div className="text-center py-14 border border-dashed border-slate-800 rounded-xl">
          <Bot className="w-10 h-10 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">No test data yet. Generate technicians or customers above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Technicians */}
          {techs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-purple-400" />
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Test Technicians <span className="text-purple-400">({techs.length})</span>
                </h2>
                <span className="text-xs text-slate-600 ml-1">— click a card to preview</span>
              </div>
              <div className="space-y-2">
                {techs.map(tech => (
                  <SandboxCard
                    key={tech.id}
                    emoji={tech.avatarEmoji ?? (PROFESSION_EMOJIS[tech.professionType] ?? '🤖')}
                    title={tech.name}
                    subtitle={PROFESSION_LABELS[tech.professionType] ?? tech.professionType}
                    code={tech.uniqueCode}
                    createdAt={tech.createdAt}
                    badge={tech.uniqueCode}
                    onPreview={() => setPreviewTarget({ kind: 'tech', tech })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Customers */}
          {customers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Test Customers <span className="text-blue-400">({customers.length})</span>
                </h2>
                <span className="text-xs text-slate-600 ml-1">— click a card to preview</span>
              </div>
              <div className="space-y-2">
                {customers.map((cust: TestCustomer) => (
                  <SandboxCard
                    key={cust.id}
                    emoji="👤"
                    title={cust.name}
                    subtitle={cust.phone ? `📞 ${cust.phone}` : 'No phone'}
                    code={cust.uniqueCode}
                    createdAt={cust.createdAt}
                    badge={cust.uniqueCode}
                    onPreview={() => setPreviewTarget({ kind: 'customer', customer: cust })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Preview/Login Modal ── */}
      <PreviewModal
        target={previewTarget}
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      {/* ── Confirm clear dialog ── */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Confirm: Delete All Test Data
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-400 space-y-2">
            <p>This will permanently delete all {techs.length} technician{techs.length !== 1 ? 's' : ''} and {customers.length} customer{customers.length !== 1 ? 's' : ''}, plus their related records (KYC, payments, reminders).</p>
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
