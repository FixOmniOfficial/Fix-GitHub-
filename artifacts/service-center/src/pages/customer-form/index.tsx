import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Loader2, WifiOff, Wrench } from 'lucide-react';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

const formSchema = z.object({
  name: z.string().min(1, 'नाम आवश्यक है'),
  phone: z.string().min(10, 'सही मोबाइल नंबर डालें'),
  whatsappPhone: z.string().optional(),
  houseNumber: z.string().optional(),
  floorNumber: z.string().optional(),
  address: z.string().optional(),
  location: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CustomerData {
  id: number;
  serialNumber: number;
  name: string;
  phone: string;
  whatsappPhone?: string | null;
  houseNumber?: string | null;
  floorNumber?: string | null;
  address?: string | null;
  location?: string | null;
}

type PageState = 'loading' | 'form' | 'success' | 'invalid';

export default function CustomerFormPage() {
  const [, params] = useRoute('/customer-form/:token');
  const token = params?.token || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', phone: '', whatsappPhone: '',
      houseNumber: '', floorNumber: '', address: '', location: '',
    },
  });

  /* Fetch customer data on mount */
  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }

    fetch(`${BASE}/api/public/customer-form/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) { setPageState('invalid'); return; }
        const data: CustomerData = await r.json();
        form.reset({
          name: data.name,
          phone: data.phone,
          whatsappPhone: data.whatsappPhone || '',
          houseNumber: data.houseNumber || '',
          floorNumber: data.floorNumber || '',
          address: data.address || '',
          location: data.location || '',
        });
        setPageState('form');
      })
      .catch(() => setPageState('invalid'));
  }, [token]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const r = await fetch(`${BASE}/api/public/customer-form/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await r.json();
      if (!r.ok) { setErrorMsg(json.error || 'कुछ गड़बड़ हो गई'); return; }
      setPageState('success');
    } catch {
      setErrorMsg('इंटरनेट कनेक्शन की जाँच करें और दोबारा कोशिश करें');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
          <p className="text-sm text-muted-foreground">जानकारी लोड हो रही है…</p>
        </div>
      </div>
    );
  }

  /* ── Invalid link ── */
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-12 pb-10 space-y-4">
            <WifiOff className="w-14 h-14 text-muted-foreground/40 mx-auto" />
            <h2 className="text-xl font-bold">लिंक अमान्य है</h2>
            <p className="text-sm text-muted-foreground">
              यह लिंक समाप्त हो गया है या सही नहीं है।<br />
              कृपया सर्विस सेंटर से नया लिंक मांगें।
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Success ── */
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center border-emerald-200">
          <CardContent className="pt-12 pb-10 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold text-emerald-700">धन्यवाद! 🙏</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              आपकी जानकारी सफलतापूर्वक सुरक्षित हो गई।<br />
              हमारी टीम जल्द ही आपसे संपर्क करेगी।
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-md space-y-4">

        {/* Header branding */}
        <div className="text-center space-y-2 pb-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto shadow-md">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">सर्विस सेंटर</h1>
          <p className="text-sm text-muted-foreground">कृपया अपनी जानकारी भरें और सबमिट करें</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ग्राहक विवरण फ़ॉर्म</CardTitle>
            <CardDescription>Customer Details Form</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Name + Phone */}
                <FormField control={form.control} name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>नाम (Name) <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="राहुल कुमार" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>मोबाइल <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="9876543210" type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="whatsappPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl><Input placeholder="अलग है तो भरें" type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* House + Floor */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="houseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>हाउस/फ्लैट नंबर</FormLabel>
                        <FormControl><Input placeholder="A-201" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="floorNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>फ्लोर</FormLabel>
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
                      <FormControl><Textarea placeholder="सेक्टर 12, नोएडा, उत्तर प्रदेश" rows={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Location */}
                <FormField control={form.control} name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>लोकेशन / मोहल्ला</FormLabel>
                      <FormControl><Input placeholder="नोएडा सेक्टर 62" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {errorMsg && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{errorMsg}</p>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
                  {isSubmitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />सुरक्षित हो रहा है…</>
                    : 'जानकारी सबमिट करें ✓'
                  }
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-8">
          आपकी जानकारी सुरक्षित है और केवल सर्विस के लिए उपयोग की जाएगी।
        </p>
      </div>
    </div>
  );
}
