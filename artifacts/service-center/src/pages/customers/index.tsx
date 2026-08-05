import React, { useState, useEffect } from 'react';
import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useListJobs,
  getListCustomersQueryKey,
} from '@workspace/api-client-react';
import { useLongPress } from '@/hooks/use-long-press';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, MessageCircle, Phone, Users, Pencil, Trash2, ChevronRight,
         Wrench, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ─── Schemas ────────────────────────────────────────────────────────────── */

const addSchema = z.object({
  name: z.string().min(1, 'नाम आवश्यक है'),
  phone: z.string().min(10, 'फ़ोन नंबर आवश्यक है'),
  whatsappPhone: z.string().optional(),
  address: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(1, 'नाम आवश्यक है'),
  phone: z.string().min(10, 'फ़ोन नंबर आवश्यक है'),
});

type AddForm = z.infer<typeof addSchema>;
type EditForm = z.infer<typeof editSchema>;

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface CustomerMenuItem {
  id: number;
  name: string;
  phone: string;
}

/* ─── Per-card long-press wrapper ────────────────────────────────────────── */

function CustomerCard({
  customer,
  onEdit,
  onDelete,
  onDial,
  onWhatsApp,
  onNavigate,
}: {
  customer: any;
  onEdit: () => void;
  onDelete: () => void;
  onDial: (e: React.MouseEvent, phone: string) => void;
  onWhatsApp: (e: React.MouseEvent, phone: string) => void;
  onNavigate: () => void;
}) {
  const [longPressActive, setLongPressActive] = useState(false);

  const longPress = useLongPress({
    delay: 600,
    onLongPress: () => {
      setLongPressActive(true);
      onDelete();           // fires the delete confirm directly
    },
    onClick: onNavigate,
  });

  return (
    <Card
      {...longPress}
      className={`transition-all border-l-4 border-l-transparent hover:border-l-primary group cursor-pointer select-none ${longPressActive ? 'ring-2 ring-rose-500/50' : 'hover-elevate'}`}
      onContextMenu={(e) => { e.preventDefault(); onDelete(); }}   // right-click → delete too
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        {/* Left: avatar + name + phone */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 border border-border shrink-0">
            <AvatarImage src={customer.dpUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {customer.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {/* NAME → click menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="font-bold text-lg leading-tight text-left hover:text-primary transition-colors flex items-center gap-1 group/name"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{customer.name}</span>
                  <Pencil className="w-3 h-3 opacity-0 group-hover/name:opacity-60 transition-opacity shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={onEdit}>
                  <Pencil className="w-4 h-4 text-blue-400" />
                  नाम / नंबर बदलें
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-rose-500 focus:text-rose-500"
                  onSelect={onDelete}
                >
                  <Trash2 className="w-4 h-4" />
                  हटाएं (Delete)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Phone → dial */}
            <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
              <button
                onClick={(e) => onDial(e, customer.phone)}
                className="flex items-center gap-1 text-primary hover:underline font-medium"
                title="Call करें"
              >
                <Phone className="w-3 h-3" />
                {customer.phone}
              </button>
              {customer.address && (
                <span className="hidden md:inline truncate max-w-[180px]">• {customer.address}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: badge + actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex flex-col items-end gap-1 mr-1">
            <span className="text-xs text-muted-foreground">कार्य: {customer.totalJobs || 0}</span>
            {customer.unpaidAmount ? (
              <Badge variant="destructive" className="text-xs">बकाया ₹{customer.unpaidAmount}</Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">Clear</Badge>
            )}
          </div>

          {/* WhatsApp */}
          <Button
            variant="outline" size="icon"
            className="rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
            onClick={(e) => { e.stopPropagation(); onWhatsApp(e, customer.whatsappPhone || customer.phone); }}
            title="WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </Button>

          {/* Detail arrow */}
          <Button
            variant="ghost" size="icon"
            className="rounded-full text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
            title="विवरण देखें"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Jobs helpers ───────────────────────────────────────────────────────── */

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':     return { label: 'लंबित',     icon: Clock,         color: 'text-amber-500',  bg: 'border-amber-300' };
    case 'in_progress': return { label: 'प्रगति पर', icon: Wrench,        color: 'text-blue-500',   bg: 'border-blue-300' };
    case 'completed':   return { label: 'पूरा हुआ',  icon: CheckCircle2,  color: 'text-emerald-500',bg: 'border-emerald-300' };
    case 'cancelled':   return { label: 'रद्द',       icon: XCircle,       color: 'text-red-500',    bg: 'border-red-300' };
    default:            return { label: status,       icon: Clock,         color: 'text-gray-500',   bg: 'border-gray-200' };
  }
}

function getPaymentDot(status: string) {
  switch (status) {
    case 'paid':    return 'bg-emerald-500';
    case 'partial': return 'bg-amber-500';
    default:        return 'bg-rose-500';
  }
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function Customers() {
  const [tab, setTab] = useState('customers');

  // Customer state
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerMenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerMenuItem | null>(null);

  // Jobs state
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatus, setJobStatus] = useState('all');

  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useListCustomers({ search });
  const { data: jobs, isLoading: jobsLoading } = useListJobs({
    search: jobSearch || undefined,
    status: jobStatus !== 'all' ? jobStatus : undefined,
  });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  /* Add form */
  const addForm = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: '', phone: '', whatsappPhone: '', address: '' },
  });

  /* Edit form — syncs when editTarget changes */
  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', phone: '' },
  });
  useEffect(() => {
    if (editTarget) editForm.reset({ name: editTarget.name, phone: editTarget.phone });
  }, [editTarget]);

  /* Handlers */
  const handleAdd = (data: AddForm) => {
    createCustomer.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setAddOpen(false);
        addForm.reset();
        toast.success('ग्राहक जोड़ा गया ✓');
      },
      onError: () => toast.error('जोड़ने में विफल'),
    });
  };

  const handleEdit = (data: EditForm) => {
    if (!editTarget) return;
    updateCustomer.mutate({ id: editTarget.id, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setEditTarget(null);
        toast.success('बदलाव सुरक्षित हो गया ✓');
      },
      onError: () => toast.error('बदलाव नहीं हो सका'),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCustomer.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setDeleteTarget(null);
        toast.success('ग्राहक हटा दिया गया');
      },
      onError: () => toast.error('हटाने में विफल'),
    });
  };

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.preventDefault(); e.stopPropagation();
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleDial = (e: React.MouseEvent, phone: string) => {
    e.preventDefault(); e.stopPropagation();
    window.location.href = `tel:${phone.replace(/\D/g, '')}`;
  };

  /* ─── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 animate-in fade-in duration-500">

      {/* Page title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          ग्राहक & कार्य <span className="text-xl font-normal text-muted-foreground ml-2">Customers & Jobs</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">सभी ग्राहक और सर्विस जॉब्स एक जगह</p>
      </div>

      {/* Top-level tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="customers" className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> ग्राहक
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> कार्य
          </TabsTrigger>
        </TabsList>

        {/* ══ CUSTOMERS TAB ═══════════════════════════════════════════════ */}
        <TabsContent value="customers" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="नाम या फ़ोन नंबर से खोजें..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button className="shadow-sm shrink-0" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> नया ग्राहक
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {customers?.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onEdit={() => setEditTarget({ id: customer.id, name: customer.name, phone: customer.phone })}
                  onDelete={() => setDeleteTarget({ id: customer.id, name: customer.name, phone: customer.phone })}
                  onDial={handleDial}
                  onWhatsApp={handleWhatsApp}
                  onNavigate={() => navigate(`/customers/${customer.id}`)}
                />
              ))}
              {customers?.length === 0 && (
                <div className="text-center py-16 bg-card rounded-xl border-2 border-dashed">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <h3 className="text-lg font-medium">कोई ग्राहक नहीं मिला</h3>
                  <p className="text-muted-foreground text-sm mt-1">No customers found</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ══ JOBS TAB ════════════════════════════════════════════════════ */}
        <TabsContent value="jobs" className="mt-4 space-y-4">
          {/* Search + status filter */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="जॉब नंबर या ग्राहक खोजें..."
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={jobStatus} onValueChange={setJobStatus}>
            <TabsList className="grid grid-cols-5 w-full max-w-2xl">
              <TabsTrigger value="all">सभी</TabsTrigger>
              <TabsTrigger value="pending">लंबित</TabsTrigger>
              <TabsTrigger value="in_progress">प्रगति</TabsTrigger>
              <TabsTrigger value="completed">पूर्ण</TabsTrigger>
              <TabsTrigger value="cancelled">रद्द</TabsTrigger>
            </TabsList>

            <TabsContent value={jobStatus} className="mt-3">
              {jobsLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs?.map((job) => {
                    const st = getStatusConfig(job.status);
                    const date = job.scheduledDate
                      ? new Date(job.scheduledDate).toLocaleDateString('hi-IN')
                      : null;
                    return (
                      <Link key={job.id} href={`/jobs/${job.id}`}>
                        <Card className={`hover-elevate cursor-pointer transition-all border-l-4 group ${st.bg}`}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="hidden sm:flex flex-col items-center justify-center w-14 h-14 rounded bg-card border shadow-sm shrink-0">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Job</span>
                                <span className="font-mono font-bold text-primary text-sm">#{job.jobNumber || job.id}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <h3 className="font-bold group-hover:text-primary transition-colors">
                                    {job.customerName || '—'}
                                  </h3>
                                  {job.isHighlighted && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                                  {job.applianceType && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{job.applianceType}</span>}
                                  {date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>}
                                  {job.technicianName && <span className="text-primary/80 font-medium">@ {job.technicianName}</span>}
                                </div>
                                {job.description && <p className="text-sm mt-1 text-foreground/70 line-clamp-1">{job.description}</p>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-background ${st.color}`}>
                                <st.icon className="w-3 h-3" />{st.label}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-sm">₹{job.amount || 0}</span>
                                <span className={`w-2.5 h-2.5 rounded-full ${getPaymentDot(job.paymentStatus)}`} title={job.paymentStatus} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                  {jobs?.length === 0 && (
                    <div className="text-center py-12 bg-card rounded-xl border-2 border-dashed">
                      <Wrench className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <h3 className="text-lg font-medium">कोई कार्य नहीं मिला</h3>
                      <p className="text-muted-foreground text-sm">No jobs found</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* ── ADD DIALOG ───────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>नया ग्राहक जोड़ें</DialogTitle>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
              <FormField control={addForm.control} name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>नाम (Name)</FormLabel>
                    <FormControl><Input placeholder="राहुल कुमार" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addForm.control} name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>फ़ोन (Phone)</FormLabel>
                      <FormControl><Input placeholder="9876543210" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={addForm.control} name="whatsappPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp</FormLabel>
                      <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField control={addForm.control} name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>पता (Address)</FormLabel>
                    <FormControl><Input placeholder="पूर्ण पता" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? 'जोड़ रहा है...' : 'सुरक्षित करें'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG (naam + number) ──────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>नाम / नंबर बदलें</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
              <FormField control={editForm.control} name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>नाम (Name)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={editForm.control} name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>फ़ोन नंबर (Phone)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>
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

      {/* ── DELETE CONFIRM ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>"{deleteTarget?.name}" को हटाएं?</AlertDialogTitle>
            <AlertDialogDescription>
              यह ग्राहक और उनसे जुड़ा सारा डेटा हमेशा के लिए हट जाएगा। यह वापस नहीं होगा।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>रद्द करें</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCustomer.isPending}
            >
              {deleteCustomer.isPending ? 'हटा रहा है...' : 'हां, हटाएं'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
