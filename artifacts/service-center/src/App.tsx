import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppShell } from '@/components/layout/app-shell';
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

const queryClient = new QueryClient();

function Router() {
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
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
