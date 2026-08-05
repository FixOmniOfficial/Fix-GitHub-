import React, { useState, useEffect } from 'react';
import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getListCustomersQueryKey,
} from '@workspace/api-client-react';
import { useLongPress } from '@/hooks/use-long-press';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, MessageCircle, Phone, Users, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
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

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function Customers() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerMenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerMenuItem | null>(null);

  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useListCustomers({ search });
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
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            ग्राहक सूची <span className="text-xl font-normal text-muted-foreground ml-2">Customers</span>
          </h1>
          <p className="text-muted-foreground mt-1">नाम पर click करें — Edit या Delete करें</p>
        </div>

        <Button className="shadow-sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          नया ग्राहक
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="नाम या फ़ोन नंबर से खोजें..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
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
