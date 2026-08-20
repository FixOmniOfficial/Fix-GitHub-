import React, { useState, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import {
  useGetCustomer,
  useGetCustomerHistory,
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
  ShieldAlert,
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
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRole } from '@/lib/use-role';

/* ─── Schemas ────────────────────────────────────────────────────────────── */

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone number is required'),
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

  const { data: customer, isLoading: isCustomerLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) },
  });
  const { data: history, isLoading: isHistoryLoading } = useGetCustomerHistory(id, {
    query: { enabled: !!id, queryKey: getGetCustomerHistoryQueryKey(id) },
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
        phone: (customer.phone || '').replace(/\D/g, '').slice(-10),
        whatsappPhone: (customer.whatsappPhone || '').replace(/\D/g, '').slice(-10),
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
    const customerUpdate = {
      ...data,
      visitingAmount: data.visitingAmount ? parseFloat(data.visitingAmount) : undefined,
    };

    updateCustomer.mutate({
      id,
      data: customerUpdate,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCustomerHistoryQueryKey(id) });
        setIsEditOpen(false);
        toast.success('Customer details saved ✓');
      },
      onError: () => toast.error('Could not save'),
    });
  };

  const onDelete = () => {
    deleteCustomer.mutate({ id }, {
      onSuccess: () => { toast.success('Customer deleted'); navigate('/customers'); },
      onError: () => toast.error('Delete failed'),
    });
  };

  /* New job form */
  const jobForm = useForm<z.infer<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    defaultValues: { description: '', applianceType: '', technicianName: '', amount: '', scheduledDate: '' },
  });

  const onNewJob = (data: z.infer<typeof jobSchema>) => {
    const jobInput = {
      customerId: id,
      description: data.description || undefined,
      applianceType: data.applianceType || undefined,
      technicianName: data.technicianName || undefined,
      amount: data.amount ? parseFloat(data.amount) : undefined,
      scheduledDate: data.scheduledDate || undefined,
    };

    createJob.mutate({
      data: jobInput,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerHistoryQueryKey(id) });
        setIsNewJobOpen(false);
        jobForm.reset();
        toast.success('New job added ✓');
      },
      onError: () => toast.error('Failed to add job'),
    });
  };

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

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
    return <div className="text-center py-12">Customer not found</div>;
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon"><Trash2 className="w-4 h-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>"Delete {customer.name}?"</AlertDialogTitle>
                <AlertDialogDescription>
                  This customer and all associated data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Delete
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
                  <CardTitle className="text-base">Customer Details</CardTitle>
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
              <InfoRow icon={Phone}        label="Name"              value={customer.name} />
              <InfoRow icon={Phone}        label="Mobile"    value={customer.phone} />
              <InfoRow icon={Home}         label="House No."   value={c.houseNumber} />
              <InfoRow icon={Layers}       label="Floor No."  value={c.floorNumber} />
              <InfoRow icon={MapPin}       label="Address"       value={customer.address} />
              <InfoRow icon={Navigation}   label="Location"       value={c.location} />
              <InfoRow
                icon={IndianRupee}
                label="Visiting Amount"
                value={c.visitingAmount != null ? `₹${c.visitingAmount}` : null}
              />
            </CardContent>
          </Card>

          {/* ── Payment Summary ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Summary</CardTitle>
              <CardDescription className="text-xs">Payment Summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-sm font-medium text-emerald-800">Total Paid</span>
                <span className="font-bold text-emerald-700">₹{history.totalPaid}</span>
              </div>
              <div className={`flex justify-between items-center p-3 rounded-lg border ${
                history.totalDue > 0 ? 'bg-rose-50 border-rose-100' : 'bg-muted/50 border-border'
              }`}>
                <span className={`text-sm font-medium ${history.totalDue > 0 ? 'text-rose-800' : 'text-muted-foreground'}`}>
                  Balance Due
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
              <TabsTrigger value="jobs">Job History</TabsTrigger>
              <TabsTrigger value="appliances">Appliances</TabsTrigger>
            </TabsList>

            {/* Job history */}
            <TabsContent value="jobs" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setIsNewJobOpen(true)}>
                  <Plus className="w-3 h-3 mr-2" />
                  Add New Job
                </Button>
              </div>

              {history.jobs.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-medium">No Job History</p>
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
                    <p className="text-lg font-medium">No Appliances registered</p>
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
                          {app.brand   && <p><span className="text-muted-foreground">Brand:</span> {app.brand}</p>}
                          {app.model   && <p><span className="text-muted-foreground">Model:</span> {app.model}</p>}
                          {app.serialNo && <p><span className="text-muted-foreground">Serial:</span> <span className="font-mono">{app.serialNo}</span></p>}
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
          <DialogTitle>Edit Customer Details</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-4">

            {/* Name + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl><Input placeholder="Customer name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile *</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* WhatsApp */}
            <FormField control={form.control} name="whatsappPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp Number</FormLabel>
                  <FormControl>
                    <PhoneInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Same as mobile if blank"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* House + Floor */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="houseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>House No.</FormLabel>
                    <FormControl><Input placeholder="A-201" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="floorNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor No.</FormLabel>
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
                  <FormLabel>Full Address</FormLabel>
                  <FormControl><Textarea placeholder="Sector 12, Noida..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location + Visiting Amount */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="City / Area" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="visitingAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visiting Amount ₹</FormLabel>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea placeholder="Any additional info..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={updateCustomer.isPending}>
                {updateCustomer.isPending ? 'Saving...' : 'Save ✓'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* ── NEW JOB DIALOG ─────────────────────────────────────────────────── */}
    <Dialog open={isNewJobOpen} onOpenChange={setIsNewJobOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            New Job — <span className="text-primary">{customer.name}</span>
          </DialogTitle>
        </DialogHeader>
        <Form {...jobForm}>
          <form onSubmit={jobForm.handleSubmit(onNewJob)} className="space-y-4">
            <FormField control={jobForm.control} name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Problem / Description</FormLabel>
                  <FormControl><Textarea placeholder="e.g. AC not cooling properly" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={jobForm.control} name="applianceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appliances (Appliance)</FormLabel>
                    <FormControl><Input placeholder="AC, Fridge…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={jobForm.control} name="technicianName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician</FormLabel>
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
                    <FormLabel>Amount ₹</FormLabel>
                    <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={jobForm.control} name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsNewJobOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={createJob.isPending}>
                {createJob.isPending ? 'Adding…' : 'Add Job ✓'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
