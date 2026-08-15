import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Alert, ActivityIndicator,
  Dimensions, NativeScrollEvent, NativeSyntheticEvent,
  KeyboardAvoidingView, Linking, Share, Modal, Image, Pressable,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
import ReminderModal, { ReminderTarget } from '@/components/ReminderModal';
import CallerIdBanner from '@/components/CallerIdBanner';
import CallerIdPermissionSheet from '@/components/CallerIdPermissionSheet';
import RecentCustomerCalls from '@/components/RecentCustomerCalls';
import { useCallerIdPermission } from '@/hooks/useCallerIdPermission';
import { useCallHistory } from '@/hooks/useCallHistory';
import { useCallerDetection } from '@/hooks/useCallerDetection';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PROF_LABELS: Record<string, string> = {
  ac_technician: 'AC Technician', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber', painter: 'Painter', repair: 'Repair',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TechCustomer { id: number; name: string; phone: string; address?: string; jobType?: string; notes?: string; status: string; rating?: string | null; createdAt: string; }
interface TechReminder { id: number; title: string; note?: string | null; reminderAt?: string | null; ringtone?: string | null; isEnabled: boolean; isDone: boolean; customerName?: string | null; customerPhone?: string | null; createdAt: string; }
interface PaymentEntry { id: number; paymentId: number; amount: number; paymentMethod: string; paidAt: string; note?: string | null; createdAt: string; }
interface TechPayment { id: number; customerName: string; customerPhone?: string; jobDescription?: string; amountBilled: number; amountReceived: number; status: string; createdAt: string; entries: PaymentEntry[]; }

// ─── API helpers ──────────────────────────────────────────────────────────────
// Cross-platform delete confirmation
// Web  → window.confirm (browser native dialog)
// Native → Alert.alert  (React Native dialog)
const confirmDelete = (message: string): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise(resolve => {
    Alert.alert('🗑️ Delete?', message, [
      { text: 'No',  style: 'cancel',      onPress: () => resolve(false) },
      { text: 'Yes', style: 'destructive', onPress: () => resolve(true)  },
    ]);
  });
};

