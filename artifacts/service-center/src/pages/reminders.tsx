import React, { useState } from 'react';
import { useListReminders, useCreateReminder, useUpdateReminder, useDeleteReminder } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, BellRing, Calendar, Clock, Trash2, Plus, CheckCircle } from 'lucide-react';
import { getListRemindersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'wouter';

const reminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  reminderAt: z.string().min(1, 'Date & time required'),
});

export default function Reminders() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: reminders, isLoading } = useListReminders();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const form = useForm<z.infer<typeof reminderSchema>>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      title: '',
      description: '',
      reminderAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16) // tomorrow
    }
  });

  const onSubmit = (data: z.infer<typeof reminderSchema>) => {
    createReminder.mutate({ 
      data: {
        ...data,
        isActive: true,
        reminderAt: new Date(data.reminderAt).toISOString()
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast.success('Reminder set');
      }
    });
  };

  const handleMarkDone = (id: number) => {
    updateReminder.mutate({ id, data: { isActive: false } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
        toast.success('Reminder completed');
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteReminder.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
        toast.success('Reminder deleted');
      }
    });
  };

  const now = new Date();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Reminders <span className="text-xl font-normal text-muted-foreground">Reminders & Alarms</span>
            <BellRing className="w-6 h-6 text-amber-500" />
          </h1>
          <p className="text-muted-foreground mt-1">Set alerts for important tasks and calls</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Reminder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Reminder</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input placeholder="e.g. Call back" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reminderAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Input placeholder="Optional notes" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createReminder.isPending}>
                  {createReminder.isPending ? 'Setting...' : 'Save'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : reminders?.length === 0 ? (
          <div className="text-center py-16 bg-card border-2 border-dashed rounded-xl">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-medium">No active reminders</h3>
            <p className="text-muted-foreground mt-1">No active reminders</p>
          </div>
        ) : (
          reminders?.sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime()).map(reminder => {
            const isOverdue = new Date(reminder.reminderAt) < now && reminder.isActive;
            const date = new Date(reminder.reminderAt);
            
            return (
              <Card key={reminder.id} className={`overflow-hidden transition-all border-l-4 ${isOverdue ? 'border-l-rose-500 bg-rose-50/50' : 'border-l-primary hover:border-l-primary/80'}`}>
                <CardContent className="p-0 flex flex-col sm:flex-row">
                  <div className={`p-4 sm:p-6 sm:w-48 shrink-0 flex flex-col justify-center items-start sm:items-center sm:border-r ${isOverdue ? 'bg-rose-100/50' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold mb-1">
                      <Calendar className="w-4 h-4" /> 
                      {date.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })}
                    </div>
                    <div className={`flex items-center gap-2 text-lg font-bold ${isOverdue ? 'text-rose-600 animate-pulse' : 'text-primary'}`}>
                      <Clock className="w-5 h-5" />
                      {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {isOverdue && <Badge variant="destructive" className="mt-2 text-[10px]">Overdue</Badge>}
                  </div>
                  
                  <div className="p-4 sm:p-6 flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{reminder.title}</h3>
                      {reminder.description && <p className="text-muted-foreground text-sm mb-2">{reminder.description}</p>}
                      {(reminder.customerName || reminder.jobId) && (
                        <div className="flex gap-2">
                          {reminder.customerName && (
                            <Badge variant="outline" className="bg-background">
                              <Link href={`/customers/${reminder.customerId}`}>{reminder.customerName}</Link>
                            </Badge>
                          )}
                          {reminder.jobId && (
                            <Badge variant="outline" className="bg-background">
                              <Link href={`/jobs/${reminder.jobId}`}>Job #{reminder.jobId}</Link>
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {reminder.isActive && (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Button 
                          variant="outline" 
                          className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700"
                          onClick={() => handleMarkDone(reminder.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Done
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(reminder.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
