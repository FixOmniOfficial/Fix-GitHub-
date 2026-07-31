import React from 'react';
import { Wrench, ShieldCheck, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@workspace/replit-auth-web';

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-4">
              <Wrench className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white text-center">सर्विस सेंटर</h1>
            <p className="text-slate-400 text-sm mt-1 text-center">Service Center Manager</p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {[
              'ग्राहक और कार्य प्रबंधन',
              'भुगतान ट्रैकिंग',
              'रिमाइंडर और रिपोर्ट्स',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-slate-400">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* Login button */}
          <Button
            onClick={login}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold h-11 text-base"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Login करें / Log In
          </Button>

          <p className="text-center text-xs text-slate-600 mt-4">
            Secure login · कोई password याद रखने की जरूरत नहीं
          </p>
        </div>
      </div>
    </div>
  );
}
