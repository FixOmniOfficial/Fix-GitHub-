import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useScreenVisibility } from '@/contexts/ScreenVisibilityContext';
import ScreenDisabled from '@/components/ScreenDisabled';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useListBookings } from '@workspace/api-client-react';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

const PROF_LABELS: Record<string, string> = {
  ac_technician: 'AC Technician', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

export default function TechnicianDashboardScreen() {
  const { isScreenEnabled } = useScreenVisibility();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user } = useAppAuth();

  const { data: allBookings, isLoading } = useListBookings({});
  const myBookings = (allBookings ?? []).filter(b =>
    user?.professionalId ? b.professionalId === user.professionalId : false
  );

  const [pendingCount, setPendingCount] = useState(0);
  const techCode = user?.uniqueCode ?? '';

  const fetchPending = useCallback(async () => {
    if (!techCode) return;
    try {
      const res = await fetch(`${API_BASE}/api/booking/tech-form-submissions?techCode=${techCode}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPendingCount(data.filter((s: any) => s.status === 'pending').length);
      }
    } catch {}
  }, [techCode]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const goodRatings = myBookings.filter(b => b.rating === 'good').length;
  const thisMonth = myBookings.filter(b => {
    const d = new Date(b.createdAt ?? '');
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const s = styles(colors);

  if (!isScreenEnabled('technician_dashboard')) return <ScreenDisabled label="Dashboard" />;

  if (!user || user.userType !== 'technician') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.mutedForeground }}>Technician login required</Text>
        <TouchableOpacity onPress={() => router.push('/auth' as any)} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>My Dashboard</Text>
          <Text style={s.headerSub}>🔧 Technician View</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40, gap: 14 }}
      >
        {/* Profile card */}
        <View style={[s.profileCard, { borderColor: colors.primary }]}>
          <View style={[s.avatar, { backgroundColor: colors.primary + '22' }]}>
            <Text style={{ fontSize: 36 }}>🔧</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{user.name}</Text>
            <Text style={s.profileType}>{PROF_LABELS[user.professionType ?? ''] ?? user.professionType}</Text>
            {user.phone && <Text style={s.profilePhone}>📞 {user.phone}</Text>}
          </View>
          <View style={s.statusBadge}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#22c55e' }}>ACTIVE</Text>
          </View>
        </View>

        {/* Unique code */}
        <View style={[s.codeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="key" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: '600' }}>YOUR UNIQUE ID</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.primary, letterSpacing: 2 }}>{user.uniqueCode}</Text>
          </View>
          <View style={[s.liveChip, { backgroundColor: colors.primary + '22' }]}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>LOGIN ID</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { borderColor: '#3b82f6' }]}>
            <Text style={[s.statNum, { color: '#3b82f6' }]}>{myBookings.length}</Text>
            <Text style={s.statLabel}>Total Jobs</Text>
          </View>
          <View style={[s.statCard, { borderColor: '#22c55e' }]}>
            <Text style={[s.statNum, { color: '#22c55e' }]}>{goodRatings}</Text>
            <Text style={s.statLabel}>Good Ratings</Text>
          </View>
          <View style={[s.statCard, { borderColor: colors.primary }]}>
            <Text style={[s.statNum, { color: colors.primary }]}>{thisMonth}</Text>
            <Text style={s.statLabel}>This Month</Text>
          </View>
        </View>

        {/* ── Form Tools ── */}
        <Text style={s.sectionTitle}>Customer Form Tools</Text>

        {/* Pending Notification Banner */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={[s.notifBanner, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' }]}
            onPress={() => router.push('/technician/submissions' as any)}
            activeOpacity={0.8}
          >
            <View style={s.notifDot} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#f59e0b' }}>
                {pendingCount} New Request{pendingCount > 1 ? 's' : ''} Pending
              </Text>
              <Text style={{ fontSize: 12, color: '#f59e0b99', marginTop: 2 }}>Tap to view and complete</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#f59e0b" />
          </TouchableOpacity>
        )}

        <View style={s.formActions}>
          {/* My Form (share via WhatsApp) */}
          <TouchableOpacity
            style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/technician/form-manager' as any)}
            activeOpacity={0.8}
          >
            <View style={[s.formIcon, { backgroundColor: '#25D36622' }]}>
              <Text style={{ fontSize: 22 }}>📲</Text>
            </View>
            <Text style={s.formCardTitle}>My Form</Text>
            <Text style={s.formCardSub}>Share via WhatsApp</Text>
            <Feather name="arrow-right" size={14} color={colors.mutedForeground} style={{ marginTop: 6 }} />
          </TouchableOpacity>

          {/* Customer Requests */}
          <TouchableOpacity
            style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/technician/submissions' as any)}
            activeOpacity={0.8}
          >
            <View style={[s.formIcon, { backgroundColor: colors.primary + '22' }]}>
              <Text style={{ fontSize: 22 }}>📋</Text>
            </View>
            <Text style={s.formCardTitle}>Customer Requests</Text>
            <Text style={s.formCardSub}>
              {pendingCount > 0 ? `${pendingCount} pending` : 'All Records'}
            </Text>
            {pendingCount > 0 && (
              <View style={[s.pendingBadge, { backgroundColor: '#ef4444' }]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* My Bookings (from main booking system) */}
        <Text style={s.sectionTitle}>My Bookings</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : myBookings.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>No bookings assigned yet</Text>
          </View>
        ) : (
          myBookings.slice().reverse().map(b => (
            <TouchableOpacity
              key={b.id}
              style={[s.bookingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/booking/${b.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.bookingName}>{b.customerName}</Text>
                <Text style={s.bookingMeta}>{b.phone}{b.bookingTime ? ` · ${b.bookingTime}` : ''}</Text>
                <Text style={[s.bookingId, { color: colors.primary }]}>{b.bookingUid}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontSize: 14 }}>{b.rating === 'good' ? '👍' : b.rating === 'bad' ? '👎' : '—'}</Text>
                <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: c.card, borderRadius: 16, borderWidth: 1.5, padding: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 18, fontWeight: '800', color: c.foreground },
  profileType: { fontSize: 13, color: c.mutedForeground, marginTop: 2 },
  profilePhone: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  statusBadge: { backgroundColor: '#14532d', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  liveChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: c.card, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 10, color: c.mutedForeground, textAlign: 'center' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.foreground },

  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1.5, padding: 14,
  },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },

  formActions: { flexDirection: 'row', gap: 12 },
  formCard: {
    flex: 1, borderRadius: 14, borderWidth: 1, padding: 14,
    alignItems: 'flex-start', position: 'relative',
  },
  formIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  formCardTitle: { fontSize: 14, fontWeight: '700', color: c.foreground },
  formCardSub: { fontSize: 11, color: c.mutedForeground, marginTop: 2 },
  pendingBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center' },
  bookingRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bookingName: { fontSize: 15, fontWeight: '600', color: c.foreground },
  bookingMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  bookingId: { fontSize: 11, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },
});
