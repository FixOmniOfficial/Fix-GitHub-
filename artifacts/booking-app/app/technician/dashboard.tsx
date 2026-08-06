import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useListBookings } from '@workspace/api-client-react';

const PROF_LABELS: Record<string, string> = {
  ac_technician: 'AC Technician', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

export default function TechnicianDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user } = useAppAuth();

  // Fetch all bookings and filter by professionalId
  const { data: allBookings, isLoading } = useListBookings({});
  const myBookings = (allBookings ?? []).filter(b =>
    user?.professionalId ? b.professionalId === user.professionalId : false
  );

  const goodRatings = myBookings.filter(b => b.rating === 'good').length;
  const thisMonth = myBookings.filter(b => {
    const d = new Date(b.createdAt ?? '');
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const s = styles(colors);

  if (!user || user.userType !== 'technician') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.mutedForeground }}>Technician login required</Text>
        <TouchableOpacity onPress={() => router.push('/auth' as any)} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Login करें</Text>
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
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40, gap: 16 }}
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

        {/* My Bookings */}
        <Text style={s.sectionTitle}>मेरी Bookings</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : myBookings.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>अभी कोई booking assign नहीं हुई</Text>
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
  statusBadge: {
    backgroundColor: '#14532d', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  codeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  liveChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: c.card, borderRadius: 12,
    borderWidth: 1, padding: 14, alignItems: 'center', gap: 4,
  },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 10, color: c.mutedForeground, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.foreground },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center' },
  bookingRow: {
    borderRadius: 12, borderWidth: 1, padding: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  bookingName: { fontSize: 15, fontWeight: '600', color: c.foreground },
  bookingMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  bookingId: { fontSize: 11, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },
});
