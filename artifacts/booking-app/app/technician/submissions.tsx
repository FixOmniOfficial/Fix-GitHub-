import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { getBaseUrl } from '@workspace/api-client-react';

interface Submission {
  id: number;
  customerName: string;
  phone: string;
  fullAddress: string | null;
  sector: string | null;
  floorNumber: string | null;
  houseNumber: string | null;
  location: string | null;
  visitingCharge: number | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

function SubmissionCard({
  item,
  colors,
  onComplete,
}: {
  item: Submission;
  colors: ReturnType<typeof useColors>;
  onComplete: (id: number) => void;
}) {
  const isPending = item.status === 'pending';
  return (
    <View style={[cardStyle(colors).card, { borderLeftColor: isPending ? '#f59e0b' : '#22c55e', borderLeftWidth: 4 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={cardStyle(colors).name}>{item.customerName}</Text>
            <View style={[cardStyle(colors).badge, { backgroundColor: isPending ? '#f59e0b22' : '#22c55e22' }]}>
              <Text style={[cardStyle(colors).badgeText, { color: isPending ? '#f59e0b' : '#22c55e' }]}>
                {isPending ? 'PENDING' : 'COMPLETED'}
              </Text>
            </View>
          </View>
          <Text style={cardStyle(colors).phone}>📞 {item.phone}</Text>
          {item.houseNumber || item.floorNumber ? (
            <Text style={cardStyle(colors).meta}>
              🏠 {[item.houseNumber, item.floorNumber && `Floor: ${item.floorNumber}`, item.sector].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.fullAddress ? <Text style={cardStyle(colors).meta} numberOfLines={2}>📍 {item.fullAddress}</Text> : null}
          {item.location ? <Text style={cardStyle(colors).meta}>🗺 {item.location}</Text> : null}
          {item.visitingCharge ? <Text style={[cardStyle(colors).charge, { color: colors.primary }]}>₹{item.visitingCharge} visiting charge</Text> : null}
          {item.notes ? <Text style={cardStyle(colors).notes}>📝 {item.notes}</Text> : null}
          <Text style={cardStyle(colors).time}>{new Date(item.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        {isPending && (
          <TouchableOpacity
            style={cardStyle(colors).completeBtn}
            onPress={() => onComplete(item.id)}
            activeOpacity={0.8}
          >
            <Feather name="check-circle" size={20} color="#22c55e" />
            <Text style={cardStyle(colors).completeTxt}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const cardStyle = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  card: {
    backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    padding: 14, marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: '700', color: c.foreground },
  phone: { fontSize: 13, color: c.mutedForeground, marginTop: 3 },
  meta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  charge: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  notes: { fontSize: 12, color: c.mutedForeground, marginTop: 3, fontStyle: 'italic' },
  time: { fontSize: 11, color: c.mutedForeground, marginTop: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  completeBtn: { alignItems: 'center', gap: 3, paddingLeft: 8 },
  completeTxt: { fontSize: 10, fontWeight: '700', color: '#22c55e' },
});

export default function SubmissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user } = useAppAuth();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const techCode = user?.uniqueCode ?? '';

  const fetchSubmissions = useCallback(async (phone?: string) => {
    if (!techCode) return;
    setLoading(true);
    try {
      const url = `${getBaseUrl()}/api/booking/tech-form-submissions?techCode=${techCode}${phone ? `&phone=${phone}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert('Error', 'Submissions load नहीं हो सका');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [techCode]);

  // Load on mount
  React.useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleSearch = () => {
    if (!searchPhone.trim()) { fetchSubmissions(); setSearched(false); return; }
    setSearched(true);
    fetchSubmissions(searchPhone.trim());
  };

  const clearSearch = () => {
    setSearchPhone('');
    setSearched(false);
    fetchSubmissions();
  };

  const handleComplete = async (id: number) => {
    Alert.alert('Complete करें?', 'इस request को completed mark करना चाहते हैं?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'हाँ, Done है', onPress: async () => {
          try {
            await fetch(`${getBaseUrl()}/api/booking/tech-form-submissions/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed' }),
            });
            setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'completed' } : s));
          } catch {
            Alert.alert('Error', 'Update नहीं हो सका');
          }
        }
      }
    ]);
  };

  const filtered = submissions.filter(s => filter === 'all' ? true : s.status === filter);
  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  const s = styles(colors);

  if (!user || user.userType !== 'technician') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.mutedForeground }}>Technician login required</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Customer Requests</Text>
          <Text style={s.headerSub}>{pendingCount > 0 ? `${pendingCount} pending` : 'सभी complete'}</Text>
        </View>
        {pendingCount > 0 && (
          <View style={s.badgeCircle}>
            <Text style={s.badgeNum}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={s.searchBar}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={s.searchInput}
          placeholder="Phone number से search करें..."
          placeholderTextColor={colors.mutedForeground}
          value={searchPhone}
          onChangeText={setSearchPhone}
          keyboardType="phone-pad"
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searched ? (
          <TouchableOpacity onPress={clearSearch}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSearch}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Search</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={s.filterRow}>
        {(['all', 'pending', 'completed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && { backgroundColor: colors.primary }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && { color: '#000' }]}>
              {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Done'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchSubmissions(searched ? searchPhone : undefined); }}
              tintColor={colors.primary}
            />
          }
        >
          {searched && (
            <View style={[s.searchResult, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                "{searchPhone}" के लिए {filtered.length} record{filtered.length !== 1 ? 's' : ''} मिले
              </Text>
            </View>
          )}

          {filtered.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 10, textAlign: 'center' }}>
                {searched ? 'इस number पर कोई record नहीं' : 'अभी कोई request नहीं'}
              </Text>
            </View>
          ) : (
            filtered.map(item => (
              <SubmissionCard key={item.id} item={item} colors={colors} onComplete={handleComplete} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  badgeCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
  },
  badgeNum: { fontSize: 12, fontWeight: '800', color: '#fff' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.foreground },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 4 },
  filterTab: {
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: c.mutedForeground },

  searchResult: { borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1 },
  emptyCard: { borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1 },
});
