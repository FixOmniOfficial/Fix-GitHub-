import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform,
  ActivityIndicator, SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useListMarketRates } from '@workspace/api-client-react';

const PROFESSION_META: Record<string, { label: string; color: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  ac_technician: { label: 'AC Service',  color: '#3b82f6', icon: 'wind'     },
  electrician:   { label: 'Electrician', color: '#f59e0b', icon: 'zap'      },
  carpenter:     { label: 'Carpenter',   color: '#d97706', icon: 'tool'     },
  plumber:       { label: 'Plumber',     color: '#0ea5e9', icon: 'droplet'  },
  painter:       { label: 'Painter',     color: '#ec4899', icon: 'edit-2'   },
  repair:        { label: 'Repair',      color: '#6b7280', icon: 'settings' },
};

export default function MarketRatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: rates, isLoading } = useListMarketRates({});

  // Group by professionType
  const sections = Object.entries(
    (rates ?? []).reduce<Record<string, typeof rates>>((acc, r) => {
      if (!acc[r.professionType]) acc[r.professionType] = [];
      acc[r.professionType]!.push(r);
      return acc;
    }, {})
  ).map(([type, data]) => ({ type, data: data ?? [] }));

  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Market Rates</Text>
          <Text style={s.headerSub}>तय दरें — सभी काम इसी rate पर</Text>
        </View>
      </View>

      {/* Note banner */}
      <View style={s.noteBanner}>
        <Feather name="info" size={14} color={colors.primary} />
        <Text style={s.noteText}>ये दरें Admin द्वारा निर्धारित हैं। सभी टेक्नीशियन इन्हीं दरों पर काम करते हैं।</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section: { type } }) => {
            const meta = PROFESSION_META[type] ?? { label: type, color: '#888', icon: 'tool' as const };
            return (
              <View style={[s.sectionHeader, { backgroundColor: meta.color + '15', borderColor: meta.color + '33' }]}>
                <Feather name={meta.icon} size={16} color={meta.color} />
                <Text style={[s.sectionTitle, { color: meta.color }]}>{meta.label}</Text>
              </View>
            );
          }}
          renderItem={({ item: r }) => {
            const meta = PROFESSION_META[r.professionType] ?? { color: '#888' };
            return (
              <View style={s.rateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.serviceName}>{r.serviceName}</Text>
                  <Text style={s.unitText}>{r.unit}</Text>
                </View>
                <Text style={[s.rateAmt, { color: meta.color }]}>₹{r.rate}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="tag" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>कोई rate list नहीं मिली</Text>
            </View>
          }
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
  noteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, padding: 12,
    backgroundColor: c.primary + '11', borderRadius: 10, borderWidth: 1, borderColor: c.primary + '33',
  },
  noteText: { flex: 1, fontSize: 12, color: c.mutedForeground, lineHeight: 18 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 10, marginBottom: 8, marginTop: 8,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rateRow: {
    backgroundColor: c.card, borderRadius: 10, padding: 12,
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
    borderWidth: 1, borderColor: c.border,
  },
  serviceName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  unitText: { fontSize: 11, color: c.mutedForeground, marginTop: 1 },
  rateAmt: { fontSize: 16, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 10, padding: 60, marginTop: 20 },
  emptyText: { fontSize: 14, color: c.mutedForeground },
});
