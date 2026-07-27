import React, { useState, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { 
  useGetCustomer, 
  useGetCustomerHistory, 
  useGetCustomerWhatsappForm,
  useUpdateCustomer,
  useDeleteCustomer
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Edit, Trash2, MessageCircle, Phone, MapPin, Calendar, 
  Wrench, FileText, CheckCircle2, AlertTriangle, Plus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCustomerQueryKey, getGetCustomerHistoryQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';

const customerSchema = z.object({
  name: z.string().min(1, 'नाम आवश्यक है (Name is required)'),
  phone: z.string().min(10, 'फ़ोन नंबर आवश्यक है (Phone number is required)'),
  whatsappPhone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export default function CustomerDetail() {
  const [, params] = useRoute('/customers/:id');
  const id = parseInt(params?.id || '0');
  const [, navigate] = useLocation();
  
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: customer, isLoading: isCustomerLoading } = useGetCustomer(id, { query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) } });
  const { data: history, isLoading: isHistoryLoading } = useGetCustomerHistory(id, { query: { enabled: !!id, queryKey: getGetCustomerHistoryQueryKey(id) } });
  const { data: waForm } = useGetCustomerWhatsappForm(id, { query: { enabled: !!id, queryKey: ['whatsapp-form', id] } });
  
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', whatsappPhone: '', address: '', notes: '' }
  });

  // Populate form only when dialog opens — avoid re-syncing while user types
  useEffect(() => {
    if (isEditOpen && customer) {
      form.reset({
        name: customer.name,
        phone: customer.phone,
        whatsappPhone: customer.whatsappPhone || '',
        address: customer.address || '',
        notes: customer.notes || '',
      });
    }
  }, [isEditOpen]);

  const onUpdate = (data: z.infer<typeof customerSchema>) => {
    updateCustomer.mutate({ id, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCustomerHistoryQueryKey(id) });
        setIsEditOpen(false);
        toast.success('ग्राहक विवरण अपडेट किया गया (Customer updated)');
      },
      onError: () => toast.error('अपडेट विफल रहा (Update failed)')
    });
  };

  const onDelete = () => {
    deleteCustomer.mutate({ id }, {
      onSuccess: () => {
        toast.success('Customer deleted successfully');
        navigate('/customers');
      },
      onError: () => toast.error('Failed to delete customer')
    });
  };

  const handleWhatsApp = () => {
    if (!waForm?.whatsappLink) {
      toast.error('WhatsApp लिंक उपलब्ध नहीं है (WhatsApp link not available)');
      return;
    }
    window.open(waForm.whatsappLink, '_blank');
  };

  if (isCustomerLoading || isHistoryLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer || !history) {
    return <div className="text-center py-12">ग्राहक नहीं मिला (Customer not found)</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/customers"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={customer.dpUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                {customer.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
              <p className="text-sm text-muted-foreground font-mono">ID: #{customer.serialNumber}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            className="bg-[#25D366] hover:bg-[#128C7E] text-white" 
            onClick={handleWhatsApp}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>
          
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon"><Edit className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ग्राहक विवरण संपादित करें (Edit Customer)</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>नाम (Name)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>फ़ोन (Phone)</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="whatsappPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>व्हाट्सएप (WhatsApp)</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>पता (Address)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>नोट्स (Notes)</FormLabel>
                        <FormControl><Textarea {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={updateCustomer.isPending}>
                    {updateCustomer.isPending ? 'सुरक्षित कर रहा है...' : 'सुरक्षित करें (Save)'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon"><Trash2 className="w-4 h-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>क्या आप वाकई हटाना चाहते हैं?</AlertDialogTitle>
                <AlertDialogDescription>
                  यह कार्रवाई पूर्ववत नहीं की जा सकती। यह ग्राहक और उससे संबंधित सभी डेटा हटा देगा।
                  (This action cannot be undone. It will permanently delete this customer.)
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>रद्द करें (Cancel)</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  हटाएं (Delete)
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">संपर्क विवरण</CardTitle>
              <CardDescription>Contact Details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-muted-foreground mt-1" />
                <div>
                  <p className="font-medium">{customer.phone}</p>
                  <p className="text-xs text-muted-foreground">Primary</p>
                </div>
              </div>
              {customer.whatsappPhone && customer.whatsappPhone !== customer.phone && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-4 h-4 text-emerald-500 mt-1" />
                  <div>
                    <p className="font-medium">{customer.whatsappPhone}</p>
                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                  </div>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                  <p className="text-sm">{customer.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">भुगतान सारांश</CardTitle>
              <CardDescription>Payment Summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-sm font-medium text-emerald-800">कुल भुगतान (Paid)</span>
                <span className="font-bold text-emerald-700">₹{history.totalPaid}</span>
              </div>
              <div className={`flex justify-between items-center p-3 rounded-lg border ${history.totalDue > 0 ? 'bg-rose-50 border-rose-100' : 'bg-muted/50 border-border'}`}>
                <span className={`text-sm font-medium ${history.totalDue > 0 ? 'text-rose-800' : 'text-muted-foreground'}`}>कुल बकाया (Due)</span>
                <span className={`font-bold ${history.totalDue > 0 ? 'text-rose-700' : 'text-foreground'}`}>₹{history.totalDue}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="jobs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="jobs">कार्य इतिहास (Job History)</TabsTrigger>
              <TabsTrigger value="appliances">उपकरण (Appliances)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="jobs" className="mt-4 space-y-4">
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
                            <span className="font-mono font-bold text-primary group-hover:underline">#{job.jobNumber || job.id}</span>
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
                            job.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            job.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {job.paymentStatus}
                          </span>
                          {job.scheduledDate && (
                            <span className="text-[10px] text-muted-foreground mt-1">
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
            
            <TabsContent value="appliances" className="mt-4 space-y-4">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm">
                  <Plus className="w-3 h-3 mr-2" />
                  उपकरण जोड़ें (Add Appliance)
                </Button>
              </div>
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
                          {app.brand && <p><span className="text-muted-foreground">ब्रांड:</span> {app.brand}</p>}
                          {app.model && <p><span className="text-muted-foreground">मॉडल:</span> {app.model}</p>}
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
  );
}
