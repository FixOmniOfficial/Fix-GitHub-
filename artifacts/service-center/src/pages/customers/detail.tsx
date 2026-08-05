import React, { useState, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import {
  useGetCustomer,
  useGetCustomerHistory,
  useGetCustomerWhatsappForm,
  useUpdateCustomer,
  useDeleteCustomer,
  useCreateJob,
  getGetCustomerQueryKey,
  getGetCustomerHistoryQueryKey,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Edit, Trash2, MessageCircle, Phone, MapPin, Calendar,
  Wrench, FileText, Plus, Home, Layers, Navigation, IndianRupee, X, Check,
  ShieldAlert, Share2, Copy, ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';

/* ─── Schemas ────────────────────────────────────────────────────────────── */

const customerSchema = z.object({
  name: z.string().min(1, 'नाम आवश्यक है'),
  phone: z.string().min(10, 'फ़ोन नंबर आवश्यक है'),
  whatsappPhone: z.string().optional(),
  houseNumber: z.string().optional(),
  floorNumber: z.string().optional(),
  address: z.string().optional(),
  location: z.string().optional(),
  visitingAmount: z.string().optional(),
  notes: z.string().optional(),
});

const jobSchema = z.object({
  description: z.string().optional(),
  applianceType: z.string().optional(),
  technicianName: z.string().optional(),
  amount: z.string().optional(),
  scheduledDate: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

/* ─── Info field row ─────────────────────────────────────────────────────── */

function InfoRow({
  icon: Icon,
  label,
  value,
  placeholder = '—',
}: {
  icon: React.ElementType;
  label: string;
  value?: string | number | null;
  placeholder?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm font-medium ${!value ? 'text-muted-foreground/50 italic' : ''}`}>
          {value ?? placeholder}
        </p>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function CustomerDetail() {
  const [, params] = useRoute('/customers/:id');
  const id = parseInt(params?.id || '0');
  const [, navigate] = useLocation();
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewJobOpen, setIsNewJobOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const { data: customer, isLoading: isCustomerLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) },
  });
  const { data: history, isLoading: isHistoryLoading } = useGetCustomerHistory(id, {
    query: { enabled: !!id, queryKey: getGetCustomerHistoryQueryKey(id) },
  });
  const { data: waForm } = useGetCustomerWhatsappForm(id, {
    query: { enabled: !!id, queryKey: ['whatsapp-form', id] },
  });

  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const createJob = useCreateJob();

  /* Customer edit form */
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '', phone: '', whatsappPhone: '',
      houseNumber: '', floorNumber: '',
      address: '', location: '',
      visitingAmount: '', notes: '',
    },
  });

  useEffect(() => {
    if (isEditOpen && customer) {
      form.reset({
        name: customer.name,
        phone: customer.phone,
        whatsappPhone: customer.whatsappPhone || '',
        houseNumber: (customer as any).houseNumber || '',
        floorNumber: (customer as any).floorNumber || '',
        address: customer.address || '',
        location: (customer as any).location || '',
        visitingAmount: (customer as any).visitingAmount != null
          ? String((customer as any).visitingAmount)
          : '',
        notes: customer.notes || '',
      });
    }
  }, [isEditOpen, customer]);

  const onUpdate = (data: CustomerFormData) => {
    updateCustomer.mutate({
      id,
      data: {
        ...data,
        visitingAmount: data.visitingAmount ? parseFloat(data.visitingAmount) : undefined,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCustomerHistoryQueryKey(id) });
        setIsEditOpen(false);
        toast.success('ग्राहक विवरण सुरक्षित हो गया ✓');
      },
      onError: () => toast.error('सुरक्षित नहीं हो सका'),
    });
  };

  const onDelete = () => {
    deleteCustomer.mutate({ id }, {
      onSuccess: () => { toast.success('ग्राहक हटा दिया गया'); navigate('/customers'); },
      onError: () => toast.error('हटाने में विफल'),
    });
  };

  /* New job form */
  const jobForm = useForm<z.infer<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    defaultValues: { description: '', applianceType: '', technicianName: '', amount: '', scheduledDate: '' },
  });

  const onNewJob = (data: z.infer<typeof jobSchema>) => {
    createJob.mutate({
      data: {
        customerId: id,
        description: data.description || undefined,
        applianceType: data.applianceType || undefined,
        technicianName: data.technicianName || undefined,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        scheduledDate: data.scheduledDate || undefined,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerHistoryQueryKey(id) });
        setIsNewJobOpen(false);
        jobForm.reset();
        toast.success('नया कार्य जोड़ा गया ✓');
      },
      onError: () => toast.error('कार्य जोड़ने में विफल'),
    });
  };

  const handleWhatsApp = () => {
    if (!waForm?.whatsappLink) {
      toast.error('WhatsApp लिंक उपलब्ध नहीं है');
      return;
    }
    window.open(waForm.whatsappLink, '_blank');
  };

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const r = await fetch(`${BASE}/api/customers/${id}/generate-share-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await r.json();
      if (!r.ok) { toast.error('लिंक नहीं बना'); return; }
      const url = `${window.location.origin}${BASE}/customer-form/${json.token}`;
      setShareUrl(url);
      setIsShareOpen(true);
    } catch {
      toast.error('कनेक्शन में समस्या');
    } finally {
      setShareLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const shareOnWhatsApp = () => {
    const phone = customer ? (customer.whatsappPhone ?? customer.phone) : '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const msg = `नमस्ते! कृपया नीचे दिए लिंक पर अपनी जानकारी भरें:\n${shareUrl}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  /* ── Loading / not found ── */
  if (isCustomerLoading || isHistoryLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer || !history) {
    return <div className="text-center py-12">ग्राहक नहीं मिला</div>;
  }

  const c = customer as any; // cast to access new fields until types propagate

  /* ── Render ── */
  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-full shrink-0">
            <Link href="/customers"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <Avatar className="h-12 w-12 border-2 border-primary/20 shrink-0">
            <AvatarImage src={customer.dpUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
              {customer.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight leading-tight">{customer.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">ID: #{customer.serialNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handleShare}
            disabled={shareLoading}
          >
            {shareLoading
              ? <><span className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" />लोड…</>
              : <><Share2 className="w-4 h-4 mr-2" />फ़ॉर्म भेजें</>
            }
          </Button>
          <Button
            className="bg-[#25D366] hover:bg-[#128C7E] text-white"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon"><Trash2 className="w-4 h-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>"{customer.name}" को हटाएं?</AlertDialogTitle>
                <AlertDialogDescription>
                  यह ग्राहक और उनसे जुड़ा सारा डेटा हमेशा के लिए हट जाएगा।
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>रद्द करें</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  हां, हटाएं
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Body grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* LEFT COLUMN */}
        <div className="md:col-span-1 space-y-4">

          {/* ── Customer Details Card ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">ग्राहक विवरण</CardTitle>
                  <CardDescription className="text-xs">Customer Details</CardDescription>
                </div>
                {isAdmin ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setIsEditOpen(true)}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Admin only
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow icon={Phone}        label="नाम (Name)"              value={customer.name} />
              <InfoRow icon={Phone}        label="मोबाइल नंबर (Mobile)"    value={customer.phone} />
              <InfoRow icon={Home}         label="हाउस नंबर (House No.)"   value={c.houseNumber} />
              <InfoRow icon={Layers}       label="फ्लोर नंबर (Floor No.)"  value={c.floorNumber} />
              <InfoRow icon={MapPin}       label="पूरा पता (Address)"       value={customer.address} />
              <InfoRow icon={Navigation}   label="लोकेशन (Location)"       value={c.location} />
              <InfoRow
                icon={IndianRupee}
                label="विजिटिंग अमाउंट (Visiting)"
                value={c.visitingAmount != null ? `₹${c.visitingAmount}` : null}
              />
            </CardContent>
          </Card>

          {/* ── Payment Summary ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">भुगतान सारांश</CardTitle>
              <CardDescription className="text-xs">Payment Summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-sm font-medium text-emerald-800">कुल भुगतान (Paid)</span>
                <span className="font-bold text-emerald-700">₹{history.totalPaid}</span>
              </div>
              <div className={`flex justify-between items-center p-3 rounded-lg border ${
                history.totalDue > 0 ? 'bg-rose-50 border-rose-100' : 'bg-muted/50 border-border'
              }`}>
                <span className={`text-sm font-medium ${history.totalDue > 0 ? 'text-rose-800' : 'text-muted-foreground'}`}>
                  कुल बकाया (Due)
                </span>
                <span className={`font-bold ${history.totalDue > 0 ? 'text-rose-700' : 'text-foreground'}`}>
                  ₹{history.totalDue}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN — Tabs */}
        <div className="md:col-span-2">
          <Tabs defaultValue="jobs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="jobs">कार्य इतिहास</TabsTrigger>
              <TabsTrigger value="appliances">उपकरण</TabsTrigger>
            </TabsList>

            {/* Job history */}
            <TabsContent value="jobs" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setIsNewJobOpen(true)}>
                  <Plus className="w-3 h-3 mr-2" />
                  नया कार्य जोड़ें
                </Button>
              </div>

              {history.jobs.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-medium">कोई कार्य इतिहास नहीं</p>
                    <p className="text-sm text-muted-foreground">No job history found</p>
                  </CardContent>
                </Card>
              ) : (
                history.jobs.map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="hover-elevate cursor-pointer transition-all group">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary group-hover:underline">
                              #{job.jobNumber || job.id}
                            </span>
                            <Badge variant={job.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                              {job.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{job.applianceType}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{job.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold">₹{job.amount || 0}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            job.paymentStatus === 'paid'    ? 'bg-emerald-100 text-emerald-700' :
                            job.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-700'    :
                            'bg-rose-100 text-rose-700'
                          }`}>{job.paymentStatus}</span>
                          {job.scheduledDate && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(job.scheduledDate).toLocaleDateString('hi-IN')}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </TabsContent>

            {/* Appliances */}
            <TabsContent value="appliances" className="mt-4 space-y-4">
              {history.appliances.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Wrench className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-medium">कोई उपकरण पंजीकृत नहीं</p>
                    <p className="text-sm text-muted-foreground">No appliances registered</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {history.appliances.map(app => (
                    <Card key={app.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold">{app.type}</h4>
                          <Wrench className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1 text-sm">
                          {app.brand   && <p><span className="text-muted-foreground">ब्रांड:</span> {app.brand}</p>}
                          {app.model   && <p><span className="text-muted-foreground">मॉडल:</span> {app.model}</p>}
                          {app.serialNo && <p><span className="text-muted-foreground">सीरियल:</span> <span className="font-mono">{app.serialNo}</span></p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>

    {/* ── EDIT CUSTOMER DIALOG (admin only) ─────────────────────────────── */}
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ग्राहक विवरण संपादित करें</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-4">

            {/* Name + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>नाम (Name) *</FormLabel>
                    <FormControl><Input placeholder="राहुल कुमार" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>मोबाइल नंबर *</FormLabel>
                    <FormControl><Input placeholder="9876543210" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* WhatsApp */}
            <FormField control={form.control} name="whatsappPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp नंबर</FormLabel>
                  <FormControl><Input placeholder="Same as mobile if blank" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* House + Floor */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="houseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>हाउस नंबर</FormLabel>
                    <FormControl><Input placeholder="A-201" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="floorNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>फ्लोर नंबर</FormLabel>
                    <FormControl><Input placeholder="2nd Floor" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <FormField control={form.control} name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>पूरा पता (Full Address)</FormLabel>
                  <FormControl><Textarea placeholder="सेक्टर 12, नोएडा..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location + Visiting Amount */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>लोकेशन (Location)</FormLabel>
                    <FormControl><Input placeholder="नोएडा सेक्टर 62" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="visitingAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>विजिटिंग अमाउंट ₹</FormLabel>
                    <FormControl><Input type="number" placeholder="200" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField control={form.control} name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>नोट्स (Notes)</FormLabel>
                  <FormControl><Textarea placeholder="कोई अतिरिक्त जानकारी..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)}>
                रद्द करें
              </Button>
              <Button type="submit" className="flex-1" disabled={updateCustomer.isPending}>
                {updateCustomer.isPending ? 'सुरक्षित हो रहा है...' : 'सुरक्षित करें ✓'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* ── SHARE FORM LINK DIALOG ─────────────────────────────────────────── */}
    <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" /> फ़ॉर्म लिंक शेयर करें
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            नीचे का लिंक <span className="font-semibold text-foreground">{customer?.name}</span> को भेजें।
            वो इस फ़ॉर्म को भरकर अपनी जानकारी अपडेट कर सकते हैं।
          </p>

          {/* Link preview */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border text-xs font-mono break-all">
            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground flex-1 truncate">{shareUrl}</span>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={copyLink} className="gap-2">
              {shareCopied
                ? <><Check className="w-4 h-4 text-emerald-500" />कॉपी हुआ!</>
                : <><Copy className="w-4 h-4" />लिंक कॉपी करें</>
              }
            </Button>
            <Button
              className="bg-[#25D366] hover:bg-[#128C7E] text-white gap-2"
              onClick={shareOnWhatsApp}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp पर भेजें
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── NEW JOB DIALOG ─────────────────────────────────────────────────── */}
    <Dialog open={isNewJobOpen} onOpenChange={setIsNewJobOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            नया कार्य — <span className="text-primary">{customer.name}</span>
          </DialogTitle>
        </DialogHeader>
        <Form {...jobForm}>
          <form onSubmit={jobForm.handleSubmit(onNewJob)} className="space-y-4">
            <FormField control={jobForm.control} name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>समस्या / विवरण (Problem)</FormLabel>
                  <FormControl><Textarea placeholder="जैसे: AC cooling नहीं कर रहा" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={jobForm.control} name="applianceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>उपकरण (Appliance)</FormLabel>
                    <FormControl><Input placeholder="AC, Fridge…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={jobForm.control} name="technicianName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>तकनीशियन</FormLabel>
                    <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={jobForm.control} name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>राशि ₹ (Amount)</FormLabel>
                    <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={jobForm.control} name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>तारीख (Date)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsNewJobOpen(false)}>
                रद्द करें
              </Button>
              <Button type="submit" className="flex-1" disabled={createJob.isPending}>
                {createJob.isPending ? 'जोड़ रहा है…' : 'कार्य जोड़ें ✓'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