const api = async (path: string, opts?: RequestInit) => {
  const base = process.env.EXPO_PUBLIC_API_URL ?? '';
  const r = await fetch(`${base}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...((opts?.headers as Record<string,string>) ?? {}) },
    ...opts,
  });
  if (r.status === 204) return null;          // No Content — DELETE responses
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data;
};

// ─── Tab labels ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home'         as const },
  { key: 'customers', label: 'Customers', icon: 'users'        as const },
  { key: 'payments',  label: 'Payments',  icon: 'credit-card'  as const },
  { key: 'reminders', label: 'Reminders', icon: 'bell'         as const },
];

// ─── KYC Status Card ─────────────────────────────────────────────────────────
// Inline mini-component — shows KYC status on the dashboard tab
function KycStatusCard({ techCode, router }: { techCode: string; router: ReturnType<typeof useRouter> }) {
  const [status, setStatus] = React.useState<string | null>(null);
  useEffect(() => {
    if (!techCode) return;
    fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ''}/api/kyc/status`, {
      headers: { 'X-Tech-Code': techCode },
    })
      .then(r => r.json())
      .then(d => setStatus(d.status ?? 'not_submitted'))
      .catch(() => setStatus('not_submitted'));
  }, [techCode]);

  if (status === null) return null; // loading

  const KYC_COLORS: Record<string, { bg: string; border: string; icon: string; label: string; color: string }> = {
    not_submitted: { bg: '#1e293b', border: '#475569', icon: '📋', label: 'KYC Not Submitted',   color: '#94a3b8' },
    pending:       { bg: '#1c1000', border: '#78350f', icon: '⏳', label: 'KYC Under Review',    color: '#f59e0b' },
    verified:      { bg: '#022c22', border: '#065f46', icon: '✅', label: 'KYC Verified',         color: '#10b981' },
    rejected:      { bg: '#1c0010', border: '#9f1239', icon: '❌', label: 'KYC Rejected',         color: '#f43f5e' },
  };
  const cfg = KYC_COLORS[status] ?? KYC_COLORS.not_submitted;
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border, borderRadius: 12, padding: 12 }}
      onPress={() => router.push('/technician/kyc' as any)}
      activeOpacity={0.8}
    >
      <Text style={{ fontSize: 22, marginRight: 10 }}>{cfg.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 13, color: cfg.color }}>{cfg.label}</Text>
        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          {status === 'verified' ? 'Identity verified — you can receive bookings' :
           status === 'pending'  ? 'Documents under review — update coming soon' :
           status === 'rejected' ? 'Documents rejected — please resubmit' :
                                   'Verify your identity — tap here'}
        </Text>
      </View>
      <Text style={{ color: cfg.color, fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Tab index constants ───────────────────────────────────────────────────────
// Single source of truth — all goToTab() calls must use these, never raw numbers.
// If TABS order ever changes, update ONLY this object; everywhere else auto-corrects.
const TAB = {
  DASHBOARD: 0,   // 🏠  home icon
  CUSTOMERS: 1,   // 👤  users icon  → customer list + add
  PAYMENTS:  2,   // 💳  credit-card → payment tracking
  REMINDERS: 3,   // 🔔  bell        → reminder management
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
export default function TechnicianHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, updateUser, loading: authLoading } = useAppAuth();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);     // local URI — for preview
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null); // server URL — for saving
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pendingNameError, setPendingNameError] = useState('');
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  // Fetch KYC status for verified badge
  useEffect(() => {
    if (!user?.uniqueCode) return;
    fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ''}/api/kyc/status`, {
      headers: { 'X-Tech-Code': user.uniqueCode },
    })
      .then(r => r.json())
      .then(d => setKycStatus(d.status ?? 'not_submitted'))
      .catch(() => setKycStatus('not_submitted'));
  }, [user?.uniqueCode]);

  const ALPHA_ONLY = /^[a-zA-Z\s]*$/;

  const handlePendingNameChange = (text: string) => {
    setPendingName(text);
    if (text && !ALPHA_ONLY.test(text)) {
      setPendingNameError('Numbers and special characters are not allowed in the Name field.');
    } else {
      setPendingNameError('');
    }
  };

  const openEditProfile = () => {
    setPendingName(user?.name ?? '');
    setPendingAvatar(null);
    setPendingAvatarUrl(null);
    setPendingNameError('');
    setEditModalVisible(true);
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required', 'Photo library access is needed to change your picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      // 1. Compress to 400×400 JPEG and capture base64 directly — no file URI
      //    needed; avoids multipart FormData parsing issues in RN fetch.
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!compressed.base64) throw new Error('Compression produced no base64 data');

      // 2. POST as JSON to the base64 upload endpoint
      const apiBase = process.env.EXPO_PUBLIC_API_URL ?? '';
      const uploadRes = await fetch(`${apiBase}/api/storage/uploads/base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tech-Code': user?.uniqueCode ?? '',
        },
        body: JSON.stringify({ data: compressed.base64, contentType: 'image/jpeg' }),
      });
      const json = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error((json as any).error ?? 'Upload failed');
      const { objectPath } = json as { objectPath: string };

      // 3. Build the public (no-auth) serving URL for avatar images
      //    objectPath = "/objects/<uuid>" → serve via /api/public/avatar/<uuid>
      const objectId = String(objectPath).replace(/^\/objects\//, '');
      // Build absolute URL: EXPO_PUBLIC_API_URL (if set) or fall back to EXPO_PUBLIC_DOMAIN
      const domain = process.env.EXPO_PUBLIC_DOMAIN ?? '';
      const base = apiBase || (domain ? `https://${domain}` : '');
      const publicUrl = `${base}/api/public/avatar/${objectId}`;

      // pendingAvatar = local file URI so ExpoImage can preview it instantly.
      // pendingAvatarUrl = absolute server URL that gets saved to the DB.
      setPendingAvatar(compressed.uri);
      setPendingAvatarUrl(publicUrl);
    } catch (err: any) {
      Alert.alert('Upload failed', `Photo could not be uploaded: ${err?.message ?? 'Please retry.'}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveEditProfile = async () => {
    const trimmedName = pendingName.trim();
    if (!trimmedName) return;
    if (pendingNameError) return;
    if (!ALPHA_ONLY.test(trimmedName)) {
      setPendingNameError('Numbers and special characters are not allowed in the Name field.');
      return;
    }
    const nameChanged = trimmedName !== user?.name;
    // Auto-revoke verified badge if name changes
    if (nameChanged && kycStatus === 'verified') {
      const proceed = await new Promise<boolean>(resolve =>
        Alert.alert(
          '⚠️ Verified Badge Will Be Revoked',
          'Changing your name will remove your Verified badge. You will need to re-submit your identity documents to get verified again under the new name.\n\nContinue?',
          [
            { text: 'Keep Old Name', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Change Name', style: 'destructive', onPress: () => resolve(true) },
          ]
        )
      );
      if (!proceed) return;
    }
    setSavingProfile(true);
    try {
      const updates: { name?: string; avatar?: string } = {};
      if (nameChanged) updates.name = trimmedName;
      // Use the absolute server URL for both local context and DB, not the local file URI
      if (pendingAvatarUrl) updates.avatar = pendingAvatarUrl;
      else if (pendingAvatar && !pendingAvatarUrl) updates.avatar = pendingAvatar; // fallback
      // Apply locally
      if (Object.keys(updates).length > 0) updateUser(updates);
      // Persist to server
      const apiBase = process.env.EXPO_PUBLIC_API_URL ?? '';
      const body: Record<string, string> = { uniqueCode: user?.uniqueCode ?? '' };
      if (updates.name) body.name = updates.name;
      if (pendingAvatarUrl) body.avatarUrl = pendingAvatarUrl;
      else if (updates.avatar) body.avatarUrl = updates.avatar;
      if (Object.keys(body).length > 1) {
        const res = await fetch(`${apiBase}/api/booking/technician/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.avatarUrl) updateUser({ avatar: data.avatarUrl });
        }
      }
      // Auto-revoke KYC on name change
      if (nameChanged && kycStatus === 'verified') {
        await fetch(`${apiBase}/api/kyc/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uniqueCode: user?.uniqueCode }),
        }).catch(() => {});
        setKycStatus('not_submitted');
      }
    } catch {
      // Network failure — local changes are kept via AsyncStorage
    } finally {
      setSavingProfile(false);
      setEditModalVisible(false);
    }
  };
  const topPad = insets.top;

  const [activeTab, setActiveTab] = useState(0);
  const [prefillCustomer, setPrefillCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [prefillPayment,  setPrefillPayment]  = useState<{ name: string; phone: string } | null>(null);
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
  // ── Primary branded booking URL ─────────────────────────────────────────────
  const formUrl = `${serviceCenterBase}/book/${techCode}`;

  const [appName, setAppName] = useState('ProBook');

  // ── Format professionType → readable category ────────────────────────────────
  const CATEGORY_LABELS: Record<string, string> = {
    ac_technician: 'AC Technician', electrician: 'Electrician',
    carpenter: 'Carpenter', plumber: 'Plumber', painter: 'Painter', repair: 'Repair',
  };
  const techCategory = user?.professionType
    ? (CATEGORY_LABELS[user.professionType] ?? user.professionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    : 'Technician';

  // ── Load all data ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!techCode) return;
    setLoadingData(true);
    try {
      const [c, p, r, appSettings] = await Promise.all([
        api(`/booking/tech-customers?techCode=${techCode}`),
        api(`/booking/tech-payments?techCode=${techCode}`),
        api(`/booking/tech-reminders?techCode=${techCode}`),
        fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ''}/api/public/app-settings`).then(r => r.json()).catch(() => null),
      ]);
      setCustomers(Array.isArray(c) ? c : []);
      setPayments(Array.isArray(p) ? p : []);
      setReminders(Array.isArray(r) ? r : []);
      if (appSettings?.appName) setAppName(appSettings.appName);
    } catch {}
    setLoadingData(false);
  }, [techCode]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Caller ID ────────────────────────────────────────────────────────────────
  const {
    isGranted: callerIdGranted,
    showRationale,
    requestPermission,
    dismissRationale,
  } = useCallerIdPermission();

  const { history: callHistory, addEntry, clearHistory } = useCallHistory();

  const { incomingCall, dismissBanner } = useCallerDetection(
    customers,
    callerIdGranted,
    addEntry
  );

  // ── Tab navigation ───────────────────────────────────────────────────────────
  // Always call goToTab(TAB.XXX) — never pass raw numbers.
  const goToTab = (i: number) => {
    setActiveTab(i);
    // Use animated:false so onScroll fires synchronously and keeps indicator in sync
    hScrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: false });
  };

  // Fired on every scroll frame (swipe) — keeps tab indicator in sync with finger position
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

      {/* ── Edit Profile Modal (name + photo, both saved together) ── */}
      <Modal visible={editModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditModalVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 32 }} onPress={() => setEditModalVisible(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.background, borderRadius: 20, padding: 24, width: '100%', gap: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.foreground }}>Edit Profile</Text>

            {/* Avatar picker */}
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={{ alignSelf: 'center' }} disabled={uploadingAvatar}>
              <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.primary, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>
                {uploadingAvatar ? (
                  <ActivityIndicator color={colors.primary} size="large" />
                ) : (pendingAvatar ?? user?.avatar) ? (
                  <ExpoImage
                    source={{ uri: pendingAvatar ?? user?.avatar ?? undefined }}
                    style={{ width: 80, height: 80 }}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: 80, height: 80, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#000' }}>
                      {(user?.name || '?').trim()[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
              </View>
              {!uploadingAvatar && (
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="camera" size={13} color="#000" />
                </View>
              )}
            </TouchableOpacity>
            {uploadingAvatar && (
              <Text style={{ textAlign: 'center', fontSize: 12, color: colors.primary, marginTop: -8 }}>Uploading photo…</Text>
            )}
            {pendingAvatar && !uploadingAvatar && (
              <Text style={{ textAlign: 'center', fontSize: 12, color: '#22c55e', marginTop: -8 }}>✓ Photo uploaded — tap Save to apply</Text>
            )}

            {/* Name input */}
            <View style={{ gap: 4 }}>
              <TextInput
                style={{ backgroundColor: colors.card, borderWidth: 1.5, borderColor: pendingNameError ? '#ef4444' : colors.primary, borderRadius: 12, padding: 14, fontSize: 16, color: colors.foreground }}
                value={pendingName} onChangeText={handlePendingNameChange}
                placeholder="Your name (letters only)" placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
              />
              {pendingNameError ? <Text style={{ color: '#ef4444', fontSize: 12, paddingHorizontal: 4 }}>{pendingNameError}</Text> : null}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 13, alignItems: 'center' }} onPress={() => setEditModalVisible(false)} disabled={savingProfile || uploadingAvatar}>
                <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, borderRadius: 12, backgroundColor: colors.primary, paddingVertical: 13, alignItems: 'center', opacity: (savingProfile || uploadingAvatar) ? 0.7 : 1 }} onPress={saveEditProfile} disabled={savingProfile || uploadingAvatar}>
                {savingProfile
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={{ color: '#000', fontWeight: '800' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Fixed Header ── */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        {/* Avatar — shows photo or name initial */}
        <View style={[s.profileAvatar, { borderColor: colors.primary }]}>
          {user.avatar
            ? <ExpoImage
                source={{ uri: user.avatar }}
                style={s.profileAvatarImg}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
            : <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#000' }}>
                  {(user.name || '?').trim()[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
          }
        </View>

        {/* Name + verified badge + sub-info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.greeting} numberOfLines={1}>{user.name}</Text>
            {kycStatus === 'verified' && (
              <View style={{ backgroundColor: '#1d4ed8', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="check" size={11} color="#fff" />
              </View>
            )}
            {activeTab === 0 && (
              <TouchableOpacity onPress={openEditProfile} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="edit-2" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.subGreeting}>{PROF_LABELS[user.professionType ?? ''] ?? 'Technician'} · {user.uniqueCode}</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={async () => {
            const ok = Platform.OS === 'web'
              ? window.confirm('Are you sure you want to logout?')
              : await new Promise<boolean>(resolve =>
                  Alert.alert('Logout', 'Are you sure you want to logout?', [
                    { text: 'No',  style: 'cancel',      onPress: () => resolve(false) },
                    { text: 'Yes', style: 'destructive', onPress: () => resolve(true)  },
                  ])
                );
            if (!ok) return;
            await logout();
            router.replace('/auth/technician' as any);
          }}
        >
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

      {/* ── Caller ID Banner — absolutely positioned, Android-only ── */}
      <CallerIdBanner incomingCall={incomingCall} onDismiss={dismissBanner} />

      {/* ── Caller ID Permission Rationale Sheet ── */}
      <CallerIdPermissionSheet
        visible={showRationale}
        onEnable={requestPermission}
        onDismiss={dismissRationale}
      />

      {/* ── Horizontal Pager ── */}
      {/* onScroll (not onMomentumScrollEnd) keeps indicator in sync on both
          manual swipe AND programmatic goToTab() with animated:false        */}
      <ScrollView
        ref={hScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onHScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >

        {/* ══ TAB 0: Dashboard ══════════════════════════════════════════════════ */}
        <ScrollView style={s.page} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 140 }}>

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

          {/* Quick Stats — each card navigates to its exact tab */}
          <View style={s.statsRow}>
            <TouchableOpacity style={[s.statCard, { borderColor: '#3b82f6' }]} onPress={() => goToTab(TAB.CUSTOMERS)}>
              <Text style={[s.statNum, { color: '#3b82f6' }]}>{customers.length}</Text>
              <Text style={s.statLabel}>Customers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.statCard, { borderColor: '#22c55e' }]} onPress={() => goToTab(TAB.PAYMENTS)}>
              <Text style={[s.statNum, { color: '#22c55e' }]}>{payments.filter(p => p.status === 'paid').length}</Text>
              <Text style={s.statLabel}>Paid</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.statCard, { borderColor: '#f59e0b' }]} onPress={() => goToTab(TAB.REMINDERS)}>
              <Text style={[s.statNum, { color: '#f59e0b' }]}>{pendingReminders}</Text>
              <Text style={s.statLabel}>Reminders</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Actions — each action card routes to exactly its own tab */}
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.actionGrid}>
            <TouchableOpacity style={[s.actionCard, { borderColor: colors.border }]} onPress={() => goToTab(TAB.CUSTOMERS)}>
              <Text style={{ fontSize: 28 }}>👤</Text>
              <Text style={s.actionLabel}>Add Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionCard, { borderColor: colors.border }]} onPress={() => goToTab(TAB.PAYMENTS)}>
              <Text style={{ fontSize: 28 }}>💳</Text>
              <Text style={s.actionLabel}>Payment Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionCard, { borderColor: colors.border }]} onPress={() => goToTab(TAB.REMINDERS)}>
              <Text style={{ fontSize: 28 }}>🔔</Text>
              <Text style={s.actionLabel}>Reminder Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionCard, { borderColor: colors.border }]} onPress={() => router.push('/technician/form-manager' as any)}>
              <Text style={{ fontSize: 28 }}>📲</Text>
              <Text style={s.actionLabel}>My Form</Text>
            </TouchableOpacity>
          </View>

          {/* KYC Verification Card */}
          <KycStatusCard techCode={techCode} router={router} />

          {/* ── Recent Customer Calls — Caller ID history (Android only) ── */}
          <RecentCustomerCalls
            history={callHistory}
            isGranted={callerIdGranted}
            onEnablePress={requestPermission}
            onClearHistory={clearHistory}
          />

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
                <Text style={[s.infoRowSub, { color: colors.mutedForeground }]}>View current service rates</Text>
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
                <Text style={[s.infoRowSub, { color: colors.mutedForeground }]}>Rate the app, share feedback</Text>
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
        {/* 💳 credit-card icon → TAB.PAYMENTS  |  🔔 bell icon → TAB.REMINDERS */}
        <CustomerTab
          colors={colors} techCode={techCode}
          techName={user?.name ?? 'Technician'}
          techCategory={techCategory} appName={appName}
          customers={customers} setCustomers={setCustomers}
          insets={insets} formUrl={formUrl}
          onAddReminder={(c) => { setPrefillCustomer({ name: c.name, phone: c.phone }); goToTab(TAB.REMINDERS); }}
          onAddPayment={(c)  => { setPrefillPayment({ name: c.name, phone: c.phone });  goToTab(TAB.PAYMENTS);  }} />

        {/* ══ TAB 2: Payments ══════════════════════════════════════════════════ */}
        <PaymentsTab colors={colors} techCode={techCode} payments={payments} setPayments={setPayments} customers={customers} insets={insets} prefillPayment={prefillPayment} onPrefillConsumed={() => setPrefillPayment(null)} />

        {/* ══ TAB 3: Reminders ══════════════════════════════════════════════════ */}
        <RemindersTab colors={colors} techCode={techCode} reminders={reminders} setReminders={setReminders} customers={customers} insets={insets} prefillCustomer={prefillCustomer} onPrefillConsumed={() => setPrefillCustomer(null)} />

      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════
