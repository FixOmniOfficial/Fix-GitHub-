import React, { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { 
  useGetJob, 
  useUpdateJob, 
  useUpdateJobPayment,
  useListHighlights,
  useCreateHighlight,
  useUpdateHighlight,
  useDeleteHighlight,
  useGetSettings
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, Edit, MessageCircle, Wrench, Calendar, Clock, User, 
  CheckCircle2, AlertTriangle, Plus, Trash2, Maximize, Minus, PlusCircle
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetJobQueryKey, getListHighlightsQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';

export default function JobDetail() {
  const [, params] = useRoute('/jobs/:id');
  const id = parseInt(params?.id || '0');
  
  const queryClient = useQueryClient();
  const { data: settings } = useGetSettings();

  const { data: job, isLoading: isJobLoading } = useGetJob(id, { query: { enabled: !!id, queryKey: getGetJobQueryKey(id) } });
  const { data: highlights, isLoading: isHighlightsLoading } = useListHighlights({ jobId: id }, { query: { enabled: !!id, queryKey: getListHighlightsQueryKey({ jobId: id }) } });
  
  const updatePayment = useUpdateJobPayment();
  const createHighlight = useCreateHighlight();
  const updateHighlight = useUpdateHighlight();
  const deleteHighlight = useDeleteHighlight();

  const [newHighlightLabel, setNewHighlightLabel] = useState('');
  
  const handlePaymentToggle = () => {
    if (!job) return;
    const current = job.paymentStatus;
    const next = current === 'unpaid' ? 'partial' : current === 'partial' ? 'paid' : 'unpaid';
    
    updatePayment.mutate({ data: { paymentStatus: next, jobId: id } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) });
        toast.success(`Payment status updated: ${next}`);
      }
    });
  };

  const handleAddHighlight = () => {
    if (!newHighlightLabel.trim()) return;
    createHighlight.mutate({ 
      data: { 
        jobId: id, 
        label: newHighlightLabel, 
        color: 'blue', 
        isNumbered: true,
        captionSize: 1,
        isTicked: false
      } 
    }, {
      onSuccess: () => {
        setNewHighlightLabel('');
        queryClient.invalidateQueries({ queryKey: getListHighlightsQueryKey({ jobId: id }) });
      }
    });
  };

  const handleToggleTick = (highlightId: number, currentTicked: boolean) => {
    updateHighlight.mutate({ 
      id: highlightId, 
      data: { isTicked: !currentTicked } 
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListHighlightsQueryKey({ jobId: id }) })
    });
  };

  const handleDeleteHighlight = (highlightId: number) => {
    deleteHighlight.mutate({ id: highlightId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListHighlightsQueryKey({ jobId: id }) })
    });
  };

  const handleZoomChange = (highlightId: number, value: number[]) => {
    updateHighlight.mutate({ 
      id: highlightId, 
      data: { captionSize: value[0] } 
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListHighlightsQueryKey({ jobId: id }) })
    });
  };

  if (isJobLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) return <div className="text-center py-12">Job not found</div>;

  const paymentColors = {
    unpaid: 'bg-rose-500 hover:bg-rose-600',
    partial: 'bg-amber-500 hover:bg-amber-600',
    paid: 'bg-emerald-500 hover:bg-emerald-600'
  };

  const paymentLabels = {
    unpaid: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/jobs"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">#{job.jobNumber || job.id}</h1>
              <Badge variant={job.status === 'completed' ? 'default' : 'secondary'} className="text-sm">
                {job.status === 'pending' ? 'Pending' : 
                 job.status === 'in_progress' ? 'In Progress' : 
                 job.status === 'completed' ? 'Completed' : 'Cancelled'}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-lg">
              <Link href={`/customers/${job.customerId}`} className="hover:text-primary hover:underline transition-colors font-semibold">
                {job.customerName}
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button 
            className={`font-bold transition-colors w-full md:w-auto shadow-md text-white ${paymentColors[job.paymentStatus]}`}
            onClick={handlePaymentToggle}
            disabled={updatePayment.isPending}
          >
            {paymentLabels[job.paymentStatus]}
            <span className="ml-2 font-mono bg-white/20 px-2 py-0.5 rounded text-xs">₹{job.amount || 0}</span>
          </Button>
          
          <Button 
            variant="outline"
            className="bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/30 hover:bg-[#25D366]/20" 
            onClick={() => window.open(`https://wa.me/${job.customerPhone?.replace(/\D/g, '')}`, '_blank')}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-primary/5 p-4 border-b">
              <h2 className="font-semibold text-primary flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Job Details
              </h2>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Appliance</p>
                    <p className="font-medium text-lg">{job.applianceType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="font-medium">{job.description || 'No description provided'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Date</p>
                    <div className="flex items-center gap-2 font-medium">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString('hi-IN', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      }) : 'Not scheduled'}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Technician</p>
                    <div className="flex items-center gap-2 font-medium">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {job.technicianName || 'Unassigned'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-amber-500 shadow-md">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  Highlights & Checkmarks
                </CardTitle>
                <CardDescription>Highlights & Tick Marks</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Input 
                  placeholder="Add new highlight..." 
                  value={newHighlightLabel}
                  onChange={e => setNewHighlightLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddHighlight()}
                  className="bg-background"
                />
                <Button onClick={handleAddHighlight} disabled={!newHighlightLabel.trim()}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Add
                </Button>
              </div>

              <div className="space-y-4">
                {isHighlightsLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : highlights?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    No highlights added
                  </div>
                ) : (
                  highlights?.map((hl, index) => (
                    <div 
                      key={hl.id} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all ${
                        hl.isTicked ? 'bg-emerald-50/50 border-emerald-200' : 'bg-card border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <button 
                          onClick={() => handleToggleTick(hl.id, hl.isTicked || false)}
                          className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                            hl.isTicked 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-muted-foreground/30 hover:border-emerald-500 hover:text-emerald-500 bg-background text-transparent'
                          }`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        
                        {hl.isNumbered && (
                          <span className="font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded text-sm shrink-0">
                            {index + 1}.
                          </span>
                        )}
                        
                        <span 
                          className={`font-medium transition-all break-words ${hl.isTicked ? 'text-emerald-700 line-through opacity-70' : 'text-foreground'}`}
                          style={{ fontSize: `${hl.captionSize || 1}em` }}
                        >
                          {hl.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 pl-11 sm:pl-0">
                        <div className="flex items-center gap-2 w-32">
                          <Minus className="w-3 h-3 text-muted-foreground" />
                          <Slider 
                            defaultValue={[hl.captionSize || 1]} 
                            max={2} 
                            min={0.5} 
                            step={0.1}
                            onValueCommit={(val) => handleZoomChange(hl.id, val)}
                            className="flex-1"
                          />
                          <Maximize className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                          onClick={() => handleDeleteHighlight(hl.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-muted/20 border-b pb-3">
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">₹{job.amount || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-bold text-emerald-600">₹{job.paidAmount || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base">
                  <span className="font-semibold text-foreground">Balance</span>
                  <span className={`font-bold ${((job.amount||0) - (job.paidAmount||0)) > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                    ₹{Math.max(0, (job.amount||0) - (job.paidAmount||0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-muted/20 border-b pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-2">
              <Button variant="outline" className="justify-start">
                <Edit className="w-4 h-4 mr-2" /> Edit Job Details
              </Button>
              <Button variant="outline" className="justify-start">
                <Clock className="w-4 h-4 mr-2" /> Set Reminder
              </Button>
              <Button variant="outline" className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Job
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
