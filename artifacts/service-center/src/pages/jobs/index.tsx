import React, { useState } from 'react';
import { useListJobs, useCreateJob } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Plus, Search, Calendar, Wrench, CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Jobs() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data: jobs, isLoading } = useListJobs({ 
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined
  });

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'pending': return { label: 'Pending', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' };
      case 'in_progress': return { label: 'In Progress', icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' };
      case 'completed': return { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' };
      case 'cancelled': return { label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' };
      default: return { label: status, icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 border-gray-200' };
    }
  };

  const getPaymentConfig = (status: string) => {
    switch(status) {
      case 'paid': return { label: 'Paid', color: 'bg-emerald-500 text-white border-emerald-600' };
      case 'partial': return { label: 'Partial', color: 'bg-amber-500 text-white border-amber-600' };
      case 'unpaid': return { label: 'Unpaid', color: 'bg-rose-500 text-white border-rose-600' };
      default: return { label: status, color: 'bg-gray-500 text-white border-gray-600' };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Jobs </h1>
          <p className="text-muted-foreground mt-1">Manage all service jobs</p>
        </div>
        
        {/* We would typically have a Create Job button here, but it usually requires selecting a customer first, so we might omit it or link to a dedicated form */}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search job or customer..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="grid grid-cols-5 mb-6 w-full max-w-2xl">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Done</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="m-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {jobs?.map((job) => {
                const status = getStatusConfig(job.status);
                const payment = getPaymentConfig(job.paymentStatus);
                const date = job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString('hi-IN') : 'No date';

                return (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className={`hover-elevate cursor-pointer transition-all border-l-4 group ${status.bg.replace('bg-', 'hover:bg-').split(' ')[0]} ${status.bg.split(' ')[1]}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:flex flex-col items-center justify-center w-16 h-16 rounded bg-card border shadow-sm">
                            <span className="text-xs text-muted-foreground font-semibold uppercase">Job</span>
                            <span className="font-mono font-bold text-primary">#{job.jobNumber || job.id}</span>
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{job.customerName || 'Unknown Customer'}</h3>
                              {job.isHighlighted && (
                                <span className="flex w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Highlighted"></span>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><Wrench className="w-3 h-3" /> {job.applianceType || 'Unknown Appliance'}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {date}</span>
                              {job.technicianName && (
                                <span className="flex items-center gap-1 text-primary/80 font-medium">@ {job.technicianName}</span>
                              )}
                            </div>
                            <p className="text-sm mt-2 text-foreground/80 line-clamp-1">{job.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.color} bg-background border shadow-sm`}>
                            <status.icon className="w-3.5 h-3.5" />
                            {status.label}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono font-bold text-sm">₹{job.amount || 0}</span>
                            <span className={`w-3 h-3 rounded-full ${payment.color}`} title={payment.label} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
              
              {jobs?.length === 0 && (
                <div className="text-center py-12 bg-card rounded-lg border border-dashed">
                  <Wrench className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <h3 className="text-lg font-medium text-foreground">No jobs found</h3>
                  <p className="text-muted-foreground text-sm">No jobs found for the selected filters</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
