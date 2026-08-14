import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useListBookings } from '@workspace/api-client-react';

const PROFESSION_LABELS: Record<string, string> = {
  ac_technician: 'AC Service', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: bookings, isLoading, refetch } = useListBookings({});

  const s = styles(colors);
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Notifications</Text>
            <Text style={s.headerSub}>New Booking Alerts</Text>
          </View>
          {bookings && bookings.filter(b => new Date(b.createdAt).getTime() > twentyFourHoursAgo).length > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>
                {bookings.filter(b => new Date(b.createdAt).getTime() > twentyFourHoursAgo).length} New
              </Text>
            </View>
          )}
        </View>
      </View>

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
            <View style={s.empty}>
              <Feather name="bell-off" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No notifications yet</Text>
            </View>
          }
          renderItem={({ item: b }) => {
            const isNew = new Date(b.createdAt).getTime() > twentyFourHoursAgo;
            return (
              <TouchableOpacity
                style={[s.item, isNew && s.itemNew]}
                onPress={() => router.push(`/booking/${b.id}`)}
                activeOpacity={0.8}
              >
                {/* Left indicator */}
                <View style={[s.dot, { backgroundColor: isNew ? colors.primary : colors.border }]} />

                {/* Content */}
                <View style={s.itemContent}>
                  <View style={s.itemRow}>
                    <Text style={s.itemTitle}>New Booking: {b.customerName}</Text>
                    {isNew && <View style={s.newBadge}><Text style={s.newBadgeText}>NEW</Text></View>}
                  </View>
                  <Text style={s.itemDesc}>
                    {PROFESSION_LABELS[b.professionType] ?? b.professionType}
                    {b.professionalName ? ` · ${b.professionalName}` : ''}
                  </Text>
                  <View style={s.itemMeta}>
                    <Text style={s.itemId}>{b.bookingUid}</Text>
                    <Text style={s.itemTime}>{timeAgo(b.createdAt)}</Text>
                  </View>
                </View>

                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  badge: {
    backgroundColor: c.primary, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: c.primaryForeground },
  empty: { alignItems: 'center', gap: 10, padding: 60, marginTop: 20 },
  emptyText: { fontSize: 14, color: c.mutedForeground },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.card, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  itemNew: { borderColor: c.primary + '55' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemContent: { flex: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: c.foreground, flex: 1 },
  newBadge: {
    backgroundColor: c.primary + '33',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  newBadgeText: { fontSize: 9, fontWeight: '800', color: c.primary, letterSpacing: 0.5 },
  itemDesc: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  itemId: { fontSize: 10, fontFamily: 'monospace', color: c.primary, fontWeight: '700' },
  itemTime: { fontSize: 11, color: c.mutedForeground },
});
