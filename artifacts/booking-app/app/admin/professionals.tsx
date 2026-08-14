import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, Switch, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useListProfessionals, useUpdateProfessional } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const PROFESSION_LABELS: Record<string, string> = {
  ac_technician: 'AC Service', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

export default function AdminProfessionalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const queryClient = useQueryClient();

  const { isAdmin } = useAdminAuth();
  const { data: professionals, isLoading } = useListProfessionals({});
  const updateProfessional = useUpdateProfessional();

  const handleToggle = (prof: { id: number; name: string; isActive: boolean }) => {
    const action = prof.isActive ? 'Block' : 'Unblock';
    Alert.alert(
      `${action} ${prof.name}?`,
      prof.isActive
        ? 'Blocking this professional will stop them from receiving new bookings.'
        : 'Unblocking this professional will allow them to receive bookings again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: prof.isActive ? 'destructive' : 'default',
          onPress: () => {
            updateProfessional.mutate(
              { id: prof.id, data: { isActive: !prof.isActive } },
              {
                onSuccess: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  queryClient.invalidateQueries();
                },
                onError: () => Alert.alert('Error', 'Update failed'),
              },
            );
          },
        },
      ],
    );
  };

  const s = styles(colors);

  if (!isAdmin) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={s.noAccess}>Admin access required</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Professionals</Text>
          <Text style={s.headerSub}>Block / Unblock</Text>
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
          renderItem={({ item: p }) => (
            <View style={[s.card, !p.isActive && s.cardBlocked]}>
              {/* Avatar */}
              <View style={s.avatar}>
                <Text style={s.avatarText}>{p.avatarEmoji ?? '👤'}</Text>
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.cardName}>{p.name}</Text>
                  {!p.isActive && (
                    <View style={s.blockedBadge}>
                      <Text style={s.blockedText}>BLOCKED</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardType}>{PROFESSION_LABELS[p.professionType] ?? p.professionType}</Text>
                {p.phone && <Text style={s.cardPhone}>{p.phone}</Text>}
              </View>

              {/* Toggle */}
              <Switch
                value={p.isActive}
                onValueChange={() => handleToggle({ id: p.id, name: p.name, isActive: p.isActive })}
                trackColor={{ false: '#ef444444', true: '#22c55e44' }}
                thumbColor={p.isActive ? '#22c55e' : '#ef4444'}
                disabled={updateProfessional.isPending}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  noAccess: { fontSize: 16, color: c.mutedForeground, marginTop: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground },
  card: {
    backgroundColor: c.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  cardBlocked: { borderColor: '#ef444444', opacity: 0.85 },
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: c.secondary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 26 },
  cardName: { fontSize: 15, fontWeight: '700', color: c.foreground },
  cardType: { fontSize: 12, color: c.mutedForeground, marginTop: 1 },
  cardPhone: { fontSize: 12, color: c.mutedForeground },
  blockedBadge: { backgroundColor: '#ef444422', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  blockedText: { fontSize: 9, fontWeight: '800', color: '#ef4444', letterSpacing: 0.5 },
});
