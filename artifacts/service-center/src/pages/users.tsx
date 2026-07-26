import React, { useState } from 'react';
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCircle, Shield, Trash2, Plus, Mail } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListUsersQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const userSchema = z.object({
  name: z.string().min(1, 'नाम आवश्यक है (Name is required)'),
  email: z.string().email('वैध ईमेल आवश्यक है (Valid email is required)').optional().or(z.literal('')),
  role: z.enum(['admin', 'technician', 'viewer']),
});

export default function Users() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', role: 'technician' }
  });

  const onSubmit = (data: z.infer<typeof userSchema>) => {
    createUser.mutate({ data: { ...data, email: data.email || undefined } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast.success('यूज़र जोड़ा गया (User added successfully)');
      }
    });
  };

  const handleToggleStatus = (id: number, currentStatus: boolean) => {
    updateUser.mutate({ id, data: { isActive: !currentStatus } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() })
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('क्या आप वाकई इस यूज़र को हटाना चाहते हैं? (Are you sure you want to delete this user?)')) {
      deleteUser.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast.success('यूज़र हटा दिया गया (User deleted)');
        }
      });
    }
  };

  const roleColors = {
    admin: 'bg-primary/10 text-primary border-primary/20',
    technician: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    viewer: 'bg-muted text-muted-foreground border-border'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">यूज़र्स <span className="text-xl font-normal text-muted-foreground ml-2">Users</span></h1>
          <p className="text-muted-foreground mt-1">कर्मचारियों और पहुँच का प्रबंधन करें (Manage staff and access)</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              नया यूज़र (New User)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>नया यूज़र जोड़ें (Add New User)</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ईमेल (Email) - Optional</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>भूमिका (Role)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="भूमिका चुनें" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin (व्यवस्थापक)</SelectItem>
                          <SelectItem value="technician">Technician (तकनीशियन)</SelectItem>
                          <SelectItem value="viewer">Viewer (दर्शक)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createUser.isPending}>
                  {createUser.isPending ? 'जोड़ रहा है...' : 'सुरक्षित करें (Save)'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          [1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : users?.length === 0 ? (
          <div className="col-span-2 text-center py-16 bg-card border-2 border-dashed rounded-xl">
            <UserCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-medium">कोई यूज़र नहीं (No users found)</h3>
          </div>
        ) : (
          users?.map(user => (
            <Card key={user.id} className={`overflow-hidden transition-all ${!user.isActive ? 'opacity-60 grayscale-[0.5]' : ''}`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-background shadow-sm">
                      {user.role === 'admin' ? <Shield className="w-6 h-6 text-primary" /> : <UserCircle className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{user.name}</h3>
                      <div className="flex flex-col mt-1 gap-1">
                        <Badge variant="outline" className={`w-fit text-[10px] uppercase font-bold tracking-wider ${roleColors[user.role as keyof typeof roleColors]}`}>
                          {user.role}
                        </Badge>
                        {user.email && (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" /> {user.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleToggleStatus(user.id, user.isActive || false)}
                      className={`text-xs h-7 ${user.isActive ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                    >
                      {user.isActive ? 'निष्क्रिय करें (Disable)' : 'सक्रिय करें (Enable)'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
