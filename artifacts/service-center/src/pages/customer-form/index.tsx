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
import { CheckCircle2, Loader2, WifiOff, Wrench, MapPin, Navigation, IndianRupee } from 'lucide-react';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Enter a valid mobile number'),
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
  const [visitingAmount, setVisitingAmount] = useState<number | null>(null);
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

  /* Verify token — do NOT pre-fill form, just get visiting amount */
  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }

    fetch(`${BASE}/api/public/customer-form/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) { setPageState('invalid'); return; }
        const data = await r.json();
        if (data.visitingAmount != null) {
          setVisitingAmount(Number(data.visitingAmount));
        }
        setPageState('form');
      })
      .catch(() => setPageState('invalid'));
  }, [token]);

  /* GPS → Google Maps link */
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('GPS is not available on this device.');
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
          setGpsError('Location permission denied. Please allow location access in Settings.');
        } else {
          setGpsError('Could not get location. Please try again.');
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
      if (!r.ok) { setErrorMsg(json.error || 'Something went wrong. Please try again.'); return; }
      setPageState('success');
    } catch {
      setErrorMsg('Check your internet connection and try again.');
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
          <p className="text-sm text-muted-foreground">Loading…</p>
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
            <h2 className="text-xl font-bold">Invalid Link</h2>
            <p className="text-sm text-muted-foreground">
              This link has expired or is incorrect.<br />
              Please request a new link from the service center.
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
            <h2 className="text-2xl font-bold text-emerald-700">Thank You! 🙏</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your details have been saved successfully.<br />
              Our team will contact you shortly.
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

        {/* Branding */}
        <div className="text-center space-y-2 pb-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto shadow-md">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Service Center</h1>
          <p className="text-sm text-muted-foreground">Please fill in your details and submit</p>
        </div>

        {/* Visiting charge banner */}
        {visitingAmount != null && visitingAmount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-100 border border-amber-300">
            <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
              <IndianRupee className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Visiting Charge</p>
              <p className="text-xl font-bold text-amber-900">₹{visitingAmount}</p>
            </div>
            <p className="text-xs text-amber-700 ml-auto text-right leading-snug">
              Payable at<br />the time of visit
            </p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Customer Details Form</CardTitle>
            <CardDescription>Please fill in all the information accurately</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Name */}
                <FormField control={form.control} name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Rahul Kumar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Mobile + WhatsApp */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile <span className="text-destructive">*</span></FormLabel>
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
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="If different" type="tel" inputMode="numeric" {...field} />
                        </FormControl>
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
                        <FormLabel>House / Flat No.</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. A-201" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="floorNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 2nd Floor" {...field} />
                        </FormControl>
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
                      <FormControl>
                        <Textarea placeholder="e.g. Sector 12, Noida, Uttar Pradesh" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Location with GPS — button is sibling to label, NOT inside it */}
                <FormField control={form.control} name="location"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1.5">
                        <FormLabel className="mb-0">Area / Location</FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleGetLocation}
                          disabled={gpsLoading}
                          className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
                        >
                          {gpsLoading
                            ? <><Loader2 className="w-3 h-3 animate-spin" />Getting location…</>
                            : <><Navigation className="w-3 h-3" />Use Current Location</>
                          }
                        </Button>
                      </div>
                      <FormControl>
                        <Input placeholder="Locality / area name or Google Maps link" {...field} />
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
                          View on map →
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
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                    : 'Submit Details ✓'
                  }
                </Button>

              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-8">
          Your information is secure and will only be used for service purposes.
        </p>
      </div>
    </div>
  );
}
