import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export default function AuthIndexScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Feather name="x" size={24} color={colors.foreground} />
      </TouchableOpacity>

      {/* Title */}
      <View style={s.titleBlock}>
        <Text style={s.emoji}>👋</Text>
        <Text style={s.title}>Who are you?</Text>
        <Text style={s.sub}>Choose your role — this personalises your experience</Text>
      </View>

      {/* Cards */}
      <View style={s.cards}>
        {/* Customer */}
        <TouchableOpacity
          style={[s.card, { borderColor: '#3b82f6' }]}
          onPress={() => router.push('/auth/customer')}
          activeOpacity={0.85}
        >
          <View style={[s.cardIcon, { backgroundColor: '#3b82f622' }]}>
            <Text style={{ fontSize: 36 }}>👤</Text>
          </View>
          <Text style={s.cardTitle}>I am a Customer</Text>
          <Text style={s.cardSub}>Book services, track bookings, view history</Text>
          <View style={[s.cardBadge, { backgroundColor: '#3b82f622', borderColor: '#3b82f644' }]}>
            <Text style={[s.cardBadgeText, { color: '#3b82f6' }]}>Guest booking also available</Text>
          </View>
          <Feather name="arrow-right" size={20} color="#3b82f6" style={{ alignSelf: 'flex-end' }} />
        </TouchableOpacity>

        {/* Technician */}
        <TouchableOpacity
          style={[s.card, { borderColor: colors.primary }]}
          onPress={() => router.push('/auth/technician')}
          activeOpacity={0.85}
        >
          <View style={[s.cardIcon, { backgroundColor: colors.primary + '22' }]}>
            <Text style={{ fontSize: 36 }}>🔧</Text>
          </View>
          <Text style={s.cardTitle}>I am a Technician</Text>
          <Text style={s.cardSub}>Login with your unique ID, manage bookings, track profile</Text>
          <View style={[s.cardBadge, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
            <Text style={[s.cardBadgeText, { color: colors.primary }]}>You'll get a Unique ID</Text>
          </View>
          <Feather name="arrow-right" size={20} color={colors.primary} style={{ alignSelf: 'flex-end' }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  backBtn: { padding: 8, alignSelf: 'flex-start', marginBottom: 4 },
  titleBlock: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emoji: { fontSize: 52 },
  title: { fontSize: 28, fontWeight: '800', color: c.foreground, textAlign: 'center' },
  sub: { fontSize: 13, color: c.mutedForeground, textAlign: 'center', lineHeight: 20 },
  cards: { gap: 16 },
  card: {
    backgroundColor: c.card, borderRadius: 20, padding: 20,
    borderWidth: 1.5, gap: 10,
  },
  cardIcon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 20, fontWeight: '800', color: c.foreground },
  cardSub: { fontSize: 13, color: c.mutedForeground, lineHeight: 18 },
  cardBadge: {
    alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  cardBadgeText: { fontSize: 11, fontWeight: '700' },
});
