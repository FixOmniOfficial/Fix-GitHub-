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
import { CheckCircle2, Loader2, WifiOff, Wrench, MapPin, Navigation } from 'lucide-react';

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
type PageState = 'loading' | 'form' | 'success' | 'invalid';

export default function CustomerFormPage() {
  const [, params] = useRoute('/customer-form/:token');
  const token = params?.token || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', phone: '', whatsappPhone: '',
      houseNumber: '', floorNumber: '', address: '', location: '',
    },
  });

  const locationValue = form.watch('location');

  /* Verify token is valid — do NOT pre-fill form data */
  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }

    fetch(`${BASE}/api/public/customer-form/${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) { setPageState('invalid'); return; }
        // Token valid — show blank form
        setPageState('form');
      })
      .catch(() => setPageState('invalid'));
  }, [token]);

  /* GPS → Google Maps link */
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('इस डिवाइस पर GPS उपलब्ध नहीं है');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
        form.setValue('location', mapsLink, { shouldValidate: true });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsError('लोकेशन की अनुमति नहीं दी। Settings में Allow करें।');
        } else {
          setGpsError('लोकेशन नहीं मिला। दोबारा कोशिश करें।');
        }
      },
      { timeout: 10000, maximumAge: 0 }
    );
  };

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
          <p className="text-sm text-muted-foreground">लोड हो रहा है…</p>
        </div>
      </div>
    );
  }

  /* ── Invalid ── */
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

  /* ── Blank Form ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-md space-y-4">

        {/* Branding */}
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
            <CardDescription>कृपया सभी जानकारी सही-सही भरें</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* नाम */}
                <FormField control={form.control} name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>नाम <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="जैसे: राहुल कुमार" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* मोबाइल + WhatsApp */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>मोबाइल नंबर <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="9876543210" type="tel" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="whatsappPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp नंबर</FormLabel>
                        <FormControl>
                          <Input placeholder="अलग हो तो भरें" type="tel" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* हाउस + फ्लोर */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="houseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>मकान / फ्लैट नंबर</FormLabel>
                        <FormControl>
                          <Input placeholder="जैसे: क-201" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="floorNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>मंजिल (फ्लोर)</FormLabel>
                        <FormControl>
                          <Input placeholder="जैसे: दूसरी मंजिल" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* पूरा पता */}
                <FormField control={form.control} name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>पूरा पता</FormLabel>
                      <FormControl>
                        <Textarea placeholder="जैसे: सेक्टर 12, नोएडा, उत्तर प्रदेश" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* लोकेशन — GPS button OUTSIDE the label */}
                <FormField control={form.control} name="location"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1.5">
                        <FormLabel className="mb-0">मोहल्ला / लोकेशन</FormLabel>
                        {/* Button is sibling to label, NOT inside it */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleGetLocation}
                          disabled={gpsLoading}
                          className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
                        >
                          {gpsLoading
                            ? <><Loader2 className="w-3 h-3 animate-spin" />मिल रहा है…</>
                            : <><Navigation className="w-3 h-3" />वर्तमान लोकेशन</>
                          }
                        </Button>
                      </div>
                      <FormControl>
                        <Input placeholder="मोहल्ला / क्षेत्र का नाम या Google Maps लिंक" {...field} />
                      </FormControl>
                      {gpsError && (
                        <p className="text-xs text-destructive mt-1">{gpsError}</p>
                      )}
                      {locationValue?.startsWith('https://maps.google.com') && (
                        <a
                          href={locationValue}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                        >
                          <MapPin className="w-3 h-3" />
                          मानचित्र पर देखें →
                        </a>
                      )}
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