function CustomerTab({ colors, techCode, techName, techCategory, appName, customers, setCustomers, insets, formUrl, onAddReminder, onAddPayment }: {
  colors: ReturnType<typeof useColors>;
  techCode: string;
  techName: string;
  techCategory: string;
  appName: string;
  customers: TechCustomer[];
  setCustomers: React.Dispatch<React.SetStateAction<TechCustomer[]>>;
  insets: any;
  formUrl: string;
  onAddReminder: (c: TechCustomer) => void;
  onAddPayment:  (c: TechCustomer) => void;
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

  // ── Inline quick-action state (Payment / Reminder mini-forms inside modal) ──
  const [inlineAction, setInlineAction] = useState<'payment' | 'reminder' | null>(null);
  // Payment form
  const [inlAmt,   setInlAmt]   = useState('');
  const [inlJob,   setInlJob]   = useState('');
  // Reminder modal
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null);
  const [lastSavedCust,  setLastSavedCust]  = useState<ReminderTarget | null>(null); // for "add reminder?" after add
  const [inlSaving,  setInlSaving]  = useState(false);

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
    const msg =
      `Fix Omni App\n\n` +
      `👤 ${techName}\n` +
      `🛠️ ${techCategory} | ID: ${techCode}\n\n` +
      `👉 Service Booking Form Link:\n` +
      `${formUrl}\n\n` +
      `📝 कृपया अपनी सर्विस बुक करने के लिए ऊपर दिए गए लिंक पर क्लिक करें और अपना एड्रेस और लोकेशन भरें।`;
    if (customer) {
      const clean = customer.phone.replace(/\D/g, '');
      Linking.openURL(
        `https://wa.me/${clean.length === 10 ? '91' + clean : clean}?text=${encodeURIComponent(msg)}`
      ).catch(() => Share.share({ message: msg }));
    } else {
      // Do NOT pass url separately — it would append the link a second time
      Share.share({ message: msg }).catch(() => {});
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
    } catch { Alert.alert('Error', 'Update failed'); }
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

  const deleteCustomer = async (c: TechCustomer) => {
    const ok = await confirmDelete(`Permanently delete "${c.name}"?`);
    if (!ok) return;
    try {
      await api(`/booking/tech-customers/${c.id}`, { method: 'DELETE' });
      setCustomers(prev => prev.filter(x => x.id !== c.id));
      setDetail(null);
    } catch { Alert.alert('Error', 'Delete failed'); }
  };

  // ── Inline Payment save (stays inside modal, no tab switch) ────────────────
  const saveInlinePayment = async () => {
    if (!inlAmt.trim() || isNaN(parseFloat(inlAmt))) { Alert.alert('', 'Amount is required'); return; }
    setInlSaving(true);
    try {
      await api('/booking/tech-payments', {
        method: 'POST',
        body: JSON.stringify({
          techCode,
          customerName: detail!.name,
          customerPhone: detail!.phone,
          jobDescription: inlJob.trim() || undefined,
          amountBilled: parseFloat(inlAmt),
          amountReceived: 0,
          status: 'pending',
        }),
      });
      setInlAmt(''); setInlJob(''); setInlineAction(null);
      Alert.alert('✅', 'Payment record added!');
    } catch { Alert.alert('Error', 'Save failed'); }
    setInlSaving(false);
  };

  // ── Open reminder modal for a customer ────────────────────────────────────
  const openReminder = (c: { name: string; phone: string; notes?: string | null }) => {
    setReminderTarget({ name: c.name, phone: c.phone, notes: c.notes });
  };

  const save = async () => {
    if (!name.trim())  { Alert.alert('', 'Name is required'); return; }
    if (!phone.trim()) { Alert.alert('', 'Phone number is required'); return; }
    setSaving(true);
    try {
      const res = await api('/booking/tech-customers', {
        method: 'POST',
        body: JSON.stringify({ techCode, name: name.trim(), phone: phone.trim(), address: address.trim(), jobType: jobType.trim(), notes: notes.trim() }),
      });
      setCustomers(prev => [res, ...prev]);
      const saved = { name: name.trim(), phone: phone.trim(), notes: notes.trim() };
      setName(''); setPhone(''); setAddress(''); setJobType(''); setNotes('');
      setShowForm(false);
      setLastSavedCust(saved); // show "Set Reminder?" prompt
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Save failed'); }
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
    if (!editName.trim())  { Alert.alert('', 'Name is required'); return; }
    if (!editPhone.trim()) { Alert.alert('', 'Phone number is required'); return; }
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
      Alert.alert('✅', 'Details updated!');
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Update failed'); }
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
    // Outer container is a plain View — no outer TouchableOpacity means
    // icon taps can NEVER bubble up and accidentally open the detail modal.
    <View
      key={c.id}
      style={[s.customerRow, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderLeftColor: c.status !== 'completed' ? colors.primary : '#22c55e',
        borderLeftWidth: 3,
        flexDirection: 'row',
        alignItems: 'center',
      }]}
    >
      {/* ── Left tappable zone: avatar + info → opens detail ── */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setDetail(c)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        {/* Avatar + rating badge */}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={[s.customerAvatar, { backgroundColor: colors.primary + '22' }]}>
            <Text style={{ fontSize: 20 }}>👤</Text>
          </View>
          {/* Rating — inner TouchableOpacity wins over outer one natively */}
          <TouchableOpacity
            onPress={() => cycleRating(c)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
      </TouchableOpacity>

      {/* ── Right icon zone: completely separate from left zone ── */}
      {/* These are siblings (not children) of the detail-opening TouchableOpacity,
          so their taps NEVER propagate to open the detail modal. */}
      <View style={{ gap: 6, alignItems: 'center', paddingLeft: 8 }}>
        {/* WhatsApp */}
        <TouchableOpacity
          onPress={() => openWhatsApp(c.phone)}
          style={[s.rowIconBtn, { backgroundColor: '#25D36622' }]}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <FontAwesome5 name="whatsapp" size={16} color="#25D366" />
        </TouchableOpacity>

        {/* Call */}
        <TouchableOpacity
          onPress={() => openDialer(c.phone)}
          style={[s.rowIconBtn, { backgroundColor: '#3b82f618' }]}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Feather name="phone" size={14} color="#3b82f6" />
        </TouchableOpacity>

        {/* Form Send */}
        <TouchableOpacity
          onPress={() => shareForm(c)}
          style={[s.rowIconBtn, { backgroundColor: '#f59e0b18' }]}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Feather name="send" size={13} color="#f59e0b" />
        </TouchableOpacity>
      </View>
    </View>
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
            {/* ── Modal Header — back arrow + title only ── */}
            <View style={[s.modalHeader, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => { setDetail(null); setEditTarget(null); }}
                style={{ padding: 10 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="arrow-left" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Customer Details</Text>
              {/* Spacer — keeps title centred */}
              <View style={{ width: 42 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── Action Icons Row — VERY TOP ────────────────────────────────
                  Icons come first. Payment/Reminder toggle inline forms below.
                  No tab switching, no modal closing — everything stays here.    */}
              <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' }}>

                  {/* ✏️ Edit */}
                  <TouchableOpacity
                    onPress={() => { setInlineAction(null); openEdit(detail); }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
                    style={{ alignItems: 'center', gap: 6, minWidth: 60 }}
                  >
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary + '20', borderWidth: 1.5, borderColor: colors.primary + '55', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="edit-2" size={22} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary, textAlign: 'center' }}>Edit</Text>
                  </TouchableOpacity>

                  {/* 💳 Payment — toggles inline form, stays in modal */}
                  <TouchableOpacity
                    onPress={() => { setEditTarget(null); setInlineAction(inlineAction === 'payment' ? null : 'payment'); setInlAmt(''); setInlJob(''); }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
                    style={{ alignItems: 'center', gap: 6, minWidth: 60 }}
                  >
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: inlineAction === 'payment' ? '#22c55e40' : '#22c55e20', borderWidth: inlineAction === 'payment' ? 2 : 1.5, borderColor: inlineAction === 'payment' ? '#22c55e' : '#22c55e55', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="credit-card" size={22} color="#22c55e" />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#22c55e', textAlign: 'center' }}>Payment</Text>
                  </TouchableOpacity>

                  {/* 🔔 Reminder — opens full ReminderModal */}
                  <TouchableOpacity
                    onPress={() => { setEditTarget(null); setInlineAction(null); openReminder(detail); }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
                    style={{ alignItems: 'center', gap: 6, minWidth: 60 }}
                  >
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#f59e0b20', borderWidth: 1.5, borderColor: '#f59e0b55', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="bell" size={22} color="#f59e0b" />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#f59e0b', textAlign: 'center' }}>Reminder</Text>
                  </TouchableOpacity>

                  {/* 🗑️ Delete */}
                  <TouchableOpacity
                    onPress={() => deleteCustomer(detail)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
                    style={{ alignItems: 'center', gap: 6, minWidth: 60 }}
                  >
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#ef444420', borderWidth: 1.5, borderColor: '#ef444455', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="trash-2" size={22} color="#ef4444" />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#ef4444', textAlign: 'center' }}>Delete</Text>
                  </TouchableOpacity>

                </View>
              </View>

              {/* ── Inline Payment Form ────────────────────────────────────────── */}
              {inlineAction === 'payment' && (
                <View style={[s.detailCard, { backgroundColor: '#22c55e08', borderColor: '#22c55e44' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={[s.detailLabel, { color: '#22c55e' }]}>💳 ADD PAYMENT</Text>
                    <TouchableOpacity onPress={() => setInlineAction(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="x" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    placeholder="Amount (₹) *"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={inlAmt}
                    onChangeText={setInlAmt}
                    style={[s.input, { marginBottom: 8 }]}
                  />
                  <TextInput
                    placeholder="Job description (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    value={inlJob}
                    onChangeText={setInlJob}
                    style={[s.input, { marginBottom: 12 }]}
                  />
                  <TouchableOpacity
                    onPress={saveInlinePayment}
                    activeOpacity={0.8}
                    disabled={inlSaving}
                    style={{ backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                  >
                    {inlSaving
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>✅ Save Payment</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* Reminder is now handled by ReminderModal (see bottom of component) */}

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
                    { label: 'Name *', val: editName, set: setEditName, kb: 'default' as const },
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
                    {editSaving ? <ActivityIndicator color="#000" /> : <><Feather name="check" size={16} color="#000" /><Text style={s.saveBtnText}>Update</Text></>}
                  </TouchableOpacity>
                </View>
              )}


            </ScrollView>
          </View>
        )}
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 140 }}>

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
            <Text style={s.addBtnText}>{showForm ? 'Close' : 'Add'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Add Form ── */}
        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={s.formTitle}>Add New Customer</Text>
            {[
              { label: 'Name *', val: name, set: setName, placeholder: 'Customer name', kb: 'default' as const },
              { label: 'Contact Number *', val: phone, set: setPhone, placeholder: '10-digit mobile number', kb: 'phone-pad' as const },
              { label: 'Address', val: address, set: setAddress, placeholder: 'House, Street, Area', kb: 'default' as const },
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
              {saving ? <ActivityIndicator color="#000" /> : <><Feather name="user-plus" size={16} color="#000" /><Text style={s.saveBtnText}>Save</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── "Set Reminder?" prompt after adding new customer ── */}
        {lastSavedCust && (
          <View style={[s.formCard, { backgroundColor: '#f59e0b10', borderColor: '#f59e0b55', flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }]}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.foreground }}>Reminder for {lastSavedCust.name}?</Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Set a follow-up or service alarm</Text>
            </View>
            <TouchableOpacity
              onPress={() => { openReminder(lastSavedCust); setLastSavedCust(null); }}
              style={{ backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}
            >
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>Set</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLastSavedCust(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Search ── */}
        <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput style={s.searchInput} placeholder="Search by name or phone…" placeholderTextColor={colors.mutedForeground}
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
            <Text style={s.emptyText}>No customer found</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
              Customers who fill the form via "Form Send" will appear here
            </Text>
          </View>
        )}

      </ScrollView>

      {/* ── ReminderModal — full-screen, auto-filled, date/time picker + alarm ── */}
      <ReminderModal
        visible={!!reminderTarget}
        onClose={() => setReminderTarget(null)}
        onSaved={() => setReminderTarget(null)}
        target={reminderTarget}
        techCode={techCode}
        apiBase={process.env.EXPO_PUBLIC_API_URL ?? ''}
      />
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: payment status colours
function payColor(status: string) {
  return status === 'paid' ? '#22c55e' : status === 'partial' ? '#3b82f6' : '#f59e0b';
}

function PaymentsTab({ colors, techCode, payments, setPayments, customers, insets, prefillPayment, onPrefillConsumed }: {
  colors: ReturnType<typeof useColors>;
  techCode: string;
  payments: TechPayment[];
  setPayments: React.Dispatch<React.SetStateAction<TechPayment[]>>;
  customers: TechCustomer[];
  insets: any;
  prefillPayment?: { name: string; phone: string } | null;
  onPrefillConsumed?: () => void;
}) {
  const s = styles(colors);

  // ── New payment record form ────────────────────────────────────────────────
  const [showNewForm,  setShowNewForm]  = useState(false);
  const [custName,     setCustName]     = useState('');
  const [custPhone,    setCustPhone]    = useState('');
  const [jobDesc,      setJobDesc]      = useState('');
  const [billed,       setBilled]       = useState('');
  const [savingNew,    setSavingNew]    = useState(false);

  // ── Add partial payment (per record) ──────────────────────────────────────
  const [addEntryId,   setAddEntryId]   = useState<number | null>(null); // which record is open
  const [entryAmount,  setEntryAmount]  = useState('');
  const [entryMethod,  setEntryMethod]  = useState<'cash' | 'online'>('cash');
  const [entryDate,    setEntryDate]    = useState('');
  const [entryTime,    setEntryTime]    = useState('');
  const [entryNote,    setEntryNote]    = useState('');
  const [savingEntry,  setSavingEntry]  = useState(false);

  // ── Expanded state per record (show entries) ───────────────────────────────
  const [expanded,     setExpanded]     = useState<Set<number>>(new Set());

  // ── History accordion open ────────────────────────────────────────────────
  const [historyOpen,  setHistoryOpen]  = useState(false);

  const todayISO = new Date().toISOString().slice(0, 10);

  // ── Auto-open new-record form when parent passes a prefill customer ─────────
  useEffect(() => {
    if (!prefillPayment) return;
    setCustName(prefillPayment.name);
    setCustPhone(prefillPayment.phone);
    setJobDesc('');
    setBilled('');
    setShowNewForm(true);
    setAddEntryId(null);
    onPrefillConsumed?.();
  }, [prefillPayment]);

  // totals across ALL records
  const totalBilled   = payments.reduce((s, p) => s + Number(p.amountBilled), 0);
  const totalReceived = payments.reduce((s, p) => s + Number(p.amountReceived), 0);
  const totalBalance  = totalBilled - totalReceived;

  const active  = payments.filter(p => p.status !== 'paid');
  const history = payments.filter(p => p.status === 'paid');

  // ── Create new payment record ──────────────────────────────────────────────
  const saveNewRecord = async () => {
    if (!custName.trim()) { Alert.alert('', 'Customer name is required'); return; }
    if (!billed.trim() || isNaN(parseFloat(billed))) { Alert.alert('', 'Amount is required'); return; }
    setSavingNew(true);
    try {
      const res = await api('/booking/tech-payments', {
        method: 'POST',
        body: JSON.stringify({
          techCode,
          customerName: custName.trim(),
          customerPhone: custPhone.trim() || undefined,
          jobDescription: jobDesc.trim() || undefined,
          amountBilled: parseFloat(billed),
          amountReceived: 0,
          status: 'pending',
        }),
      });
      setPayments(prev => [{ ...res, entries: [] }, ...prev]);
      setCustName(''); setCustPhone(''); setJobDesc(''); setBilled('');
      setShowNewForm(false);
    } catch { Alert.alert('Error', 'Save failed'); }
    setSavingNew(false);
  };

  // ── Add a partial payment entry ────────────────────────────────────────────
  const openAddEntry = (payId: number) => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);          // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 5);           // HH:MM
    setAddEntryId(payId);
    setEntryAmount('');
    setEntryMethod('cash');
    setEntryDate(dateStr);
    setEntryTime(timeStr);
    setEntryNote('');
    // auto-expand that record
    setExpanded(prev => { const s = new Set(prev); s.add(payId); return s; });
  };

  const saveEntry = async () => {
    if (!entryAmount.trim() || isNaN(parseFloat(entryAmount))) { Alert.alert('', 'Amount is required'); return; }
    if (!entryDate.trim()) { Alert.alert('', 'Date is required'); return; }
    setSavingEntry(true);
    const paidAtValue = entryTime.trim()
      ? `${entryDate}T${entryTime}`
      : entryDate;
    try {
      const res = await api('/booking/tech-payment-entries', {
        method: 'POST',
        body: JSON.stringify({
          paymentId: addEntryId,
          amount: parseFloat(entryAmount),
          paymentMethod: entryMethod,
          paidAt: paidAtValue,
          note: entryNote.trim() || undefined,
        }),
      });
      // API returns { entry, payment } — update local state
      const newStatus = res.payment?.status ?? 'pending';
      setPayments(prev => prev.map(p => {
        if (p.id !== addEntryId) return p;
        return {
          ...p,
          amountReceived: res.payment?.amountReceived ?? p.amountReceived,
          status: newStatus,
          entries: [res.entry, ...p.entries],
        };
      }));
      setAddEntryId(null);
      // Confirmation popup when fully paid
      if (newStatus === 'paid') {
        Alert.alert(
          '🎉 Payment Complete!',
          'Full payment received. This record will move to "Paid History".',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch { Alert.alert('Error', 'Entry could not be saved'); }
    setSavingEntry(false);
  };

  // ── Delete entire payment record ───────────────────────────────────────────
  const deleteRecord = async (p: TechPayment) => {
    const ok = await confirmDelete(`Permanently delete payment record for ${p.customerName}?`);
    if (!ok) return;
    try {
      await api(`/booking/tech-payments/${p.id}`, { method: 'DELETE' });
      setPayments(prev => prev.filter(x => x.id !== p.id));
    } catch { Alert.alert('Error', 'Record delete failed'); }
  };

  // ── Toggle expand ─────────────────────────────────────────────────────────
  const toggleExpand = (id: number) => {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // Web date input style
  const webDateStyle = {
    background: '#1e1e1e', color: colors.foreground,
    border: `1.5px solid ${colors.border}`, borderRadius: 10,
    padding: '10px 12px', fontSize: 14, width: '100%', outline: 'none',
    boxSizing: 'border-box',
  } as any;

  // ── Payment card ──────────────────────────────────────────────────────────
  const renderCard = (p: TechPayment) => {
    const balance  = p.amountBilled - p.amountReceived;
    const pct      = p.amountBilled > 0 ? Math.min(100, (p.amountReceived / p.amountBilled) * 100) : 0;
    const col      = payColor(p.status);
    const isOpen   = expanded.has(p.id);
    const addingHere = addEntryId === p.id;

    return (
      <View key={p.id} style={{
        backgroundColor: colors.card, borderRadius: 16,
        borderWidth: 1, borderColor: p.status === 'paid' ? '#22c55e44' : colors.border,
        borderLeftWidth: 4, borderLeftColor: col,
        overflow: 'hidden',
      }}>
        {/* ── Card header ── */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => toggleExpand(p.id)}
          style={{ padding: 14, gap: 8 }}>

          {/* Name row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.foreground }}>{p.customerName}</Text>
              {p.customerPhone ? <Text style={{ fontSize: 12, color: colors.mutedForeground }}>📞 {p.customerPhone}</Text> : null}
              {p.jobDescription ? <Text style={{ fontSize: 12, color: colors.mutedForeground }}>🔧 {p.jobDescription}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={{ backgroundColor: col + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: col }}>{p.status.toUpperCase()}</Text>
              </View>
              <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </View>
          </View>

          {/* Amount row */}
          <View style={{ flexDirection: 'row', gap: 0 }}>
            <View style={{ flex: 1, alignItems: 'center', padding: 8, backgroundColor: '#3b82f611', borderRadius: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#3b82f6' }}>₹{Number(p.amountBilled).toLocaleString('en-IN')}</Text>
              <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 1 }}>Total Billed</Text>
            </View>
            <View style={{ width: 8 }} />
            <View style={{ flex: 1, alignItems: 'center', padding: 8, backgroundColor: '#22c55e11', borderRadius: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#22c55e' }}>₹{Number(p.amountReceived).toLocaleString('en-IN')}</Text>
              <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 1 }}>Received</Text>
            </View>
            <View style={{ width: 8 }} />
            <View style={{ flex: 1, alignItems: 'center', padding: 8, backgroundColor: (balance > 0 ? '#f59e0b' : '#22c55e') + '11', borderRadius: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: balance > 0 ? '#f59e0b' : '#22c55e' }}>₹{balance.toLocaleString('en-IN')}</Text>
              <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 1 }}>Balance</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 4 }}>
            <View style={{ height: 6, width: `${pct}%` as any, backgroundColor: col, borderRadius: 4 }} />
          </View>
          <Text style={{ fontSize: 10, color: colors.mutedForeground, textAlign: 'right' }}>{Math.round(pct)}% paid</Text>
        </TouchableOpacity>

        {/* ── Expanded: entries + add entry form ── */}
        {isOpen && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>

            {/* Entry list */}
            {p.entries.length > 0 && (
              <View style={{ padding: 12, gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mutedForeground, marginBottom: 2 }}>📋 Payment History</Text>
                {p.entries.map(e => (
                  <View key={e.id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: e.paymentMethod === 'cash' ? '#f59e0b0d' : '#3b82f60d',
                    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: e.paymentMethod === 'cash' ? '#f59e0b33' : '#3b82f633',
                  }}>
                    <Text style={{ fontSize: 18 }}>{e.paymentMethod === 'cash' ? '💵' : '📲'}</Text>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#22c55e' }}>+₹{Number(e.amount).toLocaleString('en-IN')}</Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                        {(() => {
                          const raw = e.paidAt ?? '';
                          if (raw.includes('T')) {
                            const [datePart, timePart] = raw.split('T');
                            const [y, m, d] = datePart.split('-');
                            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            return `${d} ${months[parseInt(m,10)-1]} ${y}  ${timePart.slice(0,5)}`;
                          }
                          const [y, m, d] = raw.split('-');
                          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                          return `${d} ${months[parseInt(m,10)-1]} ${y}`;
                        })()}  ·  {e.paymentMethod === 'cash' ? '💵 Cash' : '📲 Online'}
                      </Text>
                      {e.note ? <Text style={{ fontSize: 11, color: colors.mutedForeground }} numberOfLines={1}>{e.note}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {p.entries.length === 0 && !addingHere && (
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 12 }}>
                No payment entries
              </Text>
            )}

            {/* Add Entry Form */}
            {addingHere && (
              <View style={{ padding: 12, gap: 10, borderTopWidth: p.entries.length > 0 ? 1 : 0, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>💳 Add Partial Payment</Text>

                {/* Amount row */}
                <View style={{ gap: 4 }}>
                  <Text style={s.fieldLabel}>Amount (₹) *</Text>
                  <TextInput style={s.input} placeholder={`Max ₹${balance.toLocaleString('en-IN')}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={entryAmount} onChangeText={setEntryAmount} keyboardType="numeric" />
                </View>

                {/* Date + Time row */}
                {Platform.OS === 'web'
                  ? <View style={{ gap: 4 }}>
                      <Text style={s.fieldLabel}>📅 Date & Time *</Text>
                      <input
                        type="datetime-local"
                        value={entryDate && entryTime ? `${entryDate}T${entryTime}` : entryDate}
                        onChange={(e: any) => {
                          const v: string = e.target.value; // "YYYY-MM-DDTHH:MM"
                          setEntryDate(v.slice(0, 10));
                          setEntryTime(v.slice(11, 16));
                        }}
                        style={webDateStyle}
                      />
                    </View>
                  : <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={s.fieldLabel}>📅 Date *</Text>
                        <TextInput style={s.input} placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.mutedForeground}
                          value={entryDate} onChangeText={setEntryDate} keyboardType="numbers-and-punctuation" />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={s.fieldLabel}>🕐 Time</Text>
                        <TextInput style={s.input} placeholder="HH:MM"
                          placeholderTextColor={colors.mutedForeground}
                          value={entryTime} onChangeText={setEntryTime} keyboardType="numbers-and-punctuation" />
                      </View>
                    </View>
                }

                {/* Payment Method */}
                <View style={{ gap: 4 }}>
                  <Text style={s.fieldLabel}>💳 Payment Method</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['cash', 'online'] as const).map(m => (
                      <TouchableOpacity key={m} onPress={() => setEntryMethod(m)} style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 2,
                        borderColor: entryMethod === m ? colors.primary : colors.border,
                        backgroundColor: entryMethod === m ? colors.primary + '18' : colors.card,
                      }}>
                        <Text style={{ fontSize: 16 }}>{m === 'cash' ? '💵' : '📲'}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: entryMethod === m ? colors.primary : colors.mutedForeground }}>
                          {m === 'cash' ? 'Cash' : 'Online'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Note */}
                <View style={{ gap: 4 }}>
                  <Text style={s.fieldLabel}>📝 Note (optional)</Text>
                  <TextInput style={s.input} placeholder="UPI, NEFT, cheque no…"
                    placeholderTextColor={colors.mutedForeground}
                    value={entryNote} onChangeText={setEntryNote} />
                </View>

                {/* Live remaining preview */}
                {entryAmount ? (() => {
                  const entered = parseFloat(entryAmount) || 0;
                  const newBal  = Math.max(0, balance - entered);
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                      backgroundColor: newBal === 0 ? '#22c55e18' : '#f59e0b18',
                      borderRadius: 10, padding: 10, borderWidth: 1,
                      borderColor: newBal === 0 ? '#22c55e' : '#f59e0b' }}>
                      <Feather name={newBal === 0 ? 'check-circle' : 'alert-circle'} size={16} color={newBal === 0 ? '#22c55e' : '#f59e0b'} />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: newBal === 0 ? '#22c55e' : '#f59e0b' }}>
                        {newBal === 0 ? '🎉 Fully Paid!' : `Remaining: ₹${newBal.toLocaleString('en-IN')}`}
                      </Text>
                    </View>
                  );
                })() : null}

                {/* Save / Cancel */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => setAddEntryId(null)}
                    style={{ flex: 1, padding: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mutedForeground }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveEntry} disabled={savingEntry}
                    style={{ flex: 2, padding: 11, borderRadius: 10, backgroundColor: colors.primary,
                      alignItems: 'center', opacity: savingEntry ? 0.7 : 1 }}>
                    {savingEntry ? <ActivityIndicator color="#000" size="small" />
                      : <Text style={{ fontSize: 13, fontWeight: '800', color: '#000' }}>💾 Save Entry</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Card footer actions */}
            {!addingHere && (
              <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                {p.status !== 'paid' && (
                  <TouchableOpacity onPress={() => openAddEntry(p.id)} style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: 10, borderRadius: 10, backgroundColor: colors.primary + '18',
                    borderWidth: 1, borderColor: colors.primary,
                  }}>
                    <Feather name="plus-circle" size={14} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Add Payment</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => deleteRecord(p)} style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: '#ef444415', borderWidth: 1, borderColor: '#ef444444',
                  ...(p.status === 'paid' ? { flex: 1 } : {}),
                }}>
                  <Feather name="trash-2" size={14} color="#ef4444" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444' }}>
                    {p.status === 'paid' ? 'Delete History' : 'Delete Record'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ width: SCREEN_WIDTH, flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 140 }}>

        {/* ── Global summary card ─────────────────────────────────────────── */}
        <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.primary + '44', padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>💰 Overall Balance</Text>
          <View style={{ flexDirection: 'row', gap: 0 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#3b82f6' }}>₹{totalBilled.toLocaleString('en-IN')}</Text>
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Total Billed</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 20, alignSelf: 'center' }}>−</Text>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#22c55e' }}>₹{totalReceived.toLocaleString('en-IN')}</Text>
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Received</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 20, alignSelf: 'center' }}>=</Text>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: totalBalance > 0 ? '#f59e0b' : '#22c55e' }}>
                ₹{totalBalance.toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Due</Text>
            </View>
          </View>
        </View>

        {/* ── Add new record button ────────────────────────────────────────── */}
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { setShowNewForm(v => !v); setAddEntryId(null); }}>
          <Feather name={showNewForm ? 'x' : 'plus-circle'} size={17} color="#000" />
          <Text style={s.addBtnText}>{showNewForm ? 'Close Form' : 'Create New Payment Record'}</Text>
        </TouchableOpacity>

        {/* ── New record form ──────────────────────────────────────────────── */}
        {showNewForm && (
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.primary + '44', gap: 12 }]}>
            <Text style={[s.formTitle, { color: colors.primary }]}>📋 New Payment Record</Text>

            {/* Customer quick-chips */}
            {customers.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={s.fieldLabel}>👤 Customer Quick Select</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 7 }}>
                    {customers.slice(0, 10).map(c => (
                      <TouchableOpacity key={c.id} onPress={() => { setCustName(c.name); setCustPhone(c.phone); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                          backgroundColor: custName === c.name ? colors.primary + '22' : colors.card,
                          borderWidth: 1.5, borderColor: custName === c.name ? colors.primary : colors.border }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: custName === c.name ? colors.primary : colors.foreground }}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Customer Name *</Text>
              <TextInput style={s.input} placeholder="Enter name" placeholderTextColor={colors.mutedForeground} value={custName} onChangeText={setCustName} />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Phone</Text>
              <TextInput style={s.input} placeholder="Phone number" placeholderTextColor={colors.mutedForeground} value={custPhone} onChangeText={setCustPhone} keyboardType="phone-pad" />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Job Description</Text>
              <TextInput style={s.input} placeholder="AC service, repair…" placeholderTextColor={colors.mutedForeground} value={jobDesc} onChangeText={setJobDesc} />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Total Amount Billed (₹) *</Text>
              <TextInput style={s.input} placeholder="0" placeholderTextColor={colors.mutedForeground} value={billed} onChangeText={setBilled} keyboardType="numeric" />
            </View>

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary, opacity: savingNew ? 0.7 : 1 }]}
              onPress={saveNewRecord} disabled={savingNew}>
              {savingNew ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Create Record →</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Active tracking panel ────────────────────────────────────────── */}
        {active.length > 0 && (
          <Text style={s.sectionTitle}>⏳ Active Tracking ({active.length})</Text>
        )}
        {active.map(renderCard)}

        {active.length === 0 && history.length === 0 && (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="credit-card" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>No payment records yet</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
              Tap "New Payment Record" to create one
            </Text>
          </View>
        )}

        {/* ── History: fully paid records ──────────────────────────────────── */}
        {history.length > 0 && (
          <>
            <TouchableOpacity onPress={() => setHistoryOpen(v => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: '#22c55e11', borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: '#22c55e33' }}>
              <Feather name="archive" size={16} color="#22c55e" />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#22c55e' }}>
                ✅ Paid History ({history.length} records)
              </Text>
              <Feather name={historyOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#22c55e" />
            </TouchableOpacity>
            {historyOpen && history.map(renderCard)}
          </>
        )}

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
    if (!finalTitle) { Alert.alert('', 'Purpose / title is required'); return; }
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
    } catch { Alert.alert('Error', 'Save failed'); }
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

  const deleteReminder = async (id: number) => {
    const ok = await confirmDelete('Permanently delete this reminder?');
    if (!ok) return;
    try {
      await api(`/booking/tech-reminders/${id}`, { method: 'DELETE' });
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch { Alert.alert('Error', 'Could not delete reminder'); }
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
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 140 }}>

        {/* ── Add / Cancel button ─────────────────────────────────────────── */}
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => showForm ? resetForm() : setShowForm(true)}>
          <Feather name={showForm ? 'x' : 'bell-plus' as any} size={17} color="#000" />
          <Text style={s.addBtnText}>{showForm ? 'Close Form' : 'Add New Reminder'}</Text>
        </TouchableOpacity>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.primary + '55', gap: 14 }]}>
            <Text style={[s.formTitle, { color: colors.primary, fontSize: 16 }]}>
              {editId ? '✏️ Edit Reminder' : '🔔 New Reminder'}
            </Text>

            {/* Customer search */}
            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>👤 Customer (optional)</Text>
              <TextInput style={s.input} placeholder="Search by name or phone…"
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
              <TextInput style={s.input} placeholder="e.g. Payment due, AC service check…"
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
              {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>{editId ? '✅ Update' : '💾 Save'}</Text>}
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
            <Text style={s.emptyText}>No reminders yet</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
              Tap "Add New Reminder" to get started
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
  profileAvatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)', overflow: 'hidden',
  },
  profileAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  greeting: { fontSize: 17, fontWeight: '800', color: c.foreground },
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
