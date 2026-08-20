import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useListMarketRates, useUpdateMarketRate } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const PROFESSION_LABELS: Record<string, string> = {
  ac_technician: 'AC Service', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

type Rate = { id: number; professionType: string; serviceName: string; rate: string | number | null; unit: string | null };

export default function AdminRatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { isAdmin } = useAdminAuth();
  const { data: rates, isLoading } = useListMarketRates({});
  const updateRate = useUpdateMarketRate();

  const [editing, setEditing] = useState<Rate | null>(null);
  const [newRate, setNewRate] = useState('');

  const handleSave = () => {
    if (!editing || !newRate) return;
    const val = parseFloat(newRate);
    if (isNaN(val) || val <= 0) { Alert.alert('Error', 'Please enter a valid rate'); return; }
    updateRate.mutate(
      { id: editing.id, data: { professionType: editing.professionType, serviceName: editing.serviceName, rate: val } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries();
          setEditing(null);
          setNewRate('');
        },
        onError: () => Alert.alert('Error', 'Update failed'),
      },
    );
  };

  // Group by professionType
  const grouped: Record<string, Rate[]> = {};
  for (const r of (rates ?? [])) {
    if (!grouped[r.professionType]) grouped[r.professionType] = [];
    grouped[r.professionType].push(r as Rate);
  }
  const groupEntries = Object.entries(grouped);

  const s = styles(colors);

  if (!isAdmin) {
    return <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.mutedForeground }}>Admin access required</Text>
    </View>;
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Market Rates</Text>
          <Text style={s.headerSub}>Tap a rate to edit</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={groupEntries}
          keyExtractor={([type]) => type}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: [profType, rateList] }) => (
            <View style={s.group}>
              <Text style={s.groupTitle}>{PROFESSION_LABELS[profType] ?? profType}</Text>
              {rateList.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={s.rateRow}
                  onPress={() => { setEditing(r); setNewRate(String(r.rate ?? '')); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.serviceName}>{r.serviceName}</Text>
                    <Text style={s.unitText}>{r.unit}</Text>
                  </View>
                  <View style={s.rateAmt}>
                    <Text style={s.rateText}>₹{r.rate}</Text>
                    <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editing} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={s.modalTitle}>Edit Rate</Text>
            <Text style={s.modalService}>{editing?.serviceName}</Text>
            <TextInput
              style={[s.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
              value={newRate}
              onChangeText={setNewRate}
              placeholder="New rate (₹)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.secondary }]} onPress={() => setEditing(null)}>
                <Text style={[s.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: colors.primary }, updateRate.isPending && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={updateRate.isPending}
              >
                <Text style={[s.modalBtnText, { color: colors.primaryForeground }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  group: { marginBottom: 20 },
  groupTitle: {
    fontSize: 13, fontWeight: '700', color: c.primary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  rateRow: {
    backgroundColor: c.card, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
    borderWidth: 1, borderColor: c.border,
  },
  serviceName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  unitText: { fontSize: 11, color: c.mutedForeground, marginTop: 1 },
  rateAmt: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateText: { fontSize: 16, fontWeight: '700', color: c.primary },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: c.foreground },
  modalService: { fontSize: 14, color: c.mutedForeground },
  modalInput: {
    borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18,
    fontWeight: '600',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
