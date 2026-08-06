import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useListBookings, useListProfessionals, useListHelplineMessages, useGetAppRatingsSummary } from '@workspace/api-client-react';

function PinScreen({ onLogin }: { onLogin: (pin: string) => Promise<boolean> }) {
  const colors = useColors();
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const s = styles(colors);

  const handleLogin = async () => {
    setLoading(true);
    const ok = await onLogin(pin);
    setLoading(false);
    if (!ok) {
      setError('गलत PIN। कृपया Admin से पूछें।');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPin('');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[s.root, { paddingTop: topPad, backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={() => router.back()} style={{ padding: 16, alignSelf: 'flex-start' }}>
        <Feather name="x" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <View style={s.pinCenter}>
        <View style={[s.pinIcon, { backgroundColor: '#8b5cf622' }]}>
          <Feather name="shield" size={36} color="#8b5cf6" />
        </View>
        <Text style={s.pinTitle}>Admin Login</Text>
        <Text style={s.pinSub}>4-अंक का PIN दर्ज करें</Text>
        <TextInput
          style={[s.pinInput, { borderColor: error ? colors.destructive : colors.border, color: colors.foreground, backgroundColor: colors.card }]}
          value={pin}
          onChangeText={(t) => { setPin(t); setError(''); }}
          placeholder="• • • •"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          textAlign="center"
          autoFocus
        />
        {error ? <Text style={s.pinError}>{error}</Text> : null}
        <TouchableOpacity
          style={[s.pinBtn, { backgroundColor: '#8b5cf6' }, (pin.length < 4 || loading) && { opacity: 0.5 }]}
          onPress={handleLogin}
          disabled={pin.length < 4 || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.pinBtnText}>Login करें</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string | number; color: string }) {
  const colors = useColors();
  const s = styles(colors);
  return (
    <View style={[s.statCard, { borderColor: color + '44' }]}>
      <View style={[s.statIcon, { backgroundColor: color + '22' }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const s = styles(colors);

  const { data: bookings } = useListBookings({});
  const { data: professionals } = useListProfessionals({});
  const { data: helpline } = useListHelplineMessages({});
  const { data: ratingSummary } = useGetAppRatingsSummary({});

  const pending = (helpline ?? []).filter(m => !m.isResolved).length;
  const blocked = (professionals ?? []).filter(p => !p.isActive).length;

  const ACTIONS = [
    { icon: 'users' as const,     label: 'Professionals',   sub: 'Block / Unblock Manage करें',  path: '/admin/professionals',  color: '#3b82f6' },
    { icon: 'phone' as const,     label: 'Helpline',        sub: `${pending} pending messages`,  path: '/admin/helpline',       color: '#22c55e' },
    { icon: 'tag' as const,       label: 'Market Rates',    sub: 'Rates view/edit करें',         path: '/admin/rates',          color: '#f59e0b' },
    { icon: 'home' as const,      label: 'Home Config',     sub: 'Services & Helpline सेटअप करें', path: '/admin/home-config',   color: '#8b5cf6' },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Admin Dashboard</Text>
            <Text style={s.headerSub}>पूरा नियंत्रण</Text>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert('Logout', 'Admin logout करना चाहते हैं?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', onPress: onLogout, style: 'destructive' },
            ])}
            style={s.logoutBtn}
          >
            <Feather name="log-out" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 40 }}
      >
        {/* Stats */}
        <View style={s.statsGrid}>
          <StatCard icon="calendar" label="Total Bookings" value={bookings?.length ?? 0} color="#3b82f6" />
          <StatCard icon="users" label="Professionals" value={professionals?.length ?? 0} color="#22c55e" />
          <StatCard icon="user-x" label="Blocked" value={blocked} color="#ef4444" />
          <StatCard icon="star" label="App Rating" value={ratingSummary?.averageRating ? ratingSummary.averageRating.toFixed(1) : '—'} color="#f59e0b" />
        </View>

        {/* Action cards */}
        <Text style={s.sectionLabel}>Manage करें</Text>
        {ACTIONS.map((a) => (
          <TouchableOpacity key={a.path} style={s.actionCard} onPress={() => router.push(a.path as any)} activeOpacity={0.8}>
            <View style={[s.actionIcon, { backgroundColor: a.color + '22' }]}>
              <Feather name={a.icon} size={22} color={a.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>{a.label}</Text>
              <Text style={s.actionSub}>{a.sub}</Text>
            </View>
            {a.path === '/admin/helpline' && pending > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{pending}</Text>
              </View>
            )}
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}

        {/* Recent bookings */}
        <Text style={[s.sectionLabel, { marginTop: 20 }]}>Recent Bookings</Text>
        {(bookings ?? []).slice(0, 5).map(b => (
          <TouchableOpacity
            key={b.id}
            style={s.bookingRow}
            onPress={() => router.push(`/booking/${b.id}`)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.bookingName}>{b.customerName}</Text>
              <Text style={s.bookingMeta}>{b.professionType} · {b.phone}</Text>
            </View>
            <Text style={{ fontSize: 14 }}>{b.rating === 'good' ? '👍' : b.rating === 'bad' ? '👎' : '—'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function AdminScreen() {
  const { isAdmin, loading, login, logout } = useAdminAuth();
  const colors = useColors();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isAdmin) return <PinScreen onLogin={login} />;
  return <AdminDashboard onLogout={logout} />;
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '47%', backgroundColor: c.card, borderRadius: 14,
    padding: 14, borderWidth: 1, alignItems: 'center', gap: 4,
  },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: c.mutedForeground, textAlign: 'center' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: c.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  actionCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 16, fontWeight: '600', color: c.foreground },
  actionSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  badge: { backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  bookingRow: {
    backgroundColor: c.card, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: c.border,
  },
  bookingName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  bookingMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  // PIN screen
  pinCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  pinIcon: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  pinTitle: { fontSize: 26, fontWeight: '800', color: c.foreground, marginBottom: 8 },
  pinSub: { fontSize: 14, color: c.mutedForeground, marginBottom: 24 },
  pinInput: {
    width: '100%', height: 60, borderWidth: 2, borderRadius: 14,
    fontSize: 28, letterSpacing: 12, textAlign: 'center',
  },
  pinError: { fontSize: 13, color: c.destructive, marginTop: 8 },
  pinBtn: { marginTop: 20, width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  pinBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
