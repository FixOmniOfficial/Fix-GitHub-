import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { AppShell } from '@/components/layout/app-shell';
import { TestImpersonationProvider } from '@/contexts/TestImpersonationContext';
import Dashboard from '@/pages/dashboard';
import Customers from '@/pages/customers';
import CustomerDetail from '@/pages/customers/detail';
import Jobs from '@/pages/jobs';
import JobDetail from '@/pages/jobs/detail';
import Reminders from '@/pages/reminders';
import Calculator from '@/pages/calculator';
import Reports from '@/pages/reports';
import Users from '@/pages/users';
import Settings from '@/pages/settings';
import StaffPage from '@/pages/staff';
import ServiceCategoriesPage from '@/pages/service-categories';
import KycReviewPage from '@/pages/kyc-review';
import SandboxPage from '@/pages/sandbox';
import TechniciansPage from '@/pages/technicians';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';
import CustomerFormPage from '@/pages/customer-form';
import {
  ClerkProvider,
  useClerk,
  useAuth,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  baseTheme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/fixomni-logo.jpg`,
  },
  variables: {
    colorPrimary: '#f59e0b',
    colorForeground: '#f1f5f9',
    colorMutedForeground: '#64748b',
    colorDanger: '#f43f5e',
    colorBackground: '#0f172a',
    colorInput: '#1e293b',
    colorInputForeground: '#f1f5f9',
    colorNeutral: '#334155',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-slate-900 border border-slate-800 rounded-2xl w-[420px] max-w-full overflow-hidden shadow-2xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-white font-bold',
    headerSubtitle: 'text-slate-400',
    socialButtonsBlockButtonText: 'text-slate-300 font-medium',
    formFieldLabel: 'text-slate-300 text-sm',
    footerActionLink: 'text-amber-400 hover:text-amber-300',
    footerActionText: 'text-slate-500',
    dividerText: 'text-slate-600',
    identityPreviewEditButton: 'text-amber-400',
    formFieldSuccessText: 'text-emerald-400',
    alertText: 'text-slate-200',
    logoBox: 'mb-2',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200',
    formButtonPrimary: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold',
    formFieldInput: 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600',
    footerAction: 'bg-slate-900/50',
    dividerLine: 'bg-slate-800',
    alert: 'bg-rose-500/10 border-rose-500/30',
    otpCodeFieldInput: 'bg-slate-800 border-slate-700 text-white',
    formFieldRow: '',
    main: '',
  },
};

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

/** After sign-in: promote first user to admin if no admin exists yet */
function EnsureFirstAdmin() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useClerk();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch(`${basePath}/api/admin/ensure-first-admin`, {
      method: 'POST', credentials: 'include',
    })
      .then(r => r.json())
      .then((data) => {
        if (data.promoted) {
          // Reload Clerk session so publicMetadata.role is fresh
          user?.reload();
        }
      })
      .catch(() => {/* silent */});
  }, [isLoaded, isSignedIn, user]);

  return null;
}

/** Guard: shows loading → redirects to sign-in if not authenticated */
function ProtectedLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/customers" component={Customers} />
        <Route path="/customers/:id" component={CustomerDetail} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/reminders" component={Reminders} />
        <Route path="/calculator" component={Calculator} />
        <Route path="/reports" component={Reports} />
        <Route path="/users" component={Users} />
        <Route path="/settings" component={Settings} />
        <Route path="/staff" component={StaffPage} />
        <Route path="/service-categories" component={ServiceCategoriesPage} />
        <Route path="/kyc-review" component={KycReviewPage} />
        <Route path="/sandbox" component={SandboxPage} />
        <Route path="/technicians" component={TechniciansPage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <EnsureFirstAdmin />
        <TooltipProvider>
          <Switch>
            {/* Auth pages — public */}
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            {/* Public customer booking form — primary branded route */}
            <Route path="/book/:techCode" component={CustomerFormPage} />
            {/* Legacy alias — keep working for old links */}
            <Route path="/customer-form/:token" component={CustomerFormPage} />
            {/* Everything else — protected */}
            <Route component={ProtectedLayout} />
          </Switch>
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TestImpersonationProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </TestImpersonationProvider>
  );
}

export default App;
