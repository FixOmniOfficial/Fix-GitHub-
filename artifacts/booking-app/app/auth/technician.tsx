import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator, Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useTechnicianSignup, useTechnicianLogin } from '@workspace/api-client-react';

const PROFESSION_TYPES = [
  { type: 'ac_technician', label: 'AC Technician', emoji: '❄️' },
  { type: 'electrician',   label: 'Electrician',   emoji: '⚡' },
  { type: 'carpenter',     label: 'Carpenter',      emoji: '🪚' },
  { type: 'plumber',       label: 'Plumber',        emoji: '🔧' },
  { type: 'painter',       label: 'Painter',        emoji: '🖌️' },
  { type: 'repair',        label: 'Repair',         emoji: '⚙️' },
];

type Mode = 'signup' | 'login' | 'success';

export default function TechnicianAuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { login } = useAppAuth();

  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profType, setProfType] = useState('ac_technician');
  const [loginCode, setLoginCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);

  const signup = useTechnicianSignup();
  const loginMutation = useTechnicianLogin();

  const s = styles(colors);

  const handleSignup = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Name जरूरी है।'); return; }
    setLoading(true);
    try {
      const tech = await signup.mutateAsync({ data: { name: name.trim(), phone: phone.trim() || undefined, professionType: profType } });
      await login({
        userType: 'technician',
        uniqueCode: tech.uniqueCode,
        name: tech.name,
        phone: tech.phone ?? undefined,
        professionalId: tech.id,
        professionType: tech.professionType,
      });
      setGeneratedCode(tech.uniqueCode);
      setMode('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Signup failed। कृपया दोबारा try करें।');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const code = loginCode.trim().toUpperCase();
    if (!code.startsWith('TECH-') || code.length < 10) {
      Alert.alert('Invalid Code', 'TECH- से शुरू होने वाला valid code दर्ज करें।'); return;
    }
    setLoading(true);
    try {
      const tech = await loginMutation.mutateAsync({ data: { uniqueCode: code } });
      await login({
        userType: 'technician',
        uniqueCode: tech.uniqueCode,
        name: tech.name,
        phone: tech.phone ?? undefined,
        professionalId: tech.id,
        professionType: tech.professionType,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/technician/home' as any);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        Alert.alert('Invalid Code', 'यह code किसी Technician से match नहीं हुआ।');
      } else {
        Alert.alert('Error', 'Login failed।');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    Clipboard.setString(generatedCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied!', 'Code clipboard में copy हो गया।');
  };

  if (mode === 'success') {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: topPad, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }]}>
        <View style={[s.codeCard, { borderColor: colors.primary }]}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>🎉</Text>
          <Text style={[s.codeTitle, { color: colors.foreground }]}>आपकी Unique ID</Text>
          <Text style={[s.codeSub, { color: colors.mutedForeground }]}>
            इसे संभाल कर रखें — यही आपकी login ID है
          </Text>
          <View style={[s.codeBox, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
            <Text style={[s.codeText, { color: colors.primary }]}>{generatedCode}</Text>
          </View>
          <TouchableOpacity style={[s.copyBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={copyCode}>
            <Feather name="copy" size={16} color={colors.foreground} />
            <Text style={[s.copyText, { color: colors.foreground }]}>Code Copy करें</Text>
          </TouchableOpacity>
          <Text style={[s.codeWarning, { color: '#f59e0b' }]}>
            ⚠️ यह code आपको दोबारा नहीं दिखाया जाएगा। कहीं note करें।
          </Text>
          <TouchableOpacity
            style={[s.continueBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/technician/home' as any)}
          >
            <Text style={{ fontWeight: '800', color: '#000', fontSize: 16 }}>Dashboard पर जाएं</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={s.headerTitle}>Technician Login</Text>
          <Text style={s.headerSub}>🔧 अपना अकाउंट बनाएं या login करें</Text>
        </View>
      </View>

      {/* Mode toggle */}
      <View style={[s.toggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={[s.toggleBtn, mode === 'signup' && { backgroundColor: colors.primary }]} onPress={() => setMode('signup')}>
          <Text style={[s.toggleText, { color: mode === 'signup' ? '#000' : colors.mutedForeground }]}>नया Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggleBtn, mode === 'login' && { backgroundColor: colors.primary }]} onPress={() => setMode('login')}>
          <Text style={[s.toggleText, { color: mode === 'login' ? '#000' : colors.mutedForeground }]}>Login करें</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}
      >
        {mode === 'signup' ? (
          <View style={{ gap: 14 }}>
            <Text style={s.label}>आपका नाम *</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={name} onChangeText={setName}
              placeholder="पूरा नाम लिखें"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={s.label}>Phone Number</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={phone} onChangeText={setPhone}
              placeholder="10-अंक का number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              maxLength={10}
            />

            <Text style={s.label}>आप क्या काम करते हैं? *</Text>
            <View style={s.profGrid}>
              {PROFESSION_TYPES.map(p => (
                <TouchableOpacity
                  key={p.type}
                  style={[s.profCard, { borderColor: profType === p.type ? colors.primary : colors.border, backgroundColor: profType === p.type ? colors.primary + '22' : colors.card }]}
                  onPress={() => setProfType(p.type)}
                >
                  <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                  <Text style={[s.profLabel, { color: profType === p.type ? colors.primary : colors.foreground }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: colors.primary }, (!name.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleSignup}
              disabled={!name.trim() || loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>Register करें → Unique ID पाएं</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View style={[s.infoBox, { backgroundColor: '#1c1400', borderColor: '#92400e' }]}>
              <Feather name="info" size={16} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontSize: 13, flex: 1, lineHeight: 18 }}>
                अपना TECH-XXXXXX code दर्ज करें जो signup के समय मिला था।
              </Text>
            </View>
            <Text style={s.label}>Technician Code *</Text>
            <TextInput
              style={[s.input, { color: colors.primary, borderColor: colors.primary, backgroundColor: colors.card, fontSize: 18, fontWeight: '700', letterSpacing: 2, textAlign: 'center' }]}
              value={loginCode}
              onChangeText={(t) => setLoginCode(t.toUpperCase())}
              placeholder="TECH-XXXXXX"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: colors.primary }, (!loginCode.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleLogin}
              disabled={!loginCode.trim() || loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>Login करें</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  toggle: {
    flexDirection: 'row', margin: 16, borderRadius: 12,
    borderWidth: 1, padding: 4, gap: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: c.mutedForeground },
  input: {
    borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15,
  },
  profGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profCard: {
    width: '30%', borderRadius: 12, borderWidth: 1.5,
    padding: 12, alignItems: 'center', gap: 6,
  },
  profLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { fontWeight: '800', color: '#000', fontSize: 16 },
  infoBox: { flexDirection: 'row', gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: 'flex-start' },
  // Success
  codeCard: {
    backgroundColor: c.card, borderRadius: 20, borderWidth: 1.5,
    padding: 24, width: '100%', gap: 12, alignItems: 'center',
  },
  codeTitle: { fontSize: 22, fontWeight: '800' },
  codeSub: { fontSize: 13, textAlign: 'center' },
  codeBox: {
    borderWidth: 2, borderRadius: 14, borderStyle: 'dashed',
    paddingVertical: 16, paddingHorizontal: 28, alignItems: 'center',
  },
  codeText: { fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10,
  },
  copyText: { fontSize: 14, fontWeight: '600' },
  codeWarning: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  continueBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%' },
});
