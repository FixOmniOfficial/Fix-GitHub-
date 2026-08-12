import React, { useCallback, useState } from 'react';
import { useGetDashboardSummary, useListRecentJobs } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, Wrench, IndianRupee, Bell, AlertTriangle,
  UserCog, Layers, CalendarCheck, Star, RefreshCw,
} from 'lucide-react';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/lib/use-role';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

interface Analytics {
  totalCustomers: number;
  totalTechnicians: number;
  totalStaff: number;
  totalBookings: number;
  ratingsCount: number;
  avgRating: string;
  activeCategories: number;
}

async function fetchAnalytics(): Promise<Analytics> {
  const r = await fetch(`${BASE}/api/admin/analytics`, { credentials: 'include' });
  if (!r.ok) throw new Error('Failed to fetch analytics');
  return r.json();
}

export default function Dashboard() {
  const { isAdmin } = useRole();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: recentJobs, isLoading: jobsLoading } = useListRecentJobs({ limit: 5 });
  const [analyticsKey, setAnalyticsKey] = useState(0);

  const { data: analytics, isLoading: analyticsLoading, isFetching } = useQuery({
    queryKey: ['admin-analytics', analyticsKey],
    queryFn: fetchAnalytics,
    enabled: isAdmin,
    staleTime: 30000,
  });

  const refresh = useCallback(() => setAnalyticsKey(k => k + 1), []);

  const statCards = [
    {
      title: 'कुल ग्राहक',
      subtitle: 'Total Customers',
      value: summary?.totalCustomers || 0,
      icon: Users,
      color: 'text-blue-500',
      href: '/customers',
    },
    {
      title: 'लंबित कार्य',
      subtitle: 'Pending Jobs',
      value: summary?.pendingJobs || 0,
      icon: Wrench,
      color: 'text-amber-500',
      href: '/jobs?status=pending',
    },
    {
      title: 'कुल आय',
      subtitle: 'Total Revenue',
      value: `₹${summary?.totalRevenue?.toLocaleString('en-IN') || 0}`,
      icon: IndianRupee,
      color: 'text-emerald-500',
      href: '/reports',
    },
    {
      title: 'अतिदेय भुगतान',
      subtitle: 'Overdue Payments',
      value: summary?.overduePayments || 0,
      icon: AlertTriangle,
      color: 'text-rose-500',
      href: '/jobs?paymentStatus=unpaid',
    },
  ];

  const analyticsCards = [
    {
      label: 'Customers',
      labelHi: 'कुल ग्राहक',
      value: analytics?.totalCustomers ?? 0,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Technicians',
      labelHi: 'तकनीशियन',
      value: analytics?.totalTechnicians ?? 0,
      icon: Wrench,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Staff',
      labelHi: 'स्टाफ सदस्य',
      value: analytics?.totalStaff ?? 0,
      icon: UserCog,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      label: 'Bookings',
      labelHi: 'कुल बुकिंग',
      value: analytics?.totalBookings ?? 0,
      icon: CalendarCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Avg Rating',
      labelHi: 'औसत रेटिंग',
      value: analytics?.avgRating ?? '—',
      icon: Star,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      suffix: analytics?.ratingsCount ? ` (${analytics.ratingsCount} reviews)` : '',
    },
    {
      label: 'Active Categories',
      labelHi: 'सक्रिय कैटेगरी',
      value: analytics?.activeCategories ?? 0,
      icon: Layers,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          डैशबोर्ड{' '}
          <span className="text-xl font-normal text-muted-foreground ml-2">Dashboard</span>
        </h1>
        <p className="text-muted-foreground mt-1">आपकी कार्यशाला का अवलोकन (Workshop Overview)</p>
      </div>

      {/* ── Analytics Section (admin only) ───────────────────────────────── */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-200">
                Platform Analytics
                <span className="ml-2 text-xs font-normal text-slate-500">रियल-टाइम आँकड़े</span>
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isFetching}
              className="text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 h-7 px-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="ml-1.5 text-xs">Refresh</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {analyticsLoading
              ? [1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-24 rounded-xl bg-slate-800" />
                ))
              : analyticsCards.map((card) => (
                  <Card
                    key={card.label}
                    className={`${card.bg} border ${card.border} transition-all`}
                  >
                    <CardContent className="p-3">
                      <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                        <card.icon className={`w-4 h-4 ${card.color}`} />
                      </div>
                      <div className={`text-2xl font-bold ${card.color}`}>
                        {card.value}
                        {'suffix' in card && card.suffix && (
                          <span className="text-xs font-normal text-slate-500 ml-1">{card.suffix}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-medium mt-0.5">{card.label}</div>
                      <div className="text-[10px] text-slate-600">{card.labelHi}</div>
                    </CardContent>
                  </Card>
                ))}
          </div>

          {/* Quick Links */}
          <div className="flex gap-2 flex-wrap">
            <Link href="/staff">
              <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 text-slate-400 hover:text-violet-400 hover:border-violet-500/50 hover:bg-violet-500/5">
                <UserCog className="w-3 h-3 mr-1" /> Staff Manage करें
              </Button>
            </Link>
            <Link href="/service-categories">
              <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/5">
                <Layers className="w-3 h-3 mr-1" /> Categories
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Workshop Stats ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, i) => (
            <Link key={i} href={stat.href}>
              <Card className="hover-elevate cursor-pointer transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold">{stat.title}</CardTitle>
                    <CardDescription className="text-xs">{stat.subtitle}</CardDescription>
                  </div>
                  <div className={`p-3 rounded-full bg-muted/50 ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* ── Recent Jobs + Reminders ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>
                  नवीनतम कार्य{' '}
                  <span className="text-sm font-normal text-muted-foreground ml-2">Recent Jobs</span>
                </span>
                <Link href="/jobs" className="text-sm text-primary hover:underline">
                  सभी देखें (View All)
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {recentJobs?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      कोई नवीनतम कार्य नहीं (No recent jobs)
                    </div>
                  ) : (
                    recentJobs?.map(job => (
                      <Link key={job.id} href={`/jobs/${job.id}`}>
                        <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              #{job.id}
                            </div>
                            <div>
                              <p className="font-semibold group-hover:text-primary transition-colors">
                                {job.customerName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {job.applianceType} - {job.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge
                              variant={job.status === 'completed' ? 'default' : 'secondary'}
                            >
                              {job.status === 'pending'
                                ? 'लंबित (Pending)'
                                : job.status === 'in_progress'
                                ? 'प्रगति पर (In Progress)'
                                : job.status === 'completed'
                                ? 'पूरा हुआ (Completed)'
                                : 'रद्द (Cancelled)'}
                            </Badge>
                            <span className="text-xs font-medium">₹{job.amount || 0}</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <span>
                  आज के रिमाइंडर{' '}
                  <span className="text-sm font-normal text-muted-foreground ml-2">Today's</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-foreground">
                  {summary?.todayReminders || 0} रिमाइंडर
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  आज के लिए अनुसूचित (Scheduled for today)
                </p>
                <Link href="/reminders" className="text-primary text-sm hover:underline font-medium">
                  रिमाइंडर प्रबंधित करें (Manage Reminders)
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
