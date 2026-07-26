import React from 'react';
import { useGetDashboardSummary, useListRecentJobs } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Wrench, IndianRupee, Bell, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: recentJobs, isLoading: jobsLoading } = useListRecentJobs({ limit: 5 });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'कुल ग्राहक',
      subtitle: 'Total Customers',
      value: summary?.totalCustomers || 0,
      icon: Users,
      color: 'text-blue-500',
      href: '/customers'
    },
    {
      title: 'लंबित कार्य',
      subtitle: 'Pending Jobs',
      value: summary?.pendingJobs || 0,
      icon: Wrench,
      color: 'text-amber-500',
      href: '/jobs?status=pending'
    },
    {
      title: 'कुल आय',
      subtitle: 'Total Revenue',
      value: `₹${summary?.totalRevenue?.toLocaleString('en-IN') || 0}`,
      icon: IndianRupee,
      color: 'text-emerald-500',
      href: '/reports'
    },
    {
      title: 'अतिदेय भुगतान',
      subtitle: 'Overdue Payments',
      value: summary?.overduePayments || 0,
      icon: AlertTriangle,
      color: 'text-rose-500',
      href: '/jobs?paymentStatus=unpaid'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">डैशबोर्ड <span className="text-xl font-normal text-muted-foreground ml-2">Dashboard</span></h1>
        <p className="text-muted-foreground mt-1">आपकी कार्यशाला का अवलोकन (Workshop Overview)</p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>नवीनतम कार्य <span className="text-sm font-normal text-muted-foreground ml-2">Recent Jobs</span></span>
                <Link href="/jobs" className="text-sm text-primary hover:underline">सभी देखें (View All)</Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {recentJobs?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">कोई नवीनतम कार्य नहीं (No recent jobs)</div>
                  ) : (
                    recentJobs?.map(job => (
                      <Link key={job.id} href={`/jobs/${job.id}`}>
                        <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              #{job.id}
                            </div>
                            <div>
                              <p className="font-semibold group-hover:text-primary transition-colors">{job.customerName}</p>
                              <p className="text-sm text-muted-foreground">{job.applianceType} - {job.description}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                              {job.status === 'pending' ? 'लंबित (Pending)' : 
                               job.status === 'in_progress' ? 'प्रगति पर (In Progress)' : 
                               job.status === 'completed' ? 'पूरा हुआ (Completed)' : 'रद्द (Cancelled)'}
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
                <span>आज के रिमाइंडर <span className="text-sm font-normal text-muted-foreground ml-2">Today's Reminders</span></span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-foreground">{summary?.todayReminders || 0} रिमाइंडर</p>
                <p className="text-sm text-muted-foreground mb-6">आज के लिए अनुसूचित (Scheduled for today)</p>
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
