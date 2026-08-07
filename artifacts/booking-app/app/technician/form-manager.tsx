import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Alert, ActivityIndicator, Linking,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { getBaseUrl } from '@workspace/api-client-react';

export default function FormManagerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user, loading: authLoading } = useAppAuth();

  const [defaultVisitingCharge, setDefaultVisitingCharge] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const techCode = user?.uniqueCode ?? '';
  const formUrl = `${process.env.EXPO_PUBLIC_REPL_ID ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : getBaseUrl()}/form/${techCode}`;

  useEffect(() => {
    if (!techCode) return;
    fetch(`${getBaseUrl()}/api/booking/tech-form-config/${techCode}`)
      .then(r => r.json())
      .then(data => {
        if (data.config) {
          setDefaultVisitingCharge(String(data.config.defaultVisitingCharge ?? ''));
          setCustomMessage(data.config.customMessage ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [techCode]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${getBaseUrl()}/api/booking/tech-form-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techCode, defaultVisitingCharge: parseFloat(defaultVisitingCharge) || 0, customMessage }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      Alert.alert('Error', 'Save नहीं हो सका');
    } finally {
      setSaving(false);
    }
  };

  const shareOnWhatsApp = () => {
    const msg = encodeURIComponent(`🔧 Service Request Form\n\nनमस्ते! अपनी service book करने के लिए यह form भरें:\n${formUrl}\n\n- ${user?.name ?? 'Technician'}\n${techCode}`);
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() =>
      Alert.alert('WhatsApp', 'WhatsApp नहीं खुल सका')
    );
  };

  const copyLink = async () => {
    try {
      await Share.share({ message: formUrl, url: formUrl });
    } catch {}
  };

  const s = styles(colors);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user || user.userType !== 'technician') {
    router.replace('/auth/technician' as any);
    return null;
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>My Form</Text>
          <Text style={s.headerSub}>Customer को WhatsApp से भेजें</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Link */}
          <View style={[s.linkCard, { backgroundColor: colors.card, borderColor: colors.primary + '55' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Feather name="link" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>आपका Form Link</Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: 'monospace' }} numberOfLines={2}>{formUrl}</Text>
            <View style={s.linkBtns}>
              <TouchableOpacity style={[s.shareBtn, { backgroundColor: '#25D366', flex: 1 }]} onPress={shareOnWhatsApp} activeOpacity={0.8}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>📲 WhatsApp से Share करें</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.copyBtn, { borderColor: colors.border }]} onPress={copyLink} activeOpacity={0.8}>
                <Feather name="copy" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Config */}
          <Text style={s.sectionTitle}>Form Settings</Text>

          <View style={s.field}>
            <Text style={s.label}>Default Visiting Charge (₹)</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Customer को form में यही charge दिखेगा</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 500"
              placeholderTextColor={colors.mutedForeground}
              value={defaultVisitingCharge}
              onChangeText={setDefaultVisitingCharge}
              keyboardType="numeric"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Custom Message (optional)</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Form के top पर customer को दिखेगा</Text>
            <TextInput
              style={[s.input, { height: 88, textAlignVertical: 'top' }]}
              placeholder="e.g. नमस्ते! Form भरें, हम जल्द आएंगे। AC service के लिए ₹500 visiting charge लगेगा।"
              placeholderTextColor={colors.mutedForeground}
              value={customMessage}
              onChangeText={setCustomMessage}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: saved ? '#22c55e' : colors.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name={saved ? 'check' : 'save'} size={17} color="#000" />
                <Text style={s.saveBtnText}>{saved ? 'Saved!' : 'Save करें'}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Preview note */}
          <View style={[s.previewNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.mutedForeground, lineHeight: 18 }}>
              Customer form open करेगा → details भरेगा → Submit करने पर आपको notification मिलेगी। Customer को "धन्यवाद" confirmation दिखेगी।
            </Text>
          </View>
        </ScrollView>
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
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },

  linkCard: {
    borderRadius: 14, padding: 14, borderWidth: 1.5,
  },
  linkBtns: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  shareBtn: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  copyBtn: {
    width: 44, height: 44, borderRadius: 10,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: c.foreground },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: c.foreground },
  input: {
    backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: c.foreground,
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 14, gap: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },

  previewNote: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderRadius: 10, padding: 12, borderWidth: 1,
  },
});
