import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGetAppRatingsSummary } from '@workspace/api-client-react';
import { useAppAuth } from '@/contexts/AppAuthContext';

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Feather key={s} name="star" size={16} color={s <= Math.round(rating) ? '#f59e0b' : '#333'} />
      ))}
    </View>
  );
}

const PROF_LABELS: Record<string, string> = {
  ac_technician: 'AC Technician', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber', painter: 'Painter', repair: 'Repair',
};

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: summary } = useGetAppRatingsSummary({});
  const { user, logout } = useAppAuth();

  const s = styles(colors);

  const COMMON_ACTIONS = [
    { icon: 'list' as const,   label: 'Market Rates', sub: 'सर्विस की दरें देखें',      path: '/rates',    color: '#3b82f6' },
    { icon: 'phone' as const,  label: 'Helpline',     sub: 'Admin को मैसेज करें',        path: '/helpline', color: '#22c55e' },
    { icon: 'star' as const,   label: 'Rate the App', sub: 'ऐप को रेट करें',            path: '/rating',   color: '#f59e0b' },
    { icon: 'shield' as const, label: 'Admin Panel',  sub: 'Admin Login (PIN required)', path: '/admin',    color: '#8b5cf6' },
  ];

  const handleLogout = () => {
    Alert.alert('Logout', `${user?.name} — logout करना चाहते हैं?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

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
        {/* ── User Profile / Login Card ── */}
        {user ? (
          <View style={[s.profileCard, { borderColor: user.userType === 'technician' ? colors.primary : '#3b82f6' }]}>
            <View style={[s.profileAvatar, { backgroundColor: (user.userType === 'technician' ? colors.primary : '#3b82f6') + '22' }]}>
              <Text style={{ fontSize: 28 }}>{user.userType === 'technician' ? '🔧' : '👤'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={s.profileName}>{user.name}</Text>
                <View style={[s.roleBadge, { backgroundColor: (user.userType === 'technician' ? colors.primary : '#3b82f6') + '22' }]}>
                  <Text style={[s.roleBadgeText, { color: user.userType === 'technician' ? colors.primary : '#3b82f6' }]}>
                    {user.userType === 'technician' ? 'TECHNICIAN' : 'CUSTOMER'}
                  </Text>
                </View>
              </View>
              {user.phone && <Text style={s.profilePhone}>📞 {user.phone}</Text>}
              <Text style={[s.profileCode, { color: user.userType === 'technician' ? colors.primary : '#3b82f6' }]}>
                🔑 {user.uniqueCode}
              </Text>
              {user.professionType && (
                <Text style={s.profileSpec}>{PROF_LABELS[user.professionType] ?? user.professionType}</Text>
              )}
            </View>
            <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
              <Feather name="log-out" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.loginBanner, { borderColor: colors.primary }]}
            onPress={() => router.push('/auth' as any)}
            activeOpacity={0.85}
          >
            <View style={[s.loginIcon, { backgroundColor: colors.primary + '22' }]}>
              <Feather name="user" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.loginTitle, { color: colors.foreground }]}>Login / Sign Up करें</Text>
              <Text style={[s.loginSub, { color: colors.mutedForeground }]}>
                Customer या Technician — अपना account बनाएं
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* ── Technician-specific actions ── */}
        {user?.userType === 'technician' && (
          <>
            <Text style={s.sectionLabel}>Technician Actions</Text>
            <TouchableOpacity
              style={[s.actionCard, { borderColor: colors.primary + '44' }]}
              onPress={() => router.push('/technician/dashboard' as any)}
              activeOpacity={0.8}
            >
              <View style={[s.actionIcon, { backgroundColor: colors.primary + '22' }]}>
                <Feather name="grid" size={22} color={colors.primary} />
              </View>
              <View style={s.actionText}>
                <Text style={s.actionLabel}>My Dashboard</Text>
                <Text style={s.actionSub}>अपनी bookings, ratings, और profile देखें</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.primary} />
            </TouchableOpacity>
          </>
        )}

        {/* ── Customer-specific actions ── */}
        {user?.userType === 'customer' && (
          <>
            <Text style={s.sectionLabel}>Your Account</Text>
            <TouchableOpacity
              style={[s.actionCard, { borderColor: '#3b82f644' }]}
              onPress={() => router.push('/(tabs)/bookings' as any)}
              activeOpacity={0.8}
            >
              <View style={[s.actionIcon, { backgroundColor: '#3b82f622' }]}>
                <Feather name="calendar" size={22} color="#3b82f6" />
              </View>
              <View style={s.actionText}>
                <Text style={s.actionLabel}>My Bookings</Text>
                <Text style={s.actionSub}>आपकी सभी bookings की list</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#3b82f6" />
            </TouchableOpacity>
          </>
        )}

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

        {/* ── Common Actions ── */}
        <Text style={s.sectionLabel}>Quick Actions</Text>
        {COMMON_ACTIONS.map((a) => (
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

  // Profile card (logged in)
  profileCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: c.card, borderRadius: 16, borderWidth: 1.5, padding: 14,
    marginBottom: 16,
  },
  profileAvatar: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 16, fontWeight: '800', color: c.foreground },
  roleBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  roleBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  profilePhone: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  profileCode: { fontSize: 12, fontWeight: '700', marginTop: 3, letterSpacing: 1 },
  profileSpec: { fontSize: 11, color: c.mutedForeground, marginTop: 2 },
  logoutBtn: { padding: 6, backgroundColor: c.background, borderRadius: 8, borderWidth: 1, borderColor: c.border },

  // Login banner (not logged in)
  loginBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.card, borderRadius: 16, borderWidth: 1.5, padding: 16,
    marginBottom: 16,
  },
  loginIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  loginTitle: { fontSize: 15, fontWeight: '700' },
  loginSub: { fontSize: 12, marginTop: 2 },

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
