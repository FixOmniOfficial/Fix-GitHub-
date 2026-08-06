import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useListHelplineMessages, useUpdateHelplineMessage } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function AdminHelplineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { isAdmin } = useAdminAuth();
  const { data: messages, isLoading, refetch } = useListHelplineMessages({});
  const updateMessage = useUpdateHelplineMessage();

  const handleResolve = (id: number) => {
    updateMessage.mutate(
      { id, data: { isResolved: true } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries();
        },
        onError: () => Alert.alert('Error', 'Failed to update'),
      },
    );
  };

  const s = styles(colors);

  if (!isAdmin) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Admin access required</Text>
      </View>
    );
  }

  const pending = (messages ?? []).filter(m => !m.isResolved);
  const resolved = (messages ?? []).filter(m => m.isResolved);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Helpline Messages</Text>
          <Text style={s.headerSub}>{pending.length} pending · {resolved.length} resolved</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={messages ?? []}
          keyExtractor={m => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>कोई message नहीं</Text>
            </View>
          }
          renderItem={({ item: m }) => (
            <View style={[s.card, m.isResolved && s.cardResolved]}>
              {/* Header row */}
              <View style={s.cardHeader}>
                <View style={[s.typeBadge, { backgroundColor: m.senderType === 'technician' ? '#3b82f622' : '#22c55e22' }]}>
                  <Text style={[s.typeText, { color: m.senderType === 'technician' ? '#3b82f6' : '#22c55e' }]}>
                    {m.senderType === 'technician' ? 'TECH' : 'CUSTOMER'}
                  </Text>
                </View>
                <Text style={s.timeText}>{timeAgo(m.createdAt)}</Text>
                {m.isResolved && <Feather name="check-circle" size={14} color="#22c55e" />}
              </View>

              {/* Sender info */}
              <Text style={s.senderName}>{m.senderName}</Text>
              {m.phone && <Text style={s.senderPhone}>{m.phone}</Text>}

              {/* Message */}
              <Text style={s.message}>{m.message}</Text>

              {/* Actions */}
              {!m.isResolved && (
                <View style={s.actions}>
                  {m.phone && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: '#25d36622' }]}
                      onPress={() => Linking.openURL(`https://wa.me/91${m.phone}`)}
                    >
                      <Feather name="message-circle" size={14} color="#25d366" />
                      <Text style={[s.actionText, { color: '#25d366' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: '#22c55e22' }]}
                    onPress={() => handleResolve(m.id)}
                    disabled={updateMessage.isPending}
                  >
                    <Feather name="check" size={14} color="#22c55e" />
                    <Text style={[s.actionText, { color: '#22c55e' }]}>Resolved</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground },
  empty: { alignItems: 'center', gap: 10, padding: 60, marginTop: 20 },
  emptyText: { fontSize: 14, color: c.mutedForeground },
  card: {
    backgroundColor: c.card, borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  cardResolved: { opacity: 0.7, borderColor: '#22c55e33' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  timeText: { flex: 1, fontSize: 11, color: c.mutedForeground },
  senderName: { fontSize: 15, fontWeight: '700', color: c.foreground },
  senderPhone: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  message: { fontSize: 14, color: c.foreground, marginTop: 8, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  actionText: { fontSize: 13, fontWeight: '600' },
});
