import { useLocation } from 'wouter';
import { Mail } from 'lucide-react';

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <Mail className="mx-auto mb-4 h-10 w-10 text-amber-400" />
        <h1 className="text-xl font-bold text-white">Invitation required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Service Center accounts are created by an administrator. Ask your owner or administrator to send you an invitation.
        </p>
        <button
          type="button"
          onClick={() => setLocation('/sign-in')}
          className="mt-6 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          Go to sign in
        </button>
      </div>
    </div>
  );
}
