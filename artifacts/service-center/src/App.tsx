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
import SuperAdminPage from '@/pages/super-admin';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';
import CustomerFormPage from '@/pages/customer-form';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  );
}

/** Clears React-Query cache when the authenticated user changes */
function QueryCacheInvalidator() {
  const { meUser } = useAuthContext();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = meUser?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      qc.clear();
    }
    prevUserIdRef.current = userId;
  }, [meUser?.id, qc]);

  return null;
}

/** Guard: shows loading → redirects to sign-in if not authenticated */
function ProtectedLayout() {
  const { isLoaded, isSignedIn } = useAuthContext();

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
        <Route path="/super-admin" component={SuperAdminPage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function AppRoutes() {
  const [, setLocation] = useLocation();

  // Suppress unused variable — setLocation kept in case we need imperative nav
  void setLocation;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <QueryCacheInvalidator />
        <TooltipProvider>
          <Switch>
            {/* Auth pages — public */}
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            {/* Public customer booking form */}
            <Route path="/book/:techCode" component={CustomerFormPage} />
            {/* Everything else — protected */}
            <Route component={ProtectedLayout} />
          </Switch>
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <TestImpersonationProvider>
      <WouterRouter base={basePath}>
        <AppRoutes />
      </WouterRouter>
    </TestImpersonationProvider>
  );
}

export default App;
