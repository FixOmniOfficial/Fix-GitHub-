import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useListBookings, useListServiceCategories, useGetHomeConfig } from '@workspace/api-client-react';

const PROFESSION_LABELS_FALLBACK: Record<string, string> = {
  ac_technician: 'AC Service', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: recentBookings, isLoading } = useListBookings({});
  const { data: categories, isLoading: catsLoading } = useListServiceCategories({});
  const { data: homeConfig } = useGetHomeConfig({});

  const recent = (recentBookings ?? []).slice(0, 3);
  const activeCategories = (categories ?? []).filter(c => c.isActive);

  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 }}
      >
        {/* ── Header Bar ── */}
        <View style={[s.header, { paddingTop: topPad + 10 }]}>
          {/* Logo */}
          <View style={s.logoRow}>
            <View style={s.logoBox}>
              <Text style={s.logoEmoji}>❄️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>ProBook</Text>
              <Text style={s.heroTagline}>Trusted Services • विश्वसनीय सेवाएँ</Text>
            </View>
          </View>

          {/* Helpline small icon */}
          {homeConfig && (
            <TouchableOpacity
              style={s.helplineIconBtn}
              onPress={() => Linking.openURL(`tel:${homeConfig.helplineNumber}`)}
              activeOpacity={0.7}
            >
              <Feather name="phone-call" size={17} color="#22c55e" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Quick stats ── */}
        <View style={[s.statRow, { paddingHorizontal: 16, marginTop: 14 }]}>
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

        {/* ── Service Categories ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Service चुनें</Text>
          {catsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={s.grid}>
              {activeCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.gridCard, { borderColor: colors.border }]}
                  onPress={() => router.push(`/professional/${cat.professionType}`)}
                  activeOpacity={0.7}
                >
                  <View style={[s.gridIcon, { backgroundColor: (cat.accent ?? '#6b7280') + '22' }]}>
                    <Feather name={(cat.icon ?? 'settings') as any} size={26} color={cat.accent ?? '#6b7280'} />
                  </View>
                  <Text style={s.gridLabel}>{cat.name}</Text>
                  <View style={s.openBtn}>
                    <Text style={s.openText}>OPEN</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
                  <Text style={s.bookingMeta}>
                    {PROFESSION_LABELS_FALLBACK[b.professionType] ?? b.professionType} · {b.phone}
                  </Text>
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

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
    gap: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logoBox: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: '#1e3a5f',
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 24 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: c.foreground, letterSpacing: -0.5 },
  heroTagline: { fontSize: 10, color: c.mutedForeground, marginTop: 1 },

  helplineIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#022c22',
    borderWidth: 1, borderColor: '#166534',
    alignItems: 'center', justifyContent: 'center',
  },

  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: c.card,
    borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: c.border,
  },
  statNum: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 10, color: c.mutedForeground, marginTop: 2, textAlign: 'center' },

  section: { padding: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: c.foreground, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: {
    width: '47%', backgroundColor: c.card,
    borderRadius: 16, padding: 16, borderWidth: 1,
    alignItems: 'flex-start', gap: 8,
  },
  gridIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: 14, fontWeight: '600', color: c.foreground },
  openBtn: {
    backgroundColor: c.secondary, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
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
    backgroundColor: c.card, borderRadius: 12, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  bookingLeft: { flex: 1 },
  bookingName: { fontSize: 15, fontWeight: '600', color: c.foreground },
  bookingMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  ratingDot: { width: 10, height: 10, borderRadius: 5 },
});
