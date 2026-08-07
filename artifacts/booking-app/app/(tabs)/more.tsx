import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGetAppRatingsSummary } from '@workspace/api-client-react';

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Feather key={s} name="star" size={16} color={s <= Math.round(rating) ? '#f59e0b' : '#333'} />
      ))}
    </View>
  );
}

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: summary } = useGetAppRatingsSummary({});

  const s = styles(colors);

  const ACTIONS = [
    { icon: 'list' as const,   label: 'Market Rates', sub: 'सर्विस की दरें देखें',      path: '/rates',    color: '#3b82f6' },
    { icon: 'phone' as const,  label: 'Helpline',     sub: 'Admin को मैसेज करें',        path: '/helpline', color: '#22c55e' },
    { icon: 'star' as const,   label: 'Rate the App', sub: 'ऐप को रेट करें',            path: '/rating',   color: '#f59e0b' },
    { icon: 'shield' as const, label: 'Admin Panel',  sub: 'Admin Login (PIN required)', path: '/admin',    color: '#8b5cf6' },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <Text style={s.headerTitle}>More</Text>
        <Text style={s.headerSub}>Services & Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 }}
      >
        {/* ── App Rating Card ── */}
        <View style={s.ratingCard}>
          <View style={s.ratingLeft}>
            <Text style={s.ratingTitle}>App Performance</Text>
            <Text style={s.ratingScore}>
              {summary?.averageRating ? summary.averageRating.toFixed(1) : '—'}
            </Text>
            <StarRow rating={summary?.averageRating ?? 0} />
            <Text style={s.ratingCount}>{summary?.totalRatings ?? 0} ratings</Text>
          </View>
          <View style={s.ratingRight}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = (summary as any)?.[`star${star}`] ?? 0;
              const total = summary?.totalRatings ?? 1;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <View key={star} style={s.ratingBar}>
                  <Text style={s.ratingBarLabel}>{star}★</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: '#f59e0b' }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <Text style={s.sectionLabel}>Quick Actions</Text>
        {ACTIONS.map((a) => (
          <TouchableOpacity key={a.path} style={s.actionCard} onPress={() => router.push(a.path as any)} activeOpacity={0.8}>
            <View style={[s.actionIcon, { backgroundColor: a.color + '22' }]}>
              <Feather name={a.icon} size={22} color={a.color} />
            </View>
            <View style={s.actionText}>
              <Text style={s.actionLabel}>{a.label}</Text>
              <Text style={s.actionSub}>{a.sub}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: c.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  ratingCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 18,
    flexDirection: 'row', gap: 16, borderWidth: 1, borderColor: c.border,
    marginBottom: 16,
  },
  ratingLeft: { alignItems: 'center', minWidth: 80 },
  ratingTitle: { fontSize: 11, fontWeight: '700', color: c.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  ratingScore: { fontSize: 42, fontWeight: '800', color: c.foreground, lineHeight: 48 },
  ratingCount: { fontSize: 11, color: c.mutedForeground, marginTop: 4 },
  ratingRight: { flex: 1, gap: 4, justifyContent: 'center' },
  ratingBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBarLabel: { fontSize: 10, color: c.mutedForeground, width: 20 },
  barTrack: { flex: 1, height: 6, backgroundColor: c.secondary, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, minWidth: 2 },

  actionCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionLabel: { fontSize: 16, fontWeight: '600', color: c.foreground },
  actionSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
});
