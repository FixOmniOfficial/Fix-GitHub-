import React, { useState, useRef } from 'react';
import { Wrench, Eye, EyeOff, ArrowLeft, RefreshCw, KeyRound, Shield, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/use-auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Step = 'login' | 'forgot' | 'otp' | 'reset' | 'done';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<Step>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Login step
  const [loginVal, setLoginVal] = useState('');
  const [passVal, setPassVal] = useState('');

  // Forgot step
  const [forgotLogin, setForgotLogin] = useState('');
  const [otpUserId, setOtpUserId] = useState<number | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // OTP step
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset step
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  // ── Login ──────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginVal.trim() || !passVal) return;
    setLoading(true);
    try {
      const data = await authApi.login(loginVal.trim(), passVal);
      if (data.error) { toast.error(data.error); return; }
      onLogin();
    } catch { toast.error('Could not connect to server'); }
    finally { setLoading(false); }
  }

  // ── Send OTP ────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotLogin.trim()) return;
    setLoading(true);
    try {
      const data = await authApi.sendOtp(forgotLogin.trim());
      if (data.error) { toast.error(data.error); return; }
      setOtpUserId(data.userId ?? null);
      setDevOtp(data.otp ?? null); // dev-mode OTP shown in UI
      setStep('otp');
      toast.success('OTP sent');
    } catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  }

  // ── OTP digit input ─────────────────────────────────────────
  function handleOtpChange(idx: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  }

  function handleOtpKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { toast.error('Please enter the 6-digit OTP'); return; }
    if (!otpUserId) { toast.error('Session expired, please try again'); setStep('forgot'); return; }
    setLoading(true);
    try {
      const data = await authApi.verifyOtp(otpUserId, code);
      if (data.error) { toast.error(data.error); return; }
      setStep('reset');
    } catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  }

  // ── Reset password ─────────────────────────────────────────
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return; }
    if (!otpUserId) return;
    setLoading(true);
    try {
      const data = await authApi.resetPassword(otpUserId, newPass);
      if (data.error) { toast.error(data.error); return; }
      setStep('done');
    } catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-7 pt-7 pb-5 border-b border-slate-800/60">
            <div className="flex items-center gap-3">
              {(step !== 'login') && (
                <button onClick={() => { setStep(step === 'otp' ? 'forgot' : step === 'reset' ? 'otp' : 'login'); }}
                  className="text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">Fix Omni</h1>
                <p className="text-slate-500 text-xs">Services Booking</p>
              </div>
            </div>
          </div>

          <div className="px-7 py-6">

            {/* ── Step: Login ── */}
            {step === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <p className="text-white font-semibold text-lg mb-1">Login</p>
                  <p className="text-slate-400 text-sm">Enter your username or email and password</p>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Username / Email</label>
                    <Input
                      value={loginVal} onChange={e => setLoginVal(e.target.value)}
                      placeholder="admin"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-amber-500/50"
                      autoComplete="username" autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <Input
                        type={showPass ? 'text' : 'password'}
                        value={passVal} onChange={e => setPassVal(e.target.value)}
                        placeholder="••••••••"
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 pr-10 focus-visible:ring-amber-500/50"
                        autoComplete="current-password"
                      />
                      <button type="button" tabIndex={-1}
                        onClick={() => setShowPass(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={loading || !loginVal || !passVal}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold h-10">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  Login
                </Button>

                <button type="button" onClick={() => setStep('forgot')}
                  className="w-full text-center text-sm text-slate-500 hover:text-amber-400 transition-colors pt-1">
                  Forgot Password?
                </button>
              </form>
            )}

            {/* ── Step: Forgot ── */}
            {step === 'forgot' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <p className="text-white font-semibold text-lg mb-1">Password Reset</p>
                  <p className="text-slate-400 text-sm">Enter your username, email or phone. You'll receive an OTP.</p>
                </div>
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Username / Email / Phone</label>
                  <Input
                    value={forgotLogin} onChange={e => setForgotLogin(e.target.value)}
                    placeholder="admin or admin@example.com"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-amber-500/50"
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={loading || !forgotLogin.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold h-10">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                  Send OTP
                </Button>
              </form>
            )}

            {/* ── Step: OTP ── */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <p className="text-white font-semibold text-lg mb-1">Verify OTP</p>
                  <p className="text-slate-400 text-sm">Enter the 6-digit OTP (expires in 10 minutes)</p>
                </div>

                {/* Dev-mode OTP display */}
                {devOtp && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-amber-400/80 mb-1">Your OTP (Dev Mode)</p>
                    <p className="text-2xl font-bold text-amber-400 tracking-[0.3em]">{devOtp}</p>
                    <p className="text-[10px] text-slate-500 mt-1">In production this will be sent via SMS/WhatsApp</p>
                  </div>
                )}

                {/* OTP digit boxes */}
                <div className="flex gap-2 justify-center pt-1">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { otpRefs.current[idx] = el; }}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      maxLength={1}
                      inputMode="numeric"
                      className={cn(
                        'w-10 h-12 text-center text-xl font-bold rounded-lg border-2 bg-slate-800 text-white transition-colors focus:outline-none',
                        digit ? 'border-amber-500 text-amber-400' : 'border-slate-700 focus:border-amber-500/60'
                      )}
                    />
                  ))}
                </div>

                <Button type="submit" disabled={loading || otp.join('').length < 6}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold h-10">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Verify OTP
                </Button>

                <button type="button" onClick={() => { setOtp(['','','','','','']); handleSendOtp(new Event('click') as unknown as React.FormEvent); }}
                  className="w-full text-center text-sm text-slate-500 hover:text-amber-400 transition-colors">
                  Resend OTP
                </button>
              </form>
            )}

            {/* ── Step: Reset Password ── */}
            {step === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <p className="text-white font-semibold text-lg mb-1">New Password</p>
                  <p className="text-slate-400 text-sm">OTP verified! Now set your new password</p>
                </div>
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">New Password</label>
                    <div className="relative">
                      <Input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPass} onChange={e => setNewPass(e.target.value)}
                        placeholder="At least 4 characters"
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 pr-10 focus-visible:ring-amber-500/50"
                        autoFocus
                      />
                      <button type="button" tabIndex={-1}
                        onClick={() => setShowNewPass(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Confirm Password</label>
                    <Input
                      type="password"
                      value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                      placeholder="Re-enter password"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-amber-500/50"
                    />
                    {confirmPass && newPass !== confirmPass && (
                      <p className="text-xs text-rose-400">Passwords do not match</p>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={loading || !newPass || !confirmPass || newPass !== confirmPass}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold h-10">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  Save Password
                </Button>
              </form>
            )}

            {/* ── Step: Done ── */}
            {step === 'done' && (
              <div className="text-center py-4 space-y-4">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
                <div>
                  <p className="text-white font-semibold text-lg">Password changed!</p>
                  <p className="text-slate-400 text-sm mt-1">You can now login with your new password</p>
                </div>
                <Button onClick={() => { setStep('login'); setLoginVal(forgotLogin); setPassVal(''); }}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold h-10">
                  Login
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Default credentials hint */}
        {step === 'login' && (
          <p className="text-center text-xs text-slate-700 mt-4">
            Default: username <span className="text-slate-500 font-mono">admin</span> / password <span className="text-slate-500 font-mono">admin123</span>
          </p>
        )}
      </div>
    </div>
  );
}
