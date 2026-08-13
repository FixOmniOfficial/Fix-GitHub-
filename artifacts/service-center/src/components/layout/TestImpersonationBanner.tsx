/**
 * TestImpersonationBanner — sticky top bar shown while a test user session
 * is active in the booking app (opened from the sandbox).
 *
 * Shows: 🧪 Testing as [Name] ([Role]) | Reopen | Switch | Exit
 */
import React from 'react';
import { FlaskConical, ExternalLink, X, RefreshCw } from 'lucide-react';
import { useTestImpersonation } from '@/contexts/TestImpersonationContext';
import { useLocation } from 'wouter';

const PROFESSION_LABELS: Record<string, string> = {
  ac_technician: 'AC Technician',
  electrician: 'Electrician',
  plumber: 'Plumber',
  carpenter: 'Carpenter',
  painter: 'Painter',
  repair: 'Repair',
};

export function TestImpersonationBanner() {
  const { isActive, activeUser, stopImpersonation } = useTestImpersonation();
  const [, setLocation] = useLocation();

  if (!isActive || !activeUser) return null;

  const roleLabel = activeUser.role === 'technician'
    ? (activeUser.professionType ? PROFESSION_LABELS[activeUser.professionType] ?? activeUser.professionType : 'Technician')
    : 'Customer';

  const handleReopen = () => window.open(activeUser.bookingAppUrl, '_blank', 'noopener');
  const handleSwitch = () => setLocation('/sandbox');
  const handleExit   = () => stopImpersonation();

  return (
    <div
      className="
        w-full flex items-center gap-3 px-4 py-2.5
        bg-gradient-to-r from-purple-950/95 via-slate-900/95 to-purple-950/95
        border-b border-purple-500/30 backdrop-blur-sm
        sticky top-0 z-[9998]
      "
    >
      {/* Left — role indicator */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FlaskConical className="w-4 h-4 text-purple-400 shrink-0" />
        <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest shrink-0 hidden sm:block">
          TEST MODE
        </div>
        <div className="text-[10px] text-slate-500 hidden sm:block">·</div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">{activeUser.emoji}</span>
          <span className="text-sm font-semibold text-slate-200 truncate">
            {activeUser.name}
          </span>
          <span className="hidden sm:inline text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full shrink-0">
            {roleLabel.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleReopen}
          title="Reopen booking app"
          className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-lg px-2.5 py-1.5 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span className="hidden sm:inline">Open App</span>
        </button>

        <button
          onClick={handleSwitch}
          title="Switch test profile"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span className="hidden sm:inline">Switch</span>
        </button>

        <button
          onClick={handleExit}
          title="Exit test mode"
          className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg px-2.5 py-1.5 transition-colors"
        >
          <X className="w-3 h-3" />
          <span className="hidden sm:inline">Exit Test</span>
        </button>
      </div>
    </div>
  );
}
