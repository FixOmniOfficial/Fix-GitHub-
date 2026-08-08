import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Alert, ActivityIndicator,
  Dimensions, NativeScrollEvent, NativeSyntheticEvent,
  KeyboardAvoidingView, Linking, Share, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PROF_LABELS: Record<string, string> = {
  ac_technician: 'AC Technician', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber', painter: 'Painter', repair: 'Repair',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TechCustomer { id: number; name: string; phone: string; address?: string; jobType?: string; notes?: string; status: string; rating?: string | null; createdAt: string; }
interface TechReminder { id: number; title: string; note?: string | null; reminderAt?: string | null; ringtone?: string | null; isEnabled: boolean; isDone: boolean; customerName?: string | null; customerPhone?: string | null; createdAt: string; }
interface TechPayment { id: number; customerName: string; customerPhone?: string; jobDescription?: string; amountBilled: number; amountReceived: number; status: string; createdAt: string; }

// ─── API helpers ──────────────────────────────────────────────────────────────
const api = async (path: string, opts?: RequestInit) => {
  const base = process.env.EXPO_PUBLIC_API_URL ?? '';
  const r = await fetch(`${base}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...((opts?.headers as Record<string,string>) ?? {}) },
    ...opts,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data;
};

// ─── Tab labels ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' as const },
  { key: 'customers', label: 'Customers', icon: 'users' as const },
  { key: 'payments',  label: 'Payments',  icon: 'credit-card' as const },
  { key: 'reminders', label: 'Reminders', icon: 'bell' as const },
];

// ═══════════════════════════════════════════════════════════════════════════════
export default function TechnicianHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAppAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [activeTab, setActiveTab] = useState(0);
  const [prefillCustomer, setPrefillCustomer] = useState<{ name: string; phone: string } | null>(null);
  const hScrollRef = useRef<ScrollView>(null);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<TechCustomer[]>([]);
  const [payments, setPayments] = useState<TechPayment[]>([]);
  const [reminders, setReminders] = useState<TechReminder[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const techCode = user?.uniqueCode ?? '';
  const serviceCenterBase = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : (process.env.EXPO_PUBLIC_API_URL ?? '');
  const formUrl = `${serviceCenterBase}/customer-form/${techCode}`;

  // ── Load all data ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!techCode) return;
    setLoadingData(true);
    try {
      const [c, p, r] = await Promise.all([
        api(`/booking/tech-customers?techCode=${techCode}`),
        api(`/booking/tech-payments?techCode=${techCode}`),
        api(`/booking/tech-reminders?techCode=${techCode}`),
      ]);
      setCustomers(Array.isArray(c) ? c : []);
      setPayments(Array.isArray(p) ? p : []);
      setReminders(Array.isArray(r) ? r : []);
    } catch {}
    setLoadingData(false);
  }, [techCode]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Tab navigation ───────────────────────────────────────────────────────────
  const goToTab = (i: number) => {
    setActiveTab(i);
    hScrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
  };

  const onHScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== activeTab) setActiveTab(idx);
  };

  useEffect(() => {
    if (!authLoading && (!user || user.userType !== 'technician')) {
      router.replace('/auth/technician' as any);
    }
  }, [authLoading, user]);

  const s = styles(colors);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user || user.userType !== 'technician') {
    return null;
  }

  // ── Balance summary ──────────────────────────────────────────────────────────
  const totalBilled   = payments.reduce((s, p) => s + Number(p.amountBilled), 0);
  const totalReceived = payments.reduce((s, p) => s + Number(p.amountReceived), 0);
  const totalBalance  = totalBilled - totalReceived;
  const pendingReminders = reminders.filter(r => !r.isDone).length;
  const newCustomers = customers.filter(c => c.status !== 'completed').length;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>

      {/* ── Fixed Header ── */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>नमस्ते, {user.name.split(' ')[0]}! 👋</Text>
          <Text style={s.subGreeting}>{PROF_LABELS[user.professionType ?? ''] ?? 'Technician'} · {user.uniqueCode}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert('Logout', 'Logout करना चाहते हैं?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: logout },
        ])}>
          <Feather name="log-out" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── Tab Bar ── */}
      <View style={s.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity key={tab.key} style={[s.tabItem, activeTab === i && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => goToTab(i)}>
            <Feather name={tab.icon} size={16} color={activeTab === i ? colors.primary : colors.mutedForeground} />
            <Text style={[s.tabLabel, { color: activeTab === i ? colors.primary : colors.mutedForeground }]}>{tab.label}</Text>
            {tab.key === 'reminders' && pendingReminders > 0 && (
              <View style={s.tabBadge}><Text style={s.tabBadgeText}>{pendingReminders}</Text></View>
            )}
            {tab.key === 'customers' && newCustomers > 0 && (
              <View style={[s.tabBadge, { backgroundColor: '#22c55e' }]}><Text style={s.tabBadgeText}>{newCustomers}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Horizontal Pager ── */}
      <ScrollView
        ref={hScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onHScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >

        {/* ══ TAB 0: Dashboard ══════════════════════════════════════════════════ */}
        <ScrollView style={s.page} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 80 }}>

          {/* Balance Overview */}
          <View style={[s.balanceCard, { borderColor: colors.primary + '55' }]}>
            <Text style={s.balanceTitle}>💰 Balance Overview</Text>
            <View style={s.balanceRow}>
              <View style={s.balanceStat}>
                <Text style={[s.balanceNum, { color: '#3b82f6' }]}>₹{totalBilled.toLocaleString('en-IN')}</Text>
                <Text style={s.balanceLabel}>Total Billed</Text>
              </View>
              <View style={s.balanceDivider} />
              <View style={s.balanceStat}>
                <Text style={[s.balanceNum, { color: '#22c55e' }]}>₹{totalReceived.toLocaleString('en-IN')}</Text>
                <Text style={s.balanceLabel}>Received</Text>
              </View>
              <View style={s.balanceDivider} />
              <View style={s.balanceStat}>
                <Text style={[s.balanceNum, { color: totalBalance > 0 ? '#f59e0b' : '#22c55e' }]}>₹{totalBalance.toLocaleString('en-IN')}</Text>
                <Text style={s.balanceLabel}>Pending</Text>
              </View>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={s.statsRow}>
            <TouchableOpacity style={[s.statCard, { borderColor: '#3b82f6' }]} onPress={() => goToTab(1)}>
              <Text style={[s.statNum, { color: '#3b82f6' }]}>{customers.length}</Text>
              <Text style={s.statLabel}>Customers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.statCard, { borderColor: '#22c55e' }]} onPress={() => goToTab(2)}>
              <Text style={[s.statNum, { color: '#22c55e' }]}>{payments.filter(p => p.status === 'paid').length}</Text>
              <Text style={s.statLabel}>Paid</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.statCard, { borderColor: '#f59e0b' }]} onPress={() => goToTab(3)}>
              <Text style={[s.statNum, { color: '#f59e0b' }]}>{pendingReminders}</Text>
              <Text style={s.statLabel}>Reminders</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.actionGrid}>
            <TouchableOpacity style={[s.actionCard, { borderColor: colors.border }]} onPress={() => goToTab(1)}>
              <Text style={{ fontSize: 28 }}>👤</Text>
              <Text style={s.actionLabel}>Customer जोड़ें</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionCard, { borderColor: colors.border }]} onPress={() => goToTab(2)}>
              <Text style={{ fontSize: 28 }}>💳</Text>
              <Text style={s.actionLabel}>Payment Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionCard, { borderColor: colors.border }]} onPress={() => goToTab(3)}>
              <Text style={{ fontSize: 28 }}>🔔</Text>
              <Text style={s.actionLabel}>Reminder Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionCard, { borderColor: colors.border }]} onPress={() => router.push('/technician/form-manager' as any)}>
              <Text style={{ fontSize: 28 }}>📲</Text>
              <Text style={s.actionLabel}>My Form</Text>
            </TouchableOpacity>
          </View>

          {/* Market Rates & Rate the App */}
          <View style={{ gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={[s.infoRow, { borderColor: '#3b82f655', backgroundColor: '#3b82f610' }]}
              onPress={() => router.push('/rates' as any)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 22 }}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.infoRowTitle, { color: colors.foreground }]}>Market Rates</Text>
                <Text style={[s.infoRowSub, { color: colors.mutedForeground }]}>सर्विस की current दरें देखें</Text>
              </View>
              <Text style={{ color: '#3b82f6', fontSize: 18 }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.infoRow, { borderColor: '#f59e0b55', backgroundColor: '#f59e0b10' }]}
              onPress={() => router.push('/rating' as any)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 22 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.infoRowTitle, { color: colors.foreground }]}>Rate the App</Text>
                <Text style={[s.infoRowSub, { color: colors.mutedForeground }]}>ऐप को रेट करें, feedback दें</Text>
              </View>
              <Text style={{ color: '#f59e0b', fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Payments */}
          {payments.slice(0, 3).length > 0 && (
            <>
              <Text style={s.sectionTitle}>Recent Payments</Text>
              {payments.slice(0, 3).map(p => (
                <View key={p.id} style={[s.miniRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniName}>{p.customerName}</Text>
                    <Text style={s.miniSub}>{p.jobDescription ?? '—'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.miniAmt, { color: p.status === 'paid' ? '#22c55e' : '#f59e0b' }]}>₹{Number(p.amountBilled).toLocaleString('en-IN')}</Text>
                    <Text style={{ fontSize: 10, color: p.status === 'paid' ? '#22c55e' : '#f59e0b', fontWeight: '700' }}>{p.status.toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* ══ TAB 1: Customers ══════════════════════════════════════════════════ */}
        <CustomerTab colors={colors} techCode={techCode} customers={customers} setCustomers={setCustomers} insets={insets} formUrl={formUrl}
          onAddReminder={(c) => { setPrefillCustomer({ name: c.name, phone: c.phone }); goToTab(3); }} />

        {/* ══ TAB 2: Payments ══════════════════════════════════════════════════ */}
        <PaymentsTab colors={colors} techCode={techCode} payments={payments} setPayments={setPayments} customers={customers} insets={insets} />

        {/* ══ TAB 3: Reminders ══════════════════════════════════════════════════ */}
        <RemindersTab colors={colors} techCode={techCode} reminders={reminders} setReminders={setReminders} customers={customers} insets={insets} prefillCustomer={prefillCustomer} onPrefillConsumed={() => setPrefillCustomer(null)} />

      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════
function CustomerTab({ colors, techCode, customers, setCustomers, insets, formUrl, onAddReminder }: {
  colors: ReturnType<typeof useColors>;
  techCode: string;
  customers: TechCustomer[];
  setCustomers: React.Dispatch<React.SetStateAction<TechCustomer[]>>;
  insets: any;
  formUrl: string;
  onAddReminder: (c: TechCustomer) => void;
}) {
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [address, setAddress] = useState('');
  const [jobType, setJobType] = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch]   = useState('');
  const [detail, setDetail]   = useState<TechCustomer | null>(null);
  const [editTarget, setEditTarget]   = useState<TechCustomer | null>(null);
  const [editName, setEditName]       = useState('');
  const [editPhone, setEditPhone]     = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editJobType, setEditJobType] = useState('');
  const [editNotes, setEditNotes]     = useState('');
  const [editSaving, setEditSaving]   = useState(false);

  const s = styles(colors);

  // ── Lists ──────────────────────────────────────────────────────────────────
  const filtered = customers.filter(c =>
    search ? (c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)) : true
  );
  const newList  = filtered.filter(c => c.status !== 'completed');
  const doneList = filtered.filter(c => c.status === 'completed');

  // ── Actions ───────────────────────────────────────────────────────────────
  const openWhatsApp = (ph: string) => {
    const clean = ph.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${clean.length === 10 ? '91' + clean : clean}`).catch(() => {});
  };

  const openDialer = (ph: string) => {
    Linking.openURL(`tel:${ph}`).catch(() => {});
  };

  const shareForm = (customer?: TechCustomer) => {
    const msg = `🛠️ *Service Booking Form*\n\nकृपया अपनी बुकिंग confirm करने के लिए यह form भरें:\n👉 ${formUrl}`;
    if (customer) {
      const clean = customer.phone.replace(/\D/g, '');
      Linking.openURL(
        `https://wa.me/${clean.length === 10 ? '91' + clean : clean}?text=${encodeURIComponent(msg)}`
      ).catch(() => Share.share({ message: msg }));
    } else {
      Share.share({ message: msg, url: formUrl }).catch(() => {});
    }
  };

  const markStatus = async (c: TechCustomer, status: 'new' | 'completed') => {
    try {
      await api(`/booking/tech-customers/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));
      setDetail(prev => prev?.id === c.id ? { ...prev, status } : prev);
    } catch { Alert.alert('Error', 'Update नहीं हो सका'); }
  };

  const markRating = async (c: TechCustomer, next: 'good' | 'bad' | null) => {
    try {
      await api(`/booking/tech-customers/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ rating: next }),
      });
      setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, rating: next } : x));
      setDetail(prev => prev?.id === c.id ? { ...prev, rating: next } : prev);
    } catch {}
  };

  const deleteCustomer = (c: TechCustomer) => {
    Alert.alert('Delete', `"${c.name}" को हटाना चाहते हैं?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api(`/booking/tech-customers/${c.id}`, { method: 'DELETE' });
          setCustomers(prev => prev.filter(x => x.id !== c.id));
          setDetail(null);
        } catch { Alert.alert('Error', 'Delete नहीं हो सका'); }
      }},
    ]);
  };

  const save = async () => {
    if (!name.trim())  { Alert.alert('', 'नाम जरूरी है'); return; }
    if (!phone.trim()) { Alert.alert('', 'Phone number जरूरी है'); return; }
    setSaving(true);
    try {
      const res = await api('/booking/tech-customers', {
        method: 'POST',
        body: JSON.stringify({ techCode, name: name.trim(), phone: phone.trim(), address: address.trim(), jobType: jobType.trim(), notes: notes.trim() }),
      });
      setCustomers(prev => [res, ...prev]);
      setName(''); setPhone(''); setAddress(''); setJobType(''); setNotes('');
      setShowForm(false);
      Alert.alert('✅', 'Customer जोड़ा गया!');
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Save नहीं हो सका'); }
    setSaving(false);
  };

  const openEdit = (c: TechCustomer) => {
    setEditTarget(c);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditAddress(c.address ?? '');
    setEditJobType(c.jobType ?? '');
    setEditNotes(c.notes ?? '');
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim())  { Alert.alert('', 'नाम जरूरी है'); return; }
    if (!editPhone.trim()) { Alert.alert('', 'Phone number जरूरी है'); return; }
    setEditSaving(true);
    try {
      const res = await api(`/booking/tech-customers/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(), phone: editPhone.trim(),
          address: editAddress.trim() || null,
          jobType: editJobType.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });
      setCustomers(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...res } : c));
      setDetail(prev => prev?.id === editTarget.id ? { ...prev, ...res } : prev);
      setEditTarget(null);
      Alert.alert('✅', 'Details update हो गई!');
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Update नहीं हो सका'); }
    setEditSaving(false);
  };

  // ── Rating cycle: null → good → bad → null ────────────────────────────────
  const cycleRating = (c: TechCustomer) => {
    const next = c.rating === 'good' ? 'bad' : c.rating === 'bad' ? null : 'good';
    markRating(c, next);
  };
  const ratingEmoji = (r?: string | null) =>
    r === 'good' ? '👍' : r === 'bad' ? '👎' : '😐';
  const ratingColor = (r?: string | null) =>
    r === 'good' ? '#22c55e' : r === 'bad' ? '#ef4444' : colors.mutedForeground + '66';

  // ── Customer row ──────────────────────────────────────────────────────────
  const renderRow = (c: TechCustomer) => (
    <TouchableOpacity
      key={c.id}
      activeOpacity={0.75}
      onPress={() => setDetail(c)}
      style={[s.customerRow, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderLeftColor: c.status !== 'completed' ? colors.primary : '#22c55e',
        borderLeftWidth: 3,
      }]}
    >
      {/* Avatar + rating badge */}
      <View style={{ alignItems: 'center', gap: 4 }}>
        <View style={[s.customerAvatar, { backgroundColor: colors.primary + '22' }]}>
          <Text style={{ fontSize: 20 }}>👤</Text>
        </View>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); cycleRating(c); }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={{ fontSize: 16 }}>{ratingEmoji(c.rating)}</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={s.customerName}>{c.name}</Text>
          {c.status !== 'completed' && (
            <View style={s.newBadge}><Text style={s.newBadgeText}>NEW</Text></View>
          )}
        </View>
        <Text style={s.customerPhone}>📞 {c.phone}</Text>
        {c.jobType ? <Text style={s.customerMeta}>🔧 {c.jobType}</Text> : null}
        {c.address ? <Text style={s.customerMeta} numberOfLines={1}>📍 {c.address}</Text> : null}
      </View>

      {/* Right action icons */}
      <View style={{ gap: 6, alignItems: 'center' }}>
        {/* WhatsApp */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); openWhatsApp(c.phone); }}
          style={[s.rowIconBtn, { backgroundColor: '#25D36622' }]}
        >
          <FontAwesome5 name="whatsapp" size={16} color="#25D366" />
        </TouchableOpacity>

        {/* Call */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); openDialer(c.phone); }}
          style={[s.rowIconBtn, { backgroundColor: '#3b82f618' }]}
        >
          <Feather name="phone" size={14} color="#3b82f6" />
        </TouchableOpacity>

        {/* Form Send */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); shareForm(c); }}
          style={[s.rowIconBtn, { backgroundColor: '#f59e0b18' }]}
        >
          <Feather name="send" size={13} color="#f59e0b" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={{ width: SCREEN_WIDTH, flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Detail Modal ── */}
      <Modal
        visible={!!detail}
        animationType="slide"
        onRequestClose={() => { setDetail(null); setEditTarget(null); }}
      >
        {detail && (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={[s.modalHeader, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => { setDetail(null); setEditTarget(null); }} style={{ padding: 6 }}>
                <Feather name="arrow-left" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Customer Details</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                <TouchableOpacity onPress={() => openEdit(detail)} style={{ padding: 6 }}>
                  <Feather name="edit-2" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setDetail(null); setEditTarget(null); onAddReminder(detail); }}
                  style={{ padding: 6 }}
                >
                  <Feather name="bell" size={18} color="#f59e0b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteCustomer(detail)} style={{ padding: 6 }}>
                  <Feather name="trash-2" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 80 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Status + Rating row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {detail.status !== 'completed'
                  ? <View style={[s.newBadge, { paddingHorizontal: 12, paddingVertical: 5 }]}>
                      <Text style={[s.newBadgeText, { fontSize: 11 }]}>🆕 NEW CUSTOMER</Text>
                    </View>
                  : <View style={s.doneBadge}>
                      <Text style={s.doneBadgeText}>✅ Completed</Text>
                    </View>
                }
                {/* Rating toggle */}
                <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
                  <TouchableOpacity
                    onPress={() => markRating(detail, detail.rating === 'good' ? null : 'good')}
                    style={[s.ratingBtn, { backgroundColor: detail.rating === 'good' ? '#22c55e22' : colors.card, borderColor: detail.rating === 'good' ? '#22c55e' : colors.border }]}
                  >
                    <Text style={{ fontSize: 18 }}>👍</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: detail.rating === 'good' ? '#22c55e' : colors.mutedForeground }}>Good</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => markRating(detail, detail.rating === 'bad' ? null : 'bad')}
                    style={[s.ratingBtn, { backgroundColor: detail.rating === 'bad' ? '#ef444422' : colors.card, borderColor: detail.rating === 'bad' ? '#ef4444' : colors.border }]}
                  >
                    <Text style={{ fontSize: 18 }}>👎</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: detail.rating === 'bad' ? '#ef4444' : colors.mutedForeground }}>Bad</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Name */}
              <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={s.detailLabel}>CUSTOMER NAME</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.foreground, marginTop: 4 }}>{detail.name}</Text>
              </View>

              {/* Contact + actions */}
              <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={s.detailLabel}>CONTACT</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginTop: 4, marginBottom: 12 }}>{detail.phone}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => openDialer(detail.phone)}
                    style={[s.detailActionBtn, { backgroundColor: '#3b82f618', borderColor: '#3b82f6' }]}>
                    <Feather name="phone" size={15} color="#3b82f6" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#3b82f6' }}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openWhatsApp(detail.phone)}
                    style={[s.detailActionBtn, { backgroundColor: '#25D36618', borderColor: '#25D366' }]}>
                    <Text style={{ fontSize: 14 }}>💬</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#25D366' }}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => shareForm(detail)}
                    style={[s.detailActionBtn, { backgroundColor: '#f59e0b18', borderColor: '#f59e0b', flex: 1 }]}>
                    <Feather name="send" size={13} color="#f59e0b" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>Form Send</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Details */}
              {(detail.address || detail.jobType || detail.notes) && (
                <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {detail.jobType ? <View style={{ marginBottom: 10 }}>
                    <Text style={s.detailLabel}>JOB TYPE</Text>
                    <Text style={{ fontSize: 15, color: colors.foreground, marginTop: 3 }}>🔧 {detail.jobType}</Text>
                  </View> : null}
                  {detail.address ? <View style={{ marginBottom: 10 }}>
                    <Text style={s.detailLabel}>ADDRESS</Text>
                    <Text style={{ fontSize: 15, color: colors.foreground, marginTop: 3 }}>📍 {detail.address}</Text>
                  </View> : null}
                  {detail.notes ? <View>
                    <Text style={s.detailLabel}>NOTES</Text>
                    <Text style={{ fontSize: 14, color: colors.foreground, marginTop: 3, lineHeight: 20 }}>{detail.notes}</Text>
                  </View> : null}
                </View>
              )}

              {/* Mark status button */}
              {detail.status !== 'completed' ? (
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#22c55e' }]} onPress={() => markStatus(detail, 'completed')}>
                  <Feather name="check-circle" size={18} color="#fff" />
                  <Text style={[s.saveBtnText, { color: '#fff' }]}>Mark as Completed ✓</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => markStatus(detail, 'new')}>
                  <Feather name="refresh-ccw" size={15} color={colors.mutedForeground} />
                  <Text style={[s.saveBtnText, { color: colors.mutedForeground }]}>Move back to New</Text>
                </TouchableOpacity>
              )}

              {/* Edit form */}
              {editTarget?.id === detail.id && (
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.primary + '88' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={s.formTitle}>✏️ Edit Details</Text>
                    <TouchableOpacity onPress={() => setEditTarget(null)}><Feather name="x" size={18} color={colors.mutedForeground} /></TouchableOpacity>
                  </View>
                  {[
                    { label: 'नाम *', val: editName, set: setEditName, kb: 'default' as const },
                    { label: 'Phone *', val: editPhone, set: setEditPhone, kb: 'phone-pad' as const },
                    { label: 'Address', val: editAddress, set: setEditAddress, kb: 'default' as const },
                    { label: 'Job Type', val: editJobType, set: setEditJobType, kb: 'default' as const },
                  ].map(f => (
                    <View key={f.label} style={{ gap: 4 }}>
                      <Text style={s.fieldLabel}>{f.label}</Text>
                      <TextInput style={s.input} value={f.val} onChangeText={f.set} keyboardType={f.kb}
                        placeholderTextColor={colors.mutedForeground} placeholder={f.label.replace(' *', '')} />
                    </View>
                  ))}
                  <View style={{ gap: 4 }}>
                    <Text style={s.fieldLabel}>Notes</Text>
                    <TextInput style={[s.input, { height: 60, textAlignVertical: 'top' }]} value={editNotes}
                      onChangeText={setEditNotes} multiline placeholderTextColor={colors.mutedForeground} placeholder="Extra details…" />
                  </View>
                  <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary, opacity: editSaving ? 0.7 : 1 }]}
                    onPress={saveEdit} disabled={editSaving}>
                    {editSaving ? <ActivityIndicator color="#000" /> : <><Feather name="check" size={16} color="#000" /><Text style={s.saveBtnText}>Update करें</Text></>}
                  </TouchableOpacity>
                </View>
              )}

            </ScrollView>
          </View>
        )}
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 80 }}>

        {/* ── Top row: Form Send + Add ── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: '#25D366', flex: 1 }]}
            onPress={() => shareForm()} activeOpacity={0.85}>
            <Text style={{ fontSize: 15 }}>💬</Text>
            <Text style={[s.addBtnText, { color: '#fff' }]}>Form Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary, flex: 1 }]}
            onPress={() => setShowForm(v => !v)} activeOpacity={0.85}>
            <Feather name={showForm ? 'x' : 'user-plus'} size={17} color="#000" />
            <Text style={s.addBtnText}>{showForm ? 'बंद करें' : 'जोड़ें'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Add Form ── */}
        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={s.formTitle}>नया Customer जोड़ें</Text>
            {[
              { label: 'नाम *', val: name, set: setName, placeholder: 'Customer का नाम', kb: 'default' as const },
              { label: 'Contact Number *', val: phone, set: setPhone, placeholder: '10-digit mobile number', kb: 'phone-pad' as const },
              { label: 'पता / Address', val: address, set: setAddress, placeholder: 'House, Street, Area', kb: 'default' as const },
              { label: 'Job Type', val: jobType, set: setJobType, placeholder: 'AC Service / Repair / Install…', kb: 'default' as const },
            ].map(f => (
              <View key={f.label} style={{ gap: 4 }}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput style={s.input} placeholder={f.placeholder} placeholderTextColor={colors.mutedForeground}
                  value={f.val} onChangeText={f.set} keyboardType={f.kb} />
              </View>
            ))}
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Notes</Text>
              <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]} placeholder="Extra details…"
                placeholderTextColor={colors.mutedForeground} value={notes} onChangeText={setNotes} multiline />
            </View>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#000" /> : <><Feather name="user-plus" size={16} color="#000" /><Text style={s.saveBtnText}>Save करें</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Search ── */}
        <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput style={s.searchInput} placeholder="नाम या phone से ढूंढें…" placeholderTextColor={colors.mutedForeground}
            value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={15} color={colors.mutedForeground} /></TouchableOpacity> : null}
        </View>

        {/* ── NEW BOOKINGS section ── */}
        {newList.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <View style={[s.newBadge, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                <Text style={[s.newBadgeText, { fontSize: 10 }]}>🆕 NEW CUSTOMER</Text>
              </View>
              <Text style={[s.sectionTitle, { color: colors.primary }]}>({newList.length})</Text>
            </View>
            {newList.map(renderRow)}
          </>
        )}

        {/* ── ALL CONTACTS section ── */}
        {doneList.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: newList.length ? 12 : 4 }}>
              <Feather name="users" size={14} color={colors.mutedForeground} />
              <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>All Contacts ({doneList.length})</Text>
            </View>
            {doneList.map(renderRow)}
          </>
        )}

        {/* ── Empty ── */}
        {filtered.length === 0 && (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="users" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>कोई customer नहीं मिला</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
              "Form Send" से customers form भरेंगे तो यहाँ दिखेंगे
            </Text>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
function PaymentsTab({ colors, techCode, payments, setPayments, customers, insets }: {
  colors: ReturnType<typeof useColors>;
  techCode: string;
  payments: TechPayment[];
  setPayments: React.Dispatch<React.SetStateAction<TechPayment[]>>;
  customers: TechCustomer[];
  insets: any;
}) {
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [billed, setBilled] = useState('');
  const [received, setReceived] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'partial'>('all');

  const s = styles(colors);

  const balance = (parseFloat(billed) || 0) - (parseFloat(received) || 0);

  const computeStatus = (b: number, r: number) => {
    if (r <= 0) return 'pending';
    if (r >= b) return 'paid';
    return 'partial';
  };

  const save = async () => {
    if (!custName.trim()) { Alert.alert('', 'Customer नाम जरूरी है'); return; }
    if (!billed.trim()) { Alert.alert('', 'Billed amount जरूरी है'); return; }
    setSaving(true);
    try {
      const b = parseFloat(billed) || 0;
      const r = parseFloat(received) || 0;
      const res = await api('/booking/tech-payments', {
        method: 'POST',
        body: JSON.stringify({
          techCode, customerName: custName.trim(), customerPhone: custPhone.trim() || undefined,
          jobDescription: jobDesc.trim() || undefined,
          amountBilled: b, amountReceived: r,
          status: computeStatus(b, r),
        }),
      });
      setPayments(prev => [res, ...prev]);
      setCustName(''); setCustPhone(''); setJobDesc(''); setBilled(''); setReceived('');
      setShowForm(false);
      Alert.alert('✅', 'Payment record जोड़ा गया!');
    } catch { Alert.alert('Error', 'Save नहीं हो सका'); }
    setSaving(false);
  };

  const markPaid = async (id: number) => {
    const p = payments.find(x => x.id === id);
    if (!p) return;
    try {
      const res = await api(`/booking/tech-payments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amountReceived: p.amountBilled, status: 'paid' }),
      });
      setPayments(prev => prev.map(x => x.id === id ? res : x));
    } catch {}
  };

  const totalBilled   = payments.reduce((s, p) => s + Number(p.amountBilled), 0);
  const totalReceived = payments.reduce((s, p) => s + Number(p.amountReceived), 0);
  const totalBalance  = totalBilled - totalReceived;

  const filtered = payments.filter(p => filter === 'all' ? true : p.status === filter);

  return (
    <KeyboardAvoidingView style={{ width: SCREEN_WIDTH, flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 80 }}>

        {/* Balance Summary */}
        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.primary + '55' }]}>
          <Text style={[s.summaryTitle, { color: colors.primary }]}>💰 Auto Balance Calculation</Text>
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: '#3b82f6' }]}>₹{totalBilled.toLocaleString('en-IN')}</Text>
              <Text style={s.summaryLabel}>Total Billed</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 18, marginTop: 4 }}>−</Text>
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: '#22c55e' }]}>₹{totalReceived.toLocaleString('en-IN')}</Text>
              <Text style={s.summaryLabel}>Received</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 18, marginTop: 4 }}>=</Text>
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: totalBalance > 0 ? '#f59e0b' : '#22c55e', fontWeight: '900' }]}>
                ₹{totalBalance.toLocaleString('en-IN')}
              </Text>
              <Text style={s.summaryLabel}>Balance Due</Text>
            </View>
          </View>
        </View>

        {/* Add Payment Button */}
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowForm(v => !v)}>
          <Feather name={showForm ? 'x' : 'plus-circle'} size={17} color="#000" />
          <Text style={s.addBtnText}>{showForm ? 'Form बंद करें' : 'नया Payment जोड़ें'}</Text>
        </TouchableOpacity>

        {/* Payment Form */}
        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={s.formTitle}>Payment Details</Text>

            {customers.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={s.fieldLabel}>Customer चुनें (quick fill)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {customers.slice(0, 8).map(c => (
                      <TouchableOpacity key={c.id} style={[s.quickChip, { borderColor: colors.border, backgroundColor: colors.secondary }]}
                        onPress={() => { setCustName(c.name); setCustPhone(c.phone); }}>
                        <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: '600' }}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {[
              { label: 'Customer नाम *', val: custName, set: setCustName, placeholder: 'नाम', kb: 'default' as const },
              { label: 'Phone', val: custPhone, set: setCustPhone, placeholder: 'Phone number', kb: 'phone-pad' as const },
              { label: 'Job Description', val: jobDesc, set: setJobDesc, placeholder: 'AC service, repair…', kb: 'default' as const },
            ].map(f => (
              <View key={f.label} style={{ gap: 4 }}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput style={s.input} placeholder={f.placeholder} placeholderTextColor={colors.mutedForeground}
                  value={f.val} onChangeText={f.set} keyboardType={f.kb} />
              </View>
            ))}

            <View style={s.row2}>
              <View style={[{ flex: 1 }, { gap: 4 }]}>
                <Text style={s.fieldLabel}>Amount Billed (₹) *</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor={colors.mutedForeground}
                  value={billed} onChangeText={setBilled} keyboardType="numeric" />
              </View>
              <View style={[{ flex: 1 }, { gap: 4 }]}>
                <Text style={s.fieldLabel}>Amount Received (₹)</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor={colors.mutedForeground}
                  value={received} onChangeText={setReceived} keyboardType="numeric" />
              </View>
            </View>

            {/* Live Balance Preview */}
            {billed ? (
              <View style={[s.balancePreview, { backgroundColor: balance > 0 ? '#f59e0b22' : '#22c55e22', borderColor: balance > 0 ? '#f59e0b' : '#22c55e' }]}>
                <Feather name={balance > 0 ? 'alert-circle' : 'check-circle'} size={16} color={balance > 0 ? '#f59e0b' : '#22c55e'} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: balance > 0 ? '#f59e0b' : '#22c55e' }}>
                  Balance: ₹{balance.toLocaleString('en-IN')} {balance <= 0 ? '✅ PAID' : '⏳ PENDING'}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Save करें</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={s.filterRow}>
          {(['all', 'pending', 'partial', 'paid'] as const).map(f => (
            <TouchableOpacity key={f} style={[s.filterChip, filter === f && { backgroundColor: colors.primary }]} onPress={() => setFilter(f)}>
              <Text style={[s.filterText, filter === f && { color: '#000' }]}>
                {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : f === 'partial' ? 'Partial' : 'Paid'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="credit-card" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>कोई payment record नहीं</Text>
          </View>
        ) : filtered.map(p => (
          <View key={p.id} style={[s.payRow, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: p.status === 'paid' ? '#22c55e' : p.status === 'partial' ? '#3b82f6' : '#f59e0b' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.payName}>{p.customerName}</Text>
              {p.customerPhone ? <Text style={s.payMeta}>📞 {p.customerPhone}</Text> : null}
              {p.jobDescription ? <Text style={s.payMeta}>🔧 {p.jobDescription}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Text style={{ fontSize: 12, color: '#3b82f6', fontWeight: '700' }}>Billed ₹{Number(p.amountBilled).toLocaleString('en-IN')}</Text>
                <Text style={{ fontSize: 12, color: '#22c55e', fontWeight: '700' }}>Recd ₹{Number(p.amountReceived).toLocaleString('en-IN')}</Text>
                <Text style={{ fontSize: 12, color: '#f59e0b', fontWeight: '700' }}>Bal ₹{(Number(p.amountBilled) - Number(p.amountReceived)).toLocaleString('en-IN')}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={[s.statusBadge, { backgroundColor: p.status === 'paid' ? '#22c55e22' : p.status === 'partial' ? '#3b82f622' : '#f59e0b22' }]}>
                <Text style={[s.statusText, { color: p.status === 'paid' ? '#22c55e' : p.status === 'partial' ? '#3b82f6' : '#f59e0b' }]}>
                  {p.status.toUpperCase()}
                </Text>
              </View>
              {p.status !== 'paid' && (
                <TouchableOpacity style={[s.paidBtn, { borderColor: '#22c55e' }]} onPress={() => markPaid(p.id)}>
                  <Feather name="check" size={12} color="#22c55e" />
                  <Text style={{ fontSize: 10, color: '#22c55e', fontWeight: '700' }}>Mark Paid</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: REMINDERS
// ═══════════════════════════════════════════════════════════════════════════════
// ── Reminder card + action button helpers (outside component to avoid re-creation) ──
function remCardBorder(colors: ReturnType<typeof useColors>, r: TechReminder) {
  return {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: r.isDone ? colors.border : (r.isEnabled ? colors.primary + '44' : colors.border),
    borderLeftWidth: 4,
    borderLeftColor: r.isDone ? '#22c55e' : (r.isEnabled ? colors.primary : colors.mutedForeground + '66'),
    borderRadius: 14,
    padding: 14,
  } as const;
}
function remActionBtn(colors: ReturnType<typeof useColors>, bg?: string) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: bg ?? colors.card,
  } as const;
}

const RINGTONES = [
  { id: 'default', label: '🔔 Default' },
  { id: 'loud',    label: '📣 Loud Alarm' },
  { id: 'melody',  label: '🎵 Melody' },
  { id: 'classic', label: '⏰ Classic' },
  { id: 'horn',    label: '📯 Horn' },
  { id: 'vibrate', label: '📳 Vibrate' },
  { id: 'silent',  label: '🔕 Silent' },
];

function RemindersTab({ colors, techCode, reminders, setReminders, customers, insets, prefillCustomer, onPrefillConsumed }: {
  colors: ReturnType<typeof useColors>;
  techCode: string;
  reminders: TechReminder[];
  setReminders: React.Dispatch<React.SetStateAction<TechReminder[]>>;
  customers: TechCustomer[];
  insets: any;
  prefillCustomer?: { name: string; phone: string } | null;
  onPrefillConsumed?: () => void;
}) {
  const s = styles(colors);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [title,      setTitle]      = useState('');
  const [note,       setNote]       = useState('');
  const [date,       setDate]       = useState('');   // YYYY-MM-DD
  const [time,       setTime]       = useState('');   // HH:MM
  const [ringtone,   setRingtone]   = useState('default');
  const [custSearch, setCustSearch] = useState('');
  const [selCust,    setSelCust]    = useState<TechCustomer | null>(null);
  const [saving,     setSaving]     = useState(false);

  // ── Auto-open form when parent passes a prefill customer ──────────────────
  useEffect(() => {
    if (!prefillCustomer) return;
    setEditId(null);
    setTitle('');
    setNote('');
    setDate('');
    setTime('');
    setRingtone('default');
    const fake: TechCustomer = { id: -1, name: prefillCustomer.name, phone: prefillCustomer.phone, status: '', createdAt: '', rating: null };
    setSelCust(fake);
    setCustSearch(prefillCustomer.name);
    setShowForm(true);
    onPrefillConsumed?.();
  }, [prefillCustomer]);

  const filteredCusts = custSearch.length > 0 && !selCust
    ? customers.filter(c =>
        c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.phone.includes(custSearch)
      ).slice(0, 5)
    : [];

  const resetForm = () => {
    setTitle(''); setNote(''); setDate(''); setTime('');
    setRingtone('default'); setCustSearch(''); setSelCust(null);
    setEditId(null); setShowForm(false);
  };

  const openEdit = (r: TechReminder) => {
    setEditId(r.id);
    setTitle(r.title);
    setNote(r.note ?? '');
    if (r.reminderAt) {
      const [d = '', t = ''] = r.reminderAt.split(' ');
      setDate(d); setTime(t);
    } else { setDate(''); setTime(''); }
    setRingtone(r.ringtone ?? 'default');
    if (r.customerName) {
      const fake = { id: -1, name: r.customerName, phone: r.customerPhone ?? '', status: '', createdAt: '', rating: null };
      setSelCust(fake); setCustSearch(r.customerName);
    } else { setSelCust(null); setCustSearch(''); }
    setShowForm(true);
  };

  const save = async () => {
    const finalTitle = title.trim() || (selCust ? `Payment — ${selCust.name}` : '');
    if (!finalTitle) { Alert.alert('', 'Purpose / title जरूरी है'); return; }
    setSaving(true);
    const reminderAt = date && time ? `${date} ${time}` : (date || time || undefined);
    const body: Record<string, any> = {
      title: finalTitle, note: note.trim() || null,
      reminderAt: reminderAt ?? null, ringtone,
      customerName: selCust?.name ?? null, customerPhone: selCust?.phone ?? null,
    };
    try {
      if (editId) {
        const res = await api(`/booking/tech-reminders/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setReminders(prev => prev.map(r => r.id === editId ? res : r));
      } else {
        const res = await api('/booking/tech-reminders', { method: 'POST', body: JSON.stringify({ techCode, ...body }) });
        setReminders(prev => [res, ...prev]);
      }
      resetForm();
    } catch { Alert.alert('Error', 'Save नहीं हो सका'); }
    setSaving(false);
  };

  const toggleEnabled = async (r: TechReminder) => {
    try {
      const res = await api(`/booking/tech-reminders/${r.id}`, { method: 'PATCH', body: JSON.stringify({ isEnabled: !r.isEnabled }) });
      setReminders(prev => prev.map(x => x.id === r.id ? res : x));
    } catch {}
  };

  const toggleDone = async (r: TechReminder) => {
    try {
      const res = await api(`/booking/tech-reminders/${r.id}`, { method: 'PATCH', body: JSON.stringify({ isDone: !r.isDone }) });
      setReminders(prev => prev.map(x => x.id === r.id ? res : x));
    } catch {}
  };

  const deleteReminder = (id: number) => {
    Alert.alert('Delete?', 'यह reminder हटाना चाहते हैं?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api(`/booking/tech-reminders/${id}`, { method: 'DELETE' });
          setReminders(prev => prev.filter(r => r.id !== id));
        } catch {}
      }},
    ]);
  };

  // ── Reminder card ──────────────────────────────────────────────────────────
  const renderCard = (r: TechReminder) => (
    <View key={r.id} style={[remCardBorder(colors, r), { opacity: r.isDone ? 0.6 : 1 }]}>
      {/* Top row */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 3 }}>
          {(r.customerName || r.customerPhone) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {r.customerName && (
                <View style={{ backgroundColor: colors.primary + '20', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>👤 {r.customerName}</Text>
                </View>
              )}
              {r.customerPhone && (
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>📞 {r.customerPhone}</Text>
              )}
            </View>
          )}
          <Text style={{
            fontSize: 15, fontWeight: '700',
            color: r.isDone ? colors.mutedForeground : colors.foreground,
            textDecorationLine: r.isDone ? 'line-through' : 'none',
          }}>{r.title}</Text>
          {r.note ? <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }} numberOfLines={2}>{r.note}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
            {r.reminderAt ? <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '700' }}>📅 {r.reminderAt}</Text> : null}
            {r.ringtone && r.ringtone !== 'silent' ? (
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                {RINGTONES.find(x => x.id === r.ringtone)?.label ?? '🔔 ' + r.ringtone}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ON/OFF toggle */}
        <TouchableOpacity onPress={() => toggleEnabled(r)} style={{ alignItems: 'center', gap: 3, paddingTop: 2 }}>
          <View style={{
            width: 48, height: 27, borderRadius: 14,
            backgroundColor: r.isEnabled && !r.isDone ? colors.primary : colors.border,
            justifyContent: 'center', paddingHorizontal: 3,
          }}>
            <View style={{
              width: 21, height: 21, borderRadius: 11, backgroundColor: '#fff',
              alignSelf: r.isEnabled && !r.isDone ? 'flex-end' : 'flex-start',
              shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, elevation: 3,
            }} />
          </View>
          <Text style={{ fontSize: 9, fontWeight: '700', color: r.isEnabled && !r.isDone ? colors.primary : colors.mutedForeground }}>
            {r.isEnabled && !r.isDone ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action row */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
        <TouchableOpacity onPress={() => openEdit(r)} style={[remActionBtn(colors, colors.primary + '15'), { flex: 1 }]}>
          <Feather name="edit-2" size={12} color={colors.primary} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleDone(r)} style={[remActionBtn(colors, r.isDone ? colors.card : '#22c55e15'), { flex: 1 }]}>
          <Feather name={r.isDone ? 'refresh-ccw' : 'check-circle'} size={12} color={r.isDone ? colors.mutedForeground : '#22c55e'} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: r.isDone ? colors.mutedForeground : '#22c55e' }}>
            {r.isDone ? 'Reopen' : 'Done ✓'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteReminder(r.id)} style={remActionBtn(colors, '#ef444415')}>
          <Feather name="trash-2" size={13} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const pending   = reminders.filter(r => !r.isDone);
  const completed = reminders.filter(r =>  r.isDone);

  // Web date/time input style
  const webInputStyle = {
    background: '#1e1e1e', color: colors.foreground,
    border: `1.5px solid ${colors.border}`, borderRadius: 10,
    padding: '10px 12px', fontSize: 14, width: '100%', outline: 'none',
    boxSizing: 'border-box',
  } as any;

  return (
    <KeyboardAvoidingView style={{ width: SCREEN_WIDTH, flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 80 }}>

        {/* ── Add / Cancel button ─────────────────────────────────────────── */}
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => showForm ? resetForm() : setShowForm(true)}>
          <Feather name={showForm ? 'x' : 'bell-plus' as any} size={17} color="#000" />
          <Text style={s.addBtnText}>{showForm ? 'Form बंद करें' : 'नया Reminder जोड़ें'}</Text>
        </TouchableOpacity>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.primary + '55', gap: 14 }]}>
            <Text style={[s.formTitle, { color: colors.primary, fontSize: 16 }]}>
              {editId ? '✏️ Reminder Edit करें' : '🔔 नया Reminder'}
            </Text>

            {/* Customer search */}
            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>👤 Customer (optional)</Text>
              <TextInput style={s.input} placeholder="नाम या phone से ढूंढें…"
                placeholderTextColor={colors.mutedForeground}
                value={custSearch}
                onChangeText={t => { setCustSearch(t); if (!t) setSelCust(null); }} />
              {selCust && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '18', borderRadius: 9, padding: 9, gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary }}>
                    ✅ {selCust.name}  📞 {selCust.phone}
                  </Text>
                  <TouchableOpacity onPress={() => { setSelCust(null); setCustSearch(''); }}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              )}
              {filteredCusts.length > 0 && (
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' }}>
                  {filteredCusts.map(c => (
                    <TouchableOpacity key={c.id} onPress={() => { setSelCust(c); setCustSearch(c.name); }}
                      style={{ padding: 11, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground }}>{c.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>📞 {c.phone}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Purpose / Title */}
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>📌 Purpose / Title</Text>
              <TextInput style={s.input} placeholder="e.g. Payment लेना, AC service check…"
                placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
            </View>

            {/* Date + Time */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.fieldLabel}>📅 Date</Text>
                {Platform.OS === 'web'
                  ? <input type="date" value={date} onChange={(e: any) => setDate(e.target.value)} style={webInputStyle} />
                  : <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
                      value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.fieldLabel}>⏰ Time</Text>
                {Platform.OS === 'web'
                  ? <input type="time" value={time} onChange={(e: any) => setTime(e.target.value)} style={webInputStyle} />
                  : <TextInput style={s.input} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground}
                      value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />}
              </View>
            </View>

            {/* Ringtone chips */}
            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>🎵 Ringtone / Alarm Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                {RINGTONES.map(rt => {
                  const active = ringtone === rt.id;
                  return (
                    <TouchableOpacity key={rt.id} onPress={() => setRingtone(rt.id)} style={{
                      paddingHorizontal: 13, paddingVertical: 9, borderRadius: 22, borderWidth: 1.5,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary + '22' : colors.card,
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: active ? '700' : '400',
                        color: active ? colors.primary : colors.mutedForeground }}>{rt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Note */}
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>📝 Note (optional)</Text>
              <TextInput style={[s.input, { height: 76, textAlignVertical: 'top' }]}
                placeholder="Amount, reason, extra details…"
                placeholderTextColor={colors.mutedForeground}
                value={note} onChangeText={setNote} multiline />
            </View>

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>{editId ? '✅ Update करें' : '💾 Save करें'}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pending ─────────────────────────────────────────────────────── */}
        {pending.length > 0 && (
          <Text style={s.sectionTitle}>🔔 Active Reminders ({pending.length})</Text>
        )}
        {pending.map(renderCard)}

        {/* ── Completed ───────────────────────────────────────────────────── */}
        {completed.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>✅ Completed ({completed.length})</Text>
            {completed.map(renderCard)}
          </>
        )}

        {reminders.length === 0 && (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bell-off" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>कोई reminder नहीं</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
              "नया Reminder जोड़ें" tap करें
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  greeting: { fontSize: 20, fontWeight: '800', color: c.foreground },
  subGreeting: { fontSize: 11, color: c.mutedForeground, marginTop: 2 },
  logoutBtn: { padding: 8 },

  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border,
    backgroundColor: c.card,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2,
    borderBottomWidth: 2, borderBottomColor: 'transparent', position: 'relative',
  },
  tabLabel: { fontSize: 10, fontWeight: '700' },
  tabBadge: {
    position: 'absolute', top: 6, right: 8,
    backgroundColor: '#ef4444', width: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  page: { width: SCREEN_WIDTH },

  // Dashboard
  balanceCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 16,
    backgroundColor: c.card,
  },
  balanceTitle: { fontSize: 14, fontWeight: '700', color: c.foreground, marginBottom: 12 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceStat: { flex: 1, alignItems: 'center' },
  balanceNum: { fontSize: 18, fontWeight: '800' },
  balanceLabel: { fontSize: 10, color: c.mutedForeground, marginTop: 2 },
  balanceDivider: { width: 1, height: 36, backgroundColor: c.border },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: c.card, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: c.mutedForeground },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: c.foreground },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '47%', backgroundColor: c.card, borderRadius: 14, borderWidth: 1,
    padding: 16, alignItems: 'center', gap: 8,
  },
  actionLabel: { fontSize: 13, fontWeight: '600', color: c.foreground, textAlign: 'center' },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, padding: 14,
  },
  infoRowTitle: { fontSize: 14, fontWeight: '700' },
  infoRowSub: { fontSize: 11, marginTop: 2 },

  miniRow: { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center' },
  miniName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  miniSub: { fontSize: 12, color: c.mutedForeground },
  miniAmt: { fontSize: 14, fontWeight: '800' },

  // Forms
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13 },
  addBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },

  formCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  formTitle: { fontSize: 15, fontWeight: '700', color: c.foreground },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: c.mutedForeground },
  input: {
    backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: c.foreground,
  },
  row2: { flexDirection: 'row', gap: 10 },
  quickChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },

  saveBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },

  balancePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 10,
  },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.foreground },

  // Summary
  summaryCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 12 },
  summaryTitle: { fontSize: 14, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryNum: { fontSize: 17, fontWeight: '800' },
  summaryLabel: { fontSize: 9, color: c.mutedForeground, marginTop: 2 },

  // Filter
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  filterText: { fontSize: 12, fontWeight: '600', color: c.mutedForeground },

  // Payment row
  payRow: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  payName: { fontSize: 15, fontWeight: '600', color: c.foreground },
  payMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  paidBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },

  // Customer row
  customerRow: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 17, fontWeight: '700', color: c.foreground },
  customerPhone: { fontSize: 14, color: c.mutedForeground, marginTop: 2 },
  customerMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 1 },

  // NEW badge
  newBadge: { backgroundColor: '#22c55e', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  newBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  doneBadge: { backgroundColor: '#22c55e22', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#22c55e55' },
  doneBadgeText: { fontSize: 11, fontWeight: '700', color: '#22c55e' },

  // Row icon button
  rowIconBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // Rating button (in detail modal)
  ratingBtn: { alignItems: 'center', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },

  // Detail modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  detailCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: c.mutedForeground, letterSpacing: 0.8 },
  detailActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: 10, borderWidth: 1.5, paddingVertical: 10,
  },

  // Reminder row
  reminderRow: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reminderCheck: { paddingTop: 2 },
  reminderTitle: { fontSize: 15, fontWeight: '600', color: c.foreground },
  reminderNote: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  reminderDate: { fontSize: 11, fontWeight: '600', marginTop: 4 },

  // Empty
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: c.mutedForeground },
});
