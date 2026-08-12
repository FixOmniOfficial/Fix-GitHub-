import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Loader2, WifiOff, CheckCircle2, Phone, MapPin, Navigation, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

// ── Floor options ──────────────────────────────────────────────────────────────
const FLOOR_OPTIONS = [
  'Ground Floor', '1st Floor', '2nd Floor', '3rd Floor',
  '4th Floor', '5th Floor', '6th Floor', '7th Floor+',
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface TechProfile {
  id: number;
  techName: string;
  techCode: string;
  category: string;
  phone: string | null;
  rating: number;
  avatarEmoji: string;
  visitingCharge: number | null;
  shopName: string | null;
}

interface AppSettings {
  appName: string;
  appLogoUrl: string | null;
  playStoreUrl: string | null;
  webAppUrl: string | null;
  iconTechnician: string;
  iconServiceType: string;
  iconFullName: string;
  iconMobileNo: string;
  iconHouseNo: string;
  iconSelectFloor: string;
  iconFullAddress: string;
  iconGps: string;
}

type PageState = 'loading' | 'form' | 'success' | 'error';

// ── Star Rating renderer ───────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}/5</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CustomerFormPage() {
  // Handle both /book/:techCode (new) and /customer-form/:token (legacy)
  const [, bookParams]   = useRoute('/book/:techCode');
  const [, formParams]   = useRoute('/customer-form/:token');
  const code = bookParams?.techCode || formParams?.token || '';

  const [pageState,    setPageState]    = useState<PageState>('loading');
  const [tech,         setTech]         = useState<TechProfile | null>(null);
  const [settings,     setSettings]     = useState<AppSettings | null>(null);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [submitError,  setSubmitError]  = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [gpsError,     setGpsError]     = useState('');

  // Form state
  const [serviceType, setServiceType] = useState('');
  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [houseNo,     setHouseNo]     = useState('');
  const [floor,       setFloor]       = useState('');
  const [address,     setAddress]     = useState('');
  const [location,    setLocation]    = useState('');

  // ── Load tech profile + app settings in parallel ────────────────────────────
  useEffect(() => {
    if (!code) { setPageState('error'); setErrorMsg('Technician profile not found. Please verify the booking link.'); return; }

    Promise.all([
      fetch(`${BASE}/api/public/book/${encodeURIComponent(code)}`).then(r => r.json()),
      fetch(`${BASE}/api/public/app-settings`).then(r => r.json()),
    ]).then(([techData, settingsData]) => {
      if (techData.error) {
        setErrorMsg(techData.error);
        setPageState('error');
        return;
      }
      setTech(techData);
      setSettings(settingsData);
      setPageState('form');
    }).catch(() => {
      setErrorMsg('Could not load booking form. Please check your internet and try again.');
      setPageState('error');
    });
  }, [code]);

  // ── GPS location ─────────────────────────────────────────────────────────────
  const handleGetLocation = () => {
    if (!navigator.geolocation) { setGpsError('GPS is not available on this device.'); return; }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        setLocation(`https://maps.google.com/?q=${latitude},${longitude}`);
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(err.code === 1 ? 'Location permission denied. Please allow access in Settings.' : 'Could not get location. Try again.');
      },
      { timeout: 10000, maximumAge: 0 }
    );
  };

  // ── Submit booking ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!serviceType) { setSubmitError('Please select a service type.'); return; }
    if (!name.trim()) { setSubmitError('Full name is required.'); return; }
    if (phone.trim().length < 10) { setSubmitError('Enter a valid 10-digit mobile number.'); return; }

    setIsSubmitting(true);
    try {
      const r = await fetch(`${BASE}/api/public/book/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), houseNumber: houseNo.trim(), floorNumber: floor, address: address.trim(), location, serviceType }),
      });
      const json = await r.json();
      if (!r.ok) { setSubmitError(json.error || 'Something went wrong. Please try again.'); return; }

      setPageState('success');

      // ── Notify technician via WhatsApp deeplink ───────────────────────────
      const techPhone = json.techPhone?.replace(/\D/g, '');
      if (techPhone) {
        const appName  = settings?.appName ?? 'Booking App';
        const waMsg = encodeURIComponent(
          `📬 *New Booking Alert!*\n\n` +
          `👤 Customer: ${name.trim()}\n` +
          `📞 Phone: ${phone.trim()}\n` +
          (houseNo   ? `🏠 House / Flat: ${houseNo}\n` : '') +
          (floor     ? `🏢 Floor: ${floor}\n`           : '') +
          (address   ? `🗺️ Address: ${address.trim()}\n` : '') +
          (location  ? `📍 Location: ${location}\n`     : '') +
          `🛠️ Service: ${serviceType}\n\n` +
          `Booking ID: ${json.bookingUid}\n` +
          `Submitted via *${appName}*`
        );
        const waNum = techPhone.length === 10 ? `91${techPhone}` : techPhone;
        setTimeout(() => window.open(`https://wa.me/${waNum}?text=${waMsg}`, '_blank'), 800);
      }
    } catch {
      setSubmitError('Check your internet connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Icon helper ──────────────────────────────────────────────────────────────
  const ic = (key: keyof AppSettings, fallback: string) =>
    settings ? String(settings[key] || fallback) : fallback;

  // ══════════════════════════════════════════════════════════════════════════════
  // LOADING
  // ══════════════════════════════════════════════════════════════════════════════
  if (pageState === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
        <p className="text-sm text-muted-foreground">Loading booking form…</p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // ERROR / NOT FOUND
  // ══════════════════════════════════════════════════════════════════════════════
  if (pageState === 'error') return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
        <WifiOff className="w-14 h-14 text-muted-foreground/40 mx-auto" />
        <h2 className="text-xl font-bold text-gray-800">Link Not Valid</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{errorMsg}</p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // SUCCESS
  // ══════════════════════════════════════════════════════════════════════════════
  if (pageState === 'success') return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-10 text-center space-y-5">
        <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto" />
        <h2 className="text-2xl font-bold text-emerald-700">Thank You! 🙏</h2>
        <p className="text-base text-gray-600 leading-relaxed">
          Your booking has been submitted successfully.<br />
          The technician will contact you shortly.
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-700 font-medium">
            ✅ Thank You! Your booking has been submitted successfully. The technician will contact you shortly.
          </p>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN FORM
  // ══════════════════════════════════════════════════════════════════════════════
  const appName    = settings?.appName    ?? 'Booking App';
  const openTarget = settings?.playStoreUrl || settings?.webAppUrl || '#';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50">

      {/* ── TOP HEADER ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-border/50 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Left: Logo + App name + Open button */}
          <div className="flex items-center gap-2.5 min-w-0">
            {settings?.appLogoUrl
              ? <img src={settings.appLogoUrl} alt="logo" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              : <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0 text-white text-sm font-bold">{appName.charAt(0)}</div>
            }
            <span className="font-bold text-sm text-gray-900 truncate">{appName}</span>
            {openTarget !== '#' && (
              <button
                onClick={() => { window.location.href = openTarget; }}
                className="shrink-0 text-xs font-semibold text-amber-600 border border-amber-300 rounded-full px-2.5 py-0.5 hover:bg-amber-50 transition-colors"
              >
                Open ↗
              </button>
            )}
          </div>
          {/* Right: Label */}
          <span className="shrink-0 text-xs font-semibold text-muted-foreground bg-gray-100 rounded-full px-3 py-1">
            Booking Form
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-10">

        {/* ── TECHNICIAN PROFILE CARD ───────────────────────────────────────── */}
        {tech && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5" />
            <div className="p-4 flex items-start gap-4">
              {/* Left column */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{ic('iconTechnician', '👤')}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-base leading-tight truncate">{tech.techName}</p>
                    {tech.shopName && (
                      <p className="text-xs text-muted-foreground truncate">{tech.shopName}</p>
                    )}
                  </div>
                </div>
                <StarRating rating={tech.rating} />
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-gray-700">ID:</span> {tech.techCode}
                  </p>
                  <p className="text-xs font-semibold text-amber-700 bg-amber-50 inline-block rounded px-2 py-0.5 border border-amber-200">
                    {tech.category}
                  </p>
                </div>
              </div>
              {/* Right column */}
              <div className="shrink-0 space-y-2 text-right">
                {tech.visitingCharge != null && tech.visitingCharge > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <p className="text-xs text-amber-700 font-medium">Visiting Charge</p>
                    <p className="text-xl font-extrabold text-amber-900">₹{tech.visitingCharge}</p>
                  </div>
                )}
                {tech.phone && (
                  <a
                    href={`tel:${tech.phone}`}
                    className="flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Direct Call
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SERVICE TYPE SELECTION (Required) ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <p className="text-sm font-bold text-gray-800">
            {ic('iconServiceType', '🛠️')} Service Type
            <span className="text-destructive ml-1">*</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'Service',      label: 'Service',      emoji: '🛠️' },
              { value: 'Repair',       label: 'Repair',       emoji: '🔧' },
              { value: 'Installation', label: 'Installation', emoji: '📦' },
            ].map(({ value, label, emoji }) => (
              <button
                key={value}
                type="button"
                onClick={() => setServiceType(value)}
                className={[
                  'relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all select-none',
                  serviceType === value
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                    : 'border-border bg-gray-50 text-foreground hover:border-amber-300 hover:bg-amber-50/50',
                ].join(' ')}
              >
                {serviceType === value && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                    <span className="text-white text-[9px] font-black">✓</span>
                  </span>
                )}
                <span className="text-2xl">{emoji}</span>
                <span className="text-xs font-bold leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── CUSTOMER DETAILS FORM ─────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-4">
          <p className="text-sm font-bold text-gray-800 border-b border-border/50 pb-2">Customer Details</p>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <span>{ic('iconFullName', '👤')}</span>
              Full Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Enter your full name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* Mobile No. */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <span>{ic('iconMobileNo', '📞')}</span>
              Mobile No. <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="10-digit mobile number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              inputMode="numeric"
              maxLength={13}
              required
            />
          </div>

          {/* House / Flat + Floor row */}
          <div className="grid grid-cols-2 gap-3">
            {/* House No. */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <span>{ic('iconHouseNo', '🏠')}</span>
                House / Flat No.
              </label>
              <Input
                placeholder="e.g. B-204"
                value={houseNo}
                onChange={e => setHouseNo(e.target.value)}
              />
            </div>
            {/* Select Floor */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <span>{ic('iconSelectFloor', '🏢')}</span>
                Select Floor
              </label>
              <Select value={floor} onValueChange={setFloor}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Floor" />
                </SelectTrigger>
                <SelectContent>
                  {FLOOR_OPTIONS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Full Address & Landmark */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <span>{ic('iconFullAddress', '🗺️')}</span>
              Full Address & Landmark
            </label>
            <Textarea
              placeholder="Street, Area, Landmark, City…"
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={3}
            />
          </div>

          {/* GPS Location */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <span>{ic('iconGps', '🎯')}</span>
                GPS Location
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetLocation}
                disabled={gpsLoading}
                className="h-8 px-3 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
              >
                {gpsLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin" />Getting…</>
                  : <><Navigation className="w-3 h-3" />Get Exact Location</>
                }
              </Button>
            </div>
            {gpsError && <p className="text-xs text-destructive">{gpsError}</p>}
            {location && location.startsWith('https://maps.google.com') && (
              <a
                href={location}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline bg-blue-50 border border-blue-200 rounded-lg px-3 py-2"
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{location}</span>
              </a>
            )}
          </div>

          {/* Error message */}
          {submitError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-base h-12"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
              : '📋 Submit Booking'
            }
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground pb-4">
          🔒 Your information is secure and used only for service purposes.
        </p>
      </div>
    </div>
  );
}
