import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useListProfessionals } from '@workspace/api-client-react';

const PROFESSION_META: Record<string, { label: string; accent: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  ac_technician: { label: 'AC Service',  accent: '#3b82f6', icon: 'wind'     },
  electrician:   { label: 'Electrician', accent: '#f59e0b', icon: 'zap'      },
  carpenter:     { label: 'Carpenter',   accent: '#d97706', icon: 'tool'     },
  plumber:       { label: 'Plumber',     accent: '#0ea5e9', icon: 'droplet'  },
  painter:       { label: 'Painter',     accent: '#ec4899', icon: 'edit-2'   },
  repair:        { label: 'Repair',      accent: '#6b7280', icon: 'settings' },
};

export default function ProfessionalListScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const meta = PROFESSION_META[type ?? ''] ?? { label: type, accent: '#888', icon: 'user' as const };

  const { data: professionals, isLoading } = useListProfessionals(
    { professionType: type, isActive: true },
  );

  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[s.headerIcon, { backgroundColor: meta.accent + '22' }]}>
          <Feather name={meta.icon} size={20} color={meta.accent} />
        </View>
        <View>
          <Text style={s.headerTitle}>{meta.label}</Text>
          <Text style={s.headerSub}>Choose Professional</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={professionals ?? []}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="user-x" size={40} color={colors.mutedForeground} />
              <Text style={s.emptyTitle}>No professional found</Text>
              <Text style={s.emptyDesc}>No professionals available in this category yet.</Text>
            </View>
          }
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push({
                pathname: '/booking/new',
                params: {
                  professionalId: String(p.id),
                  professionalName: p.name,
                  professionType: p.professionType,
                  professionalEmoji: p.avatarEmoji ?? '👤',
                  visitingCharge: p.visitingCharge ? String(p.visitingCharge) : '',
                },
              })}
              activeOpacity={0.8}
            >
              {/* Avatar */}
              <View style={[s.avatar, { backgroundColor: meta.accent + '22' }]}>
                <Text style={s.avatarText}>{p.avatarEmoji ?? '👤'}</Text>
              </View>

              {/* Info */}
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{p.name}</Text>
                {p.phone && <Text style={s.cardPhone}>{p.phone}</Text>}
                {p.visitingCharge != null && Number(p.visitingCharge) > 0 && (
                  <Text style={[s.chargeText, { color: meta.accent }]}>
                    Visiting: ₹{p.visitingCharge}
                  </Text>
                )}
              </View>

              {/* Book button */}
              <View style={[s.bookBtn, { backgroundColor: meta.accent }]}>
                <Text style={s.bookText}>Book</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
  backBtn: { padding: 4 },
  headerIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground },
  empty: { alignItems: 'center', gap: 10, padding: 40, marginTop: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: c.foreground },
  emptyDesc: { fontSize: 13, color: c.mutedForeground, textAlign: 'center' },
  card: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: c.border,
  },
  avatar: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: c.foreground },
  cardPhone: { fontSize: 13, color: c.mutedForeground, marginTop: 2 },
  chargeText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  bookBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  bookText: { fontSize: 13, fontWeight: '700', color: '#000' },
});
