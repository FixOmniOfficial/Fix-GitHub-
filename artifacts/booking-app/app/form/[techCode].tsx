import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

interface TechInfo {
  id: number;
  name: string;
  phone: string | null;
  professionType: string;
  uniqueCode: string;
}
interface FormConfig {
  defaultVisitingCharge: number;
  customMessage: string | null;
}

const PROF_LABELS: Record<string, string> = {
  ac_technician: 'AC Technician', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

export default function TechFormScreen() {
  const { techCode } = useLocalSearchParams<{ techCode: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [techInfo, setTechInfo] = useState<TechInfo | null>(null);
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [sector, setSector] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [location, setLocation] = useState('');
  const [visitingCharge, setVisitingCharge] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!techCode) return;
    fetch(`${API_BASE}/api/booking/tech-form-config/${techCode}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError('Technician not found'); return; }
        setTechInfo(data.technician);
        setFormConfig(data.config);
        setVisitingCharge(String(data.config?.defaultVisitingCharge ?? ''));
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [techCode]);

  const handleSubmit = async () => {
    if (!customerName.trim()) { Alert.alert('', 'Please enter your name'); return; }
    if (!phone.trim() || phone.length < 10) { Alert.alert('', 'Please enter a valid phone number'); return; }
    if (!fullAddress.trim()) { Alert.alert('', 'Please enter your address'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/booking/tech-form-submit/${techCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, phone, fullAddress, sector, floorNumber, houseNumber, location, visitingCharge: parseFloat(visitingCharge) || 0, notes }),
      });
      if (!res.ok) throw new Error('Submit failed');
      setSubmitted(true);
    } catch {
      Alert.alert('Error', 'Could not submit, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const s = styles(colors);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !techInfo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={{ color: '#ef4444', fontSize: 16, marginTop: 12, textAlign: 'center' }}>{error ?? 'Invalid link'}</Text>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#14532d', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Feather name="check" size={40} color="#22c55e" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.foreground, textAlign: 'center' }}>Thank you! 🙏</Text>
        <Text style={{ fontSize: 15, color: colors.mutedForeground, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
          Your request has been sent to {techInfo.name}.{'\n'}We will contact you shortly.
        </Text>
        <View style={[s.thankCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Technician</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginTop: 2 }}>{techInfo.name}</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>{PROF_LABELS[techInfo.professionType] ?? techInfo.professionType}</Text>
          {visitingCharge ? (
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '700', marginTop: 6 }}>Visiting Charge: ₹{visitingCharge}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <View style={[s.avatar, { backgroundColor: colors.primary + '22' }]}>
            <Text style={{ fontSize: 20 }}>🔧</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerName}>{techInfo.name}</Text>
            <Text style={s.headerSub}>{PROF_LABELS[techInfo.professionType] ?? techInfo.professionType}</Text>
          </View>
          <View style={[s.idBadge, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[s.idText, { color: colors.primary }]}>{techInfo.uniqueCode}</Text>
          </View>
        </View>

        {formConfig?.customMessage ? (
          <View style={[s.msgBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 18 }}>{formConfig.customMessage}</Text>
          </View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.sectionLabel}>Customer Details</Text>

          <View style={s.field}>
            <Text style={s.label}>Name *</Text>
            <TextInput style={s.input} placeholder="Your full name" placeholderTextColor={colors.mutedForeground} value={customerName} onChangeText={setCustomerName} />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Phone Number *</Text>
            <TextInput style={s.input} placeholder="10-digit mobile number" placeholderTextColor={colors.mutedForeground} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
          </View>

          <Text style={[s.sectionLabel, { marginTop: 4 }]}>Address Details</Text>

          <View style={s.row2}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>House / Flat No.</Text>
              <TextInput style={s.input} placeholder="H-12 / Flat 4B" placeholderTextColor={colors.mutedForeground} value={houseNumber} onChangeText={setHouseNumber} />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Floor No.</Text>
              <TextInput style={s.input} placeholder="Ground / 1st / 2nd" placeholderTextColor={colors.mutedForeground} value={floorNumber} onChangeText={setFloorNumber} />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Sector / Colony / Mohalla</Text>
            <TextInput style={s.input} placeholder="Sector 15 / DLF Colony" placeholderTextColor={colors.mutedForeground} value={sector} onChangeText={setSector} />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Full Address *</Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Street name, near landmark..."
              placeholderTextColor={colors.mutedForeground}
              value={fullAddress}
              onChangeText={setFullAddress}
              multiline
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Location / Area</Text>
            <TextInput style={s.input} placeholder="e.g. Noida, Sector 62" placeholderTextColor={colors.mutedForeground} value={location} onChangeText={setLocation} />
          </View>

          <Text style={[s.sectionLabel, { marginTop: 4 }]}>Service Details</Text>

          <View style={s.field}>
            <Text style={s.label}>Visiting Charge (₹)</Text>
            <TextInput style={s.input} placeholder="0" placeholderTextColor={colors.mutedForeground} value={visitingCharge} onChangeText={setVisitingCharge} keyboardType="numeric" />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Extra Notes (optional)</Text>
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              placeholder="Issue description..."
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="send" size={17} color="#000" />
                <Text style={s.submitText}>Send Request</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 17, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground },
  idBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  idText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  msgBanner: {
    margin: 16, marginBottom: 0,
    borderRadius: 10, padding: 12,
    borderWidth: 1,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: c.mutedForeground, letterSpacing: 0.8, textTransform: 'uppercase' },
  field: { gap: 6 },
  row2: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: c.foreground },
  input: {
    backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: c.foreground,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 15, gap: 8, marginTop: 8,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#000' },
  thankCard: {
    borderRadius: 14, padding: 16, marginTop: 24,
    borderWidth: 1, width: '100%', alignItems: 'center',
  },
});
