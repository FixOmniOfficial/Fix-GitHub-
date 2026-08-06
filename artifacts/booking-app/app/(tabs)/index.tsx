import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useListBookings } from '@workspace/api-client-react';

const PROFESSIONS = [
  { type: 'ac_technician', label: 'AC Service',   icon: 'wind'      as const, accent: '#3b82f6' },
  { type: 'electrician',   label: 'Electrician',  icon: 'zap'       as const, accent: '#f59e0b' },
  { type: 'carpenter',     label: 'Carpenter',    icon: 'tool'      as const, accent: '#d97706' },
  { type: 'plumber',       label: 'Plumber',      icon: 'droplet'   as const, accent: '#0ea5e9' },
  { type: 'painter',       label: 'Painter',      icon: 'edit-2'    as const, accent: '#ec4899' },
  { type: 'repair',        label: 'Repair',       icon: 'settings'  as const, accent: '#6b7280' },
];

const PROFESSION_LABELS: Record<string, string> = Object.fromEntries(PROFESSIONS.map(p => [p.type, p.label]));

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: recentBookings, isLoading } = useListBookings({});

  const recent = (recentBookings ?? []).slice(0, 3);

  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 }}
      >
        {/* ── Hero ── */}
        <View style={[s.hero, { paddingTop: topPad + 16 }]}>
          <View style={s.iconCircle}>
            <Text style={s.heroEmoji}>❄️</Text>
          </View>
          <Text style={s.heroTitle}>ProBook</Text>
          <Text style={s.heroSub}>प्रोफेशनल सर्विस बुक करें</Text>

          {/* Quick stat */}
          <View style={s.statRow}>
            <View style={s.statCard}>
              <Text style={[s.statNum, { color: colors.primary }]}>
                {recentBookings?.length ?? '—'}
              </Text>
              <Text style={s.statLabel}>Total Bookings</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statNum, { color: '#22c55e' }]}>
                {recentBookings?.filter(b => b.rating === 'good').length ?? '—'}
              </Text>
              <Text style={s.statLabel}>Good Ratings</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statNum, { color: colors.primary }]}>
                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </Text>
              <Text style={s.statLabel}>Today</Text>
            </View>
          </View>
        </View>

        {/* ── Profession Grid ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Service चुनें</Text>
          <View style={s.grid}>
            {PROFESSIONS.map((p) => (
              <TouchableOpacity
                key={p.type}
                style={[s.gridCard, { borderColor: colors.border }]}
                onPress={() => router.push(`/professional/${p.type}`)}
                activeOpacity={0.7}
              >
                <View style={[s.gridIcon, { backgroundColor: p.accent + '22' }]}>
                  <Feather name={p.icon} size={26} color={p.accent} />
                </View>
                <Text style={s.gridLabel}>{p.label}</Text>
                <View style={s.openBtn}>
                  <Text style={s.openText}>OPEN</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Recent Bookings ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Bookings</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : recent.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="calendar" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>अभी कोई booking नहीं</Text>
            </View>
          ) : (
            recent.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={s.bookingCard}
                onPress={() => router.push(`/booking/${b.id}`)}
                activeOpacity={0.8}
              >
                <View style={s.bookingLeft}>
                  <Text style={s.bookingName}>{b.customerName}</Text>
                  <Text style={s.bookingMeta}>{PROFESSION_LABELS[b.professionType] ?? b.professionType} · {b.phone}</Text>
                </View>
                <View style={[s.ratingDot, { backgroundColor: b.rating === 'good' ? '#22c55e' : b.rating === 'bad' ? '#ef4444' : colors.border }]} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  iconCircle: {
    width: 64, height: 64,
    borderRadius: 20,
    backgroundColor: '#1e3a5f',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  heroEmoji: { fontSize: 34 },
  heroTitle: { fontSize: 30, fontWeight: '800', color: c.foreground, letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: c.mutedForeground, marginTop: 2, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: c.card,
    borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: c.border,
  },
  statNum: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 10, color: c.mutedForeground, marginTop: 2, textAlign: 'center' },
  section: { padding: 20, paddingTop: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: c.foreground, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: {
    width: '47%',
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: 8,
  },
  gridIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: 14, fontWeight: '600', color: c.foreground },
  openBtn: {
    backgroundColor: c.secondary,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: c.border,
  },
  openText: { fontSize: 10, fontWeight: '700', color: c.mutedForeground, letterSpacing: 0.8 },
  emptyCard: {
    alignItems: 'center', gap: 8,
    backgroundColor: c.card, borderRadius: 14, padding: 32,
    borderWidth: 1, borderColor: c.border,
  },
  emptyText: { fontSize: 14, color: c.mutedForeground },
  bookingCard: {
    backgroundColor: c.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  bookingLeft: { flex: 1 },
  bookingName: { fontSize: 15, fontWeight: '600', color: c.foreground },
  bookingMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  ratingDot: { width: 10, height: 10, borderRadius: 5 },
});
