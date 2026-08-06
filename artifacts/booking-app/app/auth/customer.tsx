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
import { useCustomerSignup, useCustomerLogin } from '@workspace/api-client-react';

type Mode = 'options' | 'signup' | 'login' | 'success';

export default function CustomerAuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { login } = useAppAuth();

  const [mode, setMode] = useState<Mode>('options');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);

  const signup = useCustomerSignup();
  const loginMutation = useCustomerLogin();

  const s = styles(colors);

  const handleSignup = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Name जरूरी है।'); return; }
    setLoading(true);
    try {
      const cust = await signup.mutateAsync({ data: { name: name.trim(), phone: phone.trim() || undefined } });
      await login({
        userType: 'customer',
        uniqueCode: cust.uniqueCode,
        name: cust.name,
        phone: cust.phone ?? undefined,
      });
      setGeneratedCode(cust.uniqueCode);
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
    if (!code.startsWith('CUST-') || code.length < 10) {
      Alert.alert('Invalid Code', 'CUST- से शुरू होने वाला valid code दर्ज करें।'); return;
    }
    setLoading(true);
    try {
      const cust = await loginMutation.mutateAsync({ data: { uniqueCode: code } });
      await login({
        userType: 'customer',
        uniqueCode: cust.uniqueCode,
        name: cust.name,
        phone: cust.phone ?? undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/more' as any);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        Alert.alert('Invalid Code', 'यह code किसी Customer से match नहीं हुआ।');
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
  };

  // ── Success screen ──
  if (mode === 'success') {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: topPad, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }]}>
        <View style={[s.codeCard, { borderColor: '#3b82f6' }]}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>🎉</Text>
          <Text style={[s.codeTitle, { color: colors.foreground }]}>Welcome, {name}!</Text>
          <Text style={[s.codeSub, { color: colors.mutedForeground }]}>
            अगली बार login करने के लिए यह code save करें
          </Text>
          <View style={[s.codeBox, { backgroundColor: '#3b82f622', borderColor: '#3b82f6' }]}>
            <Text style={{ color: '#3b82f6', fontSize: 24, fontWeight: '900', letterSpacing: 3 }}>{generatedCode}</Text>
          </View>
          <TouchableOpacity style={[s.copyBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={copyCode}>
            <Feather name="copy" size={16} color={colors.foreground} />
            <Text style={[s.copyText, { color: colors.foreground }]}>Code Copy करें</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.continueBtn, { backgroundColor: '#3b82f6' }]}
            onPress={() => router.replace('/(tabs)' as any)}
          >
            <Text style={{ fontWeight: '800', color: '#fff', fontSize: 16 }}>Booking शुरू करें</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Options screen ──
  if (mode === 'options') {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: topPad, paddingHorizontal: 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
          <Text style={{ fontSize: 48 }}>👤</Text>
          <Text style={[s.codeTitle, { color: colors.foreground }]}>Customer Section</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center' }}>
            आप कैसे continue करना चाहते हैं?
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          {/* Guest option */}
          <TouchableOpacity
            style={[s.optCard, { borderColor: colors.border }]}
            onPress={() => { router.back(); router.back(); }}
            activeOpacity={0.8}
          >
            <View style={[s.optIcon, { backgroundColor: '#6b728022' }]}>
              <Feather name="zap" size={24} color="#6b7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optTitle}>Guest के रूप में Book करें</Text>
              <Text style={s.optSub}>सीधे form भरें — कोई account नहीं चाहिए</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Sign up */}
          <TouchableOpacity
            style={[s.optCard, { borderColor: '#3b82f6' }]}
            onPress={() => setMode('signup')}
            activeOpacity={0.8}
          >
            <View style={[s.optIcon, { backgroundColor: '#3b82f622' }]}>
              <Feather name="user-plus" size={24} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optTitle}>नया Account बनाएं</Text>
              <Text style={s.optSub}>Unique ID पाएं, bookings track करें</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#3b82f6" />
          </TouchableOpacity>

          {/* Login */}
          <TouchableOpacity
            style={[s.optCard, { borderColor: colors.border }]}
            onPress={() => setMode('login')}
            activeOpacity={0.8}
          >
            <View style={[s.optIcon, { backgroundColor: colors.card }]}>
              <Feather name="log-in" size={24} color={colors.foreground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optTitle}>पहले से Account है?</Text>
              <Text style={s.optSub}>CUST-XXXXXX code से login करें</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Signup / Login form ──
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => setMode('options')} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.codeTitle}>
          {mode === 'signup' ? 'नया Account' : 'Login करें'}
        </Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40, gap: 14 }}
      >
        {mode === 'signup' ? (
          <>
            <Text style={s.label}>आपका नाम *</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={name} onChangeText={setName}
              placeholder="पूरा नाम"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={s.label}>Phone Number</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={phone} onChangeText={setPhone}
              placeholder="10-अंक का number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad" maxLength={10}
            />
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: '#3b82f6' }, (!name.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleSignup} disabled={!name.trim() || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={[s.submitText, { color: '#fff' }]}>Account बनाएं</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[s.infoBox, { backgroundColor: '#0f1f3d', borderColor: '#1e3a8a' }]}>
              <Feather name="info" size={16} color="#60a5fa" />
              <Text style={{ color: '#60a5fa', fontSize: 13, flex: 1, lineHeight: 18 }}>
                वह CUST-XXXXXX code दर्ज करें जो signup के समय मिला था।
              </Text>
            </View>
            <Text style={s.label}>Customer Code *</Text>
            <TextInput
              style={[s.input, { color: '#3b82f6', borderColor: '#3b82f6', backgroundColor: colors.card, fontSize: 18, fontWeight: '700', letterSpacing: 2, textAlign: 'center' }]}
              value={loginCode}
              onChangeText={(t) => setLoginCode(t.toUpperCase())}
              placeholder="CUST-XXXXXX"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters" autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: '#3b82f6' }, (!loginCode.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleLogin} disabled={!loginCode.trim() || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={[s.submitText, { color: '#fff' }]}>Login करें</Text>}
            </TouchableOpacity>
          </>
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
  label: { fontSize: 13, fontWeight: '600', color: c.mutedForeground },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { fontWeight: '800', fontSize: 16 },
  infoBox: { flexDirection: 'row', gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: 'flex-start' },
  optCard: {
    backgroundColor: c.card, borderRadius: 16, borderWidth: 1.5,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  optIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 15, fontWeight: '700', color: c.foreground },
  optSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  // Code display
  codeCard: {
    backgroundColor: c.card, borderRadius: 20, borderWidth: 1.5,
    padding: 24, width: '100%', gap: 12, alignItems: 'center',
  },
  codeTitle: { fontSize: 20, fontWeight: '800', color: c.foreground },
  codeSub: { fontSize: 13, textAlign: 'center' },
  codeBox: { borderWidth: 2, borderRadius: 14, borderStyle: 'dashed', paddingVertical: 16, paddingHorizontal: 28 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  copyText: { fontSize: 14, fontWeight: '600' },
  continueBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%' },
});
