import React, { useState } from 'react';
import { useListCustomers, useCreateCustomer } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, MessageCircle, MoreVertical, Phone, Users } from 'lucide-react';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import { getListCustomersQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';

const customerSchema = z.object({
  name: z.string().min(1, 'नाम आवश्यक है (Name is required)'),
  phone: z.string().min(10, 'फ़ोन नंबर आवश्यक है (Phone number is required)'),
  whatsappPhone: z.string().optional(),
  address: z.string().optional(),
});

export default function Customers() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: customers, isLoading } = useListCustomers({ search });
  const createCustomer = useCreateCustomer();

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', whatsappPhone: '', address: '' }
  });

  const onSubmit = (data: z.infer<typeof customerSchema>) => {
    createCustomer.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast.success('ग्राहक सफलतापूर्वक जोड़ा गया (Customer added successfully)');
      },
      onError: () => toast.error('ग्राहक जोड़ने में विफल (Failed to add customer)')
    });
  };

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ग्राहक सूची <span className="text-xl font-normal text-muted-foreground ml-2">Customers</span></h1>
          <p className="text-muted-foreground mt-1">सभी ग्राहकों का प्रबंधन करें (Manage all customers)</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              नया ग्राहक (New Customer)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>नया ग्राहक जोड़ें (Add New Customer)</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>नाम (Name)</FormLabel>
                      <FormControl>
                        <Input placeholder="राहुल कुमार" {...field} />
                      </FormControl>
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
                        <FormControl>
                          <Input placeholder="9876543210" {...field} />
                        </FormControl>
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
                        <FormControl>
                          <Input placeholder="Optional" {...field} />
                        </FormControl>
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
                      <FormControl>
                        <Input placeholder="पूर्ण पता (Full address)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createCustomer.isPending}>
                  {createCustomer.isPending ? 'जोड़ रहा है...' : 'सुरक्षित करें (Save)'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="नाम या फ़ोन नंबर से खोजें (Search by name or phone)..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {customers?.map((customer) => (
            <Link key={customer.id} href={`/customers/${customer.id}`}>
              <Card className="hover-elevate cursor-pointer transition-all border-l-4 border-l-transparent hover:border-l-primary group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex h-12 w-12 rounded-full bg-secondary items-center justify-center text-secondary-foreground font-bold text-lg">
                      {customer.id}
                    </div>
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={customer.dpUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {customer.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{customer.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</span>
                        {customer.address && <span className="hidden md:inline truncate max-w-[200px]">• {customer.address}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                    <div className="flex flex-col items-end mr-4">
                      <span className="text-xs text-muted-foreground mb-1">कुल कार्य (Jobs): {customer.totalJobs || 0}</span>
                      {customer.unpaidAmount ? (
                        <Badge variant="destructive" className="font-semibold">बकाया (Due): ₹{customer.unpaidAmount}</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">कोई बकाया नहीं (Clear)</Badge>
                      )}
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                      onClick={(e) => handleWhatsApp(e, customer.whatsappPhone || customer.phone)}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          
          {customers?.length === 0 && (
            <div className="text-center py-12 bg-card rounded-lg border border-dashed">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-medium text-foreground">कोई ग्राहक नहीं मिला</h3>
              <p className="text-muted-foreground text-sm">No customers found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
