import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Alert, ActivityIndicator,
  Dimensions, NativeScrollEvent, NativeSyntheticEvent,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { getBaseUrl } from '@workspace/api-client-react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PROF_LABELS: Record<string, string> = {
  ac_technician: 'AC Technician', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber', painter: 'Painter', repair: 'Repair',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TechCustomer { id: number; name: string; phone: string; address?: string; jobType?: string; notes?: string; createdAt: string; }
interface TechReminder { id: number; title: string; note?: string; reminderAt?: string; isDone: boolean; createdAt: string; }
interface TechPayment { id: number; customerName: string; customerPhone?: string; jobDescription?: string; amountBilled: number; amountReceived: number; status: string; createdAt: string; }

// ─── API helpers ──────────────────────────────────────────────────────────────
const api = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`${getBaseUrl()}/api${path}`, {
    headers: { 'Content-Type': 'application/json' }, ...opts,
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
  const hScrollRef = useRef<ScrollView>(null);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<TechCustomer[]>([]);
  const [payments, setPayments] = useState<TechPayment[]>([]);
  const [reminders, setReminders] = useState<TechReminder[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const techCode = user?.uniqueCode ?? '';

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
        <CustomerTab colors={colors} techCode={techCode} customers={customers} setCustomers={setCustomers} insets={insets} />

        {/* ══ TAB 2: Payments ══════════════════════════════════════════════════ */}
        <PaymentsTab colors={colors} techCode={techCode} payments={payments} setPayments={setPayments} customers={customers} insets={insets} />

        {/* ══ TAB 3: Reminders ══════════════════════════════════════════════════ */}
        <RemindersTab colors={colors} techCode={techCode} reminders={reminders} setReminders={setReminders} insets={insets} />

      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════
function CustomerTab({ colors, techCode, customers, setCustomers, insets }: {
  colors: ReturnType<typeof useColors>;
  techCode: string;
  customers: TechCustomer[];
  setCustomers: React.Dispatch<React.SetStateAction<TechCustomer[]>>;
  insets: any;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [jobType, setJobType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  const s = styles(colors);

  const save = async () => {
    if (!name.trim()) { Alert.alert('', 'नाम जरूरी है'); return; }
    if (!phone.trim()) { Alert.alert('', 'Phone number जरूरी है'); return; }
    setSaving(true);
    try {
      const res = await api('/booking/tech-customers', {
        method: 'POST',
        body: JSON.stringify({ techCode, name: name.trim(), phone: phone.trim(), address, jobType, notes }),
      });
      setCustomers(prev => [res, ...prev]);
      setName(''); setPhone(''); setAddress(''); setJobType(''); setNotes('');
      setShowForm(false);
      Alert.alert('✅', 'Customer जोड़ा गया!');
    } catch { Alert.alert('Error', 'Save नहीं हो सका'); }
    setSaving(false);
  };

  const filtered = customers.filter(c =>
    search ? (c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)) : true
  );

  return (
    <KeyboardAvoidingView style={{ width: SCREEN_WIDTH, flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 80 }}>

        {/* Add Customer Button */}
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowForm(v => !v)} activeOpacity={0.85}>
          <Feather name={showForm ? 'x' : 'user-plus'} size={17} color="#000" />
          <Text style={s.addBtnText}>{showForm ? 'Form बंद करें' : 'नया Customer जोड़ें'}</Text>
        </TouchableOpacity>

        {/* Form */}
        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={s.formTitle}>Customer Details</Text>
            {[
              { label: 'नाम *', val: name, set: setName, placeholder: 'Customer का नाम', kb: 'default' as const },
              { label: 'Phone *', val: phone, set: setPhone, placeholder: '10-digit number', kb: 'phone-pad' as const },
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
              {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Save करें</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Search */}
        <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput style={s.searchInput} placeholder="नाम या phone से ढूंढें…" placeholderTextColor={colors.mutedForeground}
            value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={15} color={colors.mutedForeground} /></TouchableOpacity> : null}
        </View>

        <Text style={s.sectionTitle}>{filtered.length} Customer{filtered.length !== 1 ? 's' : ''}</Text>

        {filtered.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="users" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>कोई customer नहीं</Text>
          </View>
        ) : filtered.map(c => (
          <View key={c.id} style={[s.customerRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.customerAvatar, { backgroundColor: colors.primary + '22' }]}>
              <Text style={{ fontSize: 18 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.customerName}>{c.name}</Text>
              <Text style={s.customerPhone}>📞 {c.phone}</Text>
              {c.address ? <Text style={s.customerMeta}>📍 {c.address}</Text> : null}
              {c.jobType ? <Text style={s.customerMeta}>🔧 {c.jobType}</Text> : null}
            </View>
          </View>
        ))}
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
function RemindersTab({ colors, techCode, reminders, setReminders, insets }: {
  colors: ReturnType<typeof useColors>;
  techCode: string;
  reminders: TechReminder[];
  setReminders: React.Dispatch<React.SetStateAction<TechReminder[]>>;
  insets: any;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const s = styles(colors);

  const save = async () => {
    if (!title.trim()) { Alert.alert('', 'Reminder title जरूरी है'); return; }
    setSaving(true);
    try {
      const res = await api('/booking/tech-reminders', {
        method: 'POST',
        body: JSON.stringify({ techCode, title: title.trim(), note: note.trim() || undefined, reminderAt: reminderAt.trim() || undefined }),
      });
      setReminders(prev => [res, ...prev]);
      setTitle(''); setNote(''); setReminderAt('');
      setShowForm(false);
    } catch { Alert.alert('Error', 'Save नहीं हो सका'); }
    setSaving(false);
  };

  const toggleDone = async (id: number, isDone: boolean) => {
    try {
      const res = await api(`/booking/tech-reminders/${id}`, { method: 'PATCH', body: JSON.stringify({ isDone: !isDone }) });
      setReminders(prev => prev.map(r => r.id === id ? res : r));
    } catch {}
  };

  const deleteReminder = async (id: number) => {
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

  const pending   = reminders.filter(r => !r.isDone);
  const completed = reminders.filter(r =>  r.isDone);

  return (
    <KeyboardAvoidingView style={{ width: SCREEN_WIDTH, flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 80 }}>

        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowForm(v => !v)}>
          <Feather name={showForm ? 'x' : 'bell-plus' as any} size={17} color="#000" />
          <Text style={s.addBtnText}>{showForm ? 'Form बंद करें' : 'नया Reminder जोड़ें'}</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={s.formTitle}>Reminder</Text>
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Title *</Text>
              <TextInput style={s.input} placeholder="Reminder का नाम" placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Note (optional)</Text>
              <TextInput style={[s.input, { height: 68, textAlignVertical: 'top' }]} placeholder="Extra details…" placeholderTextColor={colors.mutedForeground} value={note} onChangeText={setNote} multiline />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Date / Time (optional)</Text>
              <TextInput style={s.input} placeholder="e.g. 10 Aug 2:00 PM" placeholderTextColor={colors.mutedForeground} value={reminderAt} onChangeText={setReminderAt} />
            </View>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Save करें</Text>}
            </TouchableOpacity>
          </View>
        )}

        {pending.length > 0 && <Text style={s.sectionTitle}>🔔 Pending ({pending.length})</Text>}
        {pending.map(r => (
          <View key={r.id} style={[s.reminderRow, { backgroundColor: colors.card, borderColor: '#f59e0b55', borderLeftColor: '#f59e0b', borderLeftWidth: 4 }]}>
            <TouchableOpacity style={s.reminderCheck} onPress={() => toggleDone(r.id, r.isDone)}>
              <Feather name="circle" size={22} color="#f59e0b" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.reminderTitle}>{r.title}</Text>
              {r.note ? <Text style={s.reminderNote}>{r.note}</Text> : null}
              {r.reminderAt ? <Text style={[s.reminderDate, { color: colors.primary }]}>📅 {r.reminderAt}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => deleteReminder(r.id)} style={{ padding: 4 }}>
              <Feather name="trash-2" size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}

        {completed.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>✅ Done ({completed.length})</Text>
            {completed.map(r => (
              <View key={r.id} style={[s.reminderRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.5 }]}>
                <TouchableOpacity style={s.reminderCheck} onPress={() => toggleDone(r.id, r.isDone)}>
                  <Feather name="check-circle" size={22} color="#22c55e" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[s.reminderTitle, { textDecorationLine: 'line-through', color: colors.mutedForeground }]}>{r.title}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteReminder(r.id)} style={{ padding: 4 }}>
                  <Feather name="trash-2" size={15} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {reminders.length === 0 && (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bell-off" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>कोई reminder नहीं</Text>
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
  customerName: { fontSize: 15, fontWeight: '600', color: c.foreground },
  customerPhone: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  customerMeta: { fontSize: 11, color: c.mutedForeground, marginTop: 1 },

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
