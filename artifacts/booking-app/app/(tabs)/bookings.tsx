import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useScreenVisibility } from '@/contexts/ScreenVisibilityContext';
import ScreenDisabled from '@/components/ScreenDisabled';
import { useListBookings } from '@workspace/api-client-react';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'ac_technician', label: 'AC' },
  { key: 'electrician',   label: 'Electric' },
  { key: 'carpenter',     label: 'Carpenter' },
  { key: 'plumber',       label: 'Plumber' },
  { key: 'painter',       label: 'Painter' },
  { key: 'repair',        label: 'Repair' },
];

const PROFESSION_LABELS: Record<string, string> = {
  ac_technician: 'AC Service', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

export default function BookingsScreen() {
  const { isScreenEnabled } = useScreenVisibility();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: bookings, isLoading, refetch } = useListBookings(
    filter ? { professionType: filter } : {}
  );

  const s = styles(colors);

  if (!isScreenEnabled('customer_bookings')) return <ScreenDisabled label="Bookings" />;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <Text style={s.headerTitle}>Bookings</Text>
        <Text style={s.headerSub}>All Bookings</Text>
      </View>

      {/* Filter tabs */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.filterChip, filter === item.key && s.filterChipActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[s.filterText, filter === item.key && s.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={bookings ?? []}
          keyExtractor={b => String(b.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.emptyCard}>
              <Feather name="calendar" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No bookings found</Text>
            </View>
          }
          renderItem={({ item: b }) => (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/booking/${b.id}`)} activeOpacity={0.8}>
              {/* Left: info */}
              <View style={s.cardLeft}>
                <View style={s.cardRow}>
                  <Text style={s.cardName}>{b.customerName}</Text>
                  {b.rating && (
                    <Text style={s.ratingBadge}>{b.rating === 'good' ? '👍' : '👎'}</Text>
                  )}
                </View>
                <Text style={s.cardMeta}>
                  {PROFESSION_LABELS[b.professionType] ?? b.professionType}
                  {b.professionalName ? ` · ${b.professionalName}` : ''}
                </Text>
                <Text style={s.cardMeta}>{b.phone}</Text>
              </View>
              {/* Right: UID + chevron */}
              <View style={s.cardRight}>
                <Text style={s.cardUid}>{b.bookingUid}</Text>
                <Text style={s.cardDate}>
                  {new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
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
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  filterList: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border,
  },
  filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  filterText: { fontSize: 13, fontWeight: '500', color: c.mutedForeground },
  filterTextActive: { color: c.primaryForeground, fontWeight: '700' },
  card: {
    backgroundColor: c.card,
    borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  cardLeft: { flex: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: c.foreground },
  ratingBadge: { fontSize: 14 },
  cardMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 2 },
  cardUid: { fontSize: 10, fontFamily: 'monospace', color: c.primary, fontWeight: '700' },
  cardDate: { fontSize: 11, color: c.mutedForeground },
  emptyCard: {
    alignItems: 'center', gap: 10,
    padding: 60, marginTop: 20,
  },
  emptyText: { fontSize: 14, color: c.mutedForeground },
});
