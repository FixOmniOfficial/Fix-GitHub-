import React, { useState, useRef } from 'react';
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
import { useGoogleAuth, type GoogleUser } from '@/hooks/useGoogleAuth';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const callApi = async (path: string, body: object) => {
  const r = await fetch(`${BASE_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data;
};

type AuthTab  = 'email' | 'otp';
type EmailMode = 'login' | 'signup';
type Screen   = 'options' | 'auth' | 'otp_input' | 'success';

export default function CustomerAuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { login, getCodeByEmail, saveEmailMapping } = useAppAuth();
  const s = styles(colors);

  const [screen, setScreen]         = useState<Screen>('options');
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGLoading] = useState(false);
  const [tab, setTab]               = useState<AuthTab>('email');
  const [emailMode, setEmailMode]   = useState<EmailMode>('login');
  const [successName, setSuccessName] = useState('');

  // ── Email / Password fields ──────────────────────────
  const [eName, setEName]           = useState('');
  const [eEmail, setEEmail]         = useState('');
  const [ePhone, setEPhone]         = useState('');
  const [ePass, setEPass]           = useState('');
  const [showPass, setShowPass]     = useState(false);

  // ── OTP fields ────────────────────────────────────────
  const [otpPhone, setOtpPhone]     = useState('');
  const [demoOtp, setDemoOtp]       = useState('');
  const [otpInput, setOtpInput]     = useState('');
  const otpRef = useRef<TextInput>(null);

  // ── Google Auth ──────────────────────────────────────
  const { promptAsync, isConfigured } = useGoogleAuth(handleGoogleSuccess);

  async function handleGoogleSuccess(gUser: GoogleUser) {
    setGLoading(true);
    try {
      const existingCode = await getCodeByEmail(gUser.email);
      if (existingCode) {
        const data = await callApi('/booking/customer/login', { uniqueCode: existingCode });
        await login({ userType: 'customer', uniqueCode: data.uniqueCode, name: data.name, phone: data.phone ?? undefined, email: gUser.email, avatar: gUser.picture, loginMethod: 'google' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)' as any);
      } else {
        const data = await callApi('/booking/customer/signup-email', { name: gUser.name, email: gUser.email, password: `G_${Date.now()}` });
        await saveEmailMapping(gUser.email, data.uniqueCode);
        await login({ userType: 'customer', uniqueCode: data.uniqueCode, name: data.name, email: gUser.email, avatar: gUser.picture, loginMethod: 'google' });
        setSuccessName(data.name);
        setScreen('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Google login failed। कृपया दोबारा try करें।');
    } finally { setGLoading(false); }
  }

  const handleGooglePress = async () => {
    if (!isConfigured) {
      Alert.alert('Google Sign-In', 'Google Client ID configure नहीं है। Email से login करें।', [{ text: 'OK' }]);
      return;
    }
    setGLoading(true);
    try { await promptAsync(); } finally { setGLoading(false); }
  };

  // ── Email signup ──────────────────────────────────────
  const handleEmailSignup = async () => {
    if (!eName.trim()) { Alert.alert('', 'नाम जरूरी है।'); return; }
    if (!eEmail.trim()) { Alert.alert('', 'Email जरूरी है।'); return; }
    if (ePass.length < 6) { Alert.alert('', 'Password कम से कम 6 characters का होना चाहिए।'); return; }
    setLoading(true);
    try {
      const data = await callApi('/booking/customer/signup-email', {
        name: eName.trim(), email: eEmail.trim().toLowerCase(),
        password: ePass, phone: ePhone.trim() || undefined,
      });
      await login({ userType: 'customer', uniqueCode: data.uniqueCode, name: data.name, phone: data.phone ?? undefined, email: data.email ?? undefined, loginMethod: 'code' });
      setSuccessName(data.name);
      setScreen('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Signup failed।');
    } finally { setLoading(false); }
  };

  // ── Email login ───────────────────────────────────────
  const handleEmailLogin = async () => {
    if (!eEmail.trim()) { Alert.alert('', 'Email जरूरी है।'); return; }
    if (!ePass) { Alert.alert('', 'Password जरूरी है।'); return; }
    setLoading(true);
    try {
      const data = await callApi('/booking/customer/login-email', {
        email: eEmail.trim().toLowerCase(), password: ePass,
      });
      await login({ userType: 'customer', uniqueCode: data.uniqueCode, name: data.name, phone: data.phone ?? undefined, email: data.email ?? undefined, loginMethod: 'code' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      Alert.alert('Login Failed', e.message ?? 'Email या Password गलत है।');
    } finally { setLoading(false); }
  };

  // ── Request OTP ───────────────────────────────────────
  const handleRequestOtp = async () => {
    const ph = otpPhone.trim().replace(/\D/g, '');
    if (ph.length < 10) { Alert.alert('', 'Valid 10-digit mobile number दर्ज करें।'); return; }
    setLoading(true);
    try {
      const res = await callApi('/booking/customer/request-otp', { phone: ph });
      setDemoOtp(res.demoOtp ?? '');
      setOtpInput('');
      setScreen('otp_input');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => otpRef.current?.focus(), 400);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'OTP request failed।');
    } finally { setLoading(false); }
  };

  // ── Verify OTP ────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpInput.trim().length < 6) { Alert.alert('', '6-digit OTP दर्ज करें।'); return; }
    setLoading(true);
    try {
      const data = await callApi('/booking/customer/verify-otp', {
        phone: otpPhone.trim().replace(/\D/g, ''), otp: otpInput.trim(),
      });
      await login({ userType: 'customer', uniqueCode: data.uniqueCode, name: data.name, phone: data.phone ?? undefined, loginMethod: 'code' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      Alert.alert('OTP गलत है', e.message ?? 'कृपया सही OTP डालें।');
    } finally { setLoading(false); }
  };

  // ════════ SCREENS ════════════════════════════════════

  // ── Success ────────────────────────────────────────
  if (screen === 'success') {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingTop: topPad }]}>
        <View style={[s.card, { borderColor: '#3b82f6' }]}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>🎉</Text>
          <Text style={[s.bigTitle, { color: colors.foreground }]}>Welcome, {successName}!</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center' }}>
            आपका account successfully बन गया है।
          </Text>
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: '#3b82f6', width: '100%' }]}
            onPress={() => router.replace('/(tabs)' as any)}>
            <Text style={[s.submitText, { color: '#fff' }]}>Booking शुरू करें</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── OTP input screen ──────────────────────────────
  if (screen === 'otp_input') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={() => { setScreen('auth'); setDemoOtp(''); }} style={s.iconBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>OTP Verify करें</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>{otpPhone} पर OTP भेजा गया</Text>
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}>

          {/* Demo OTP banner */}
          {demoOtp ? (
            <View style={[s.infoBox, { backgroundColor: '#1c2a00', borderColor: '#84cc16' }]}>
              <Feather name="terminal" size={16} color="#84cc16" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#84cc16', fontWeight: '800', fontSize: 13 }}>Demo OTP: {demoOtp}</Text>
                <Text style={{ color: '#84cc16', fontSize: 11, marginTop: 2 }}>
                  SMS integration pending — production में real SMS आएगा
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={[s.label, { color: colors.mutedForeground }]}>6-Digit OTP *</Text>
          <TextInput
            ref={otpRef}
            style={[s.input, { color: colors.foreground, borderColor: '#3b82f6', backgroundColor: colors.card, fontSize: 28, fontWeight: '900', letterSpacing: 8, textAlign: 'center' }]}
            value={otpInput} onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="------" placeholderTextColor={colors.mutedForeground + '55'}
            keyboardType="number-pad" maxLength={6}
          />

          <TouchableOpacity style={[s.submitBtn, { backgroundColor: '#3b82f6' }, (otpInput.length < 6 || loading) && { opacity: 0.5 }]}
            onPress={handleVerifyOtp} disabled={otpInput.length < 6 || loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Feather name="check-circle" size={18} color="#fff" />
                  <Text style={[s.submitText, { color: '#fff' }]}>Verify & Login</Text>
                </View>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRequestOtp} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
              OTP नहीं मिला?{' '}
              <Text style={{ color: '#3b82f6', fontWeight: '700' }}>दोबारा भेजें</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Options screen ────────────────────────────────
  if (screen === 'options') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Customer Login</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>अपना account चुनें</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
            <Text style={{ fontSize: 52 }}>👤</Text>
            <Text style={[s.bigTitle, { color: colors.foreground }]}>Customer Section</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center' }}>
              आप कैसे continue करना चाहते हैं?
            </Text>
          </View>

          {/* Google */}
          <TouchableOpacity style={s.googleBtn} onPress={handleGooglePress} disabled={googleLoading}>
            {googleLoading ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <View style={s.googleIcon}><Text style={{ fontSize: 18, fontWeight: '900', color: '#4285F4' }}>G</Text></View>
                <Text style={s.googleBtnText}>Google / Gmail से Login</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[s.dividerText, { color: colors.mutedForeground }]}>या</Text>
            <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Email + Password */}
          <TouchableOpacity style={[s.optCard, { borderColor: '#3b82f6' }]} onPress={() => { setTab('email'); setScreen('auth'); }}>
            <View style={[s.optIcon, { backgroundColor: '#3b82f622' }]}>
              <Feather name="mail" size={22} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optTitle}>Email + Password</Text>
              <Text style={s.optSub}>Signup करें या email से login करें</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#3b82f6" />
          </TouchableOpacity>

          {/* Mobile OTP */}
          <TouchableOpacity style={[s.optCard, { borderColor: '#10b981' }]} onPress={() => { setTab('otp'); setScreen('auth'); }}>
            <View style={[s.optIcon, { backgroundColor: '#10b98122' }]}>
              <Feather name="smartphone" size={22} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optTitle}>Mobile OTP से Login</Text>
              <Text style={s.optSub}>Phone number पर OTP पाएं</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#10b981" />
          </TouchableOpacity>

          {/* Guest */}
          <TouchableOpacity style={[s.optCard, { borderColor: colors.border }]} onPress={() => { router.back(); }}>
            <View style={[s.optIcon, { backgroundColor: colors.card }]}>
              <Feather name="zap" size={22} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optTitle}>Guest के रूप में Book करें</Text>
              <Text style={s.optSub}>कोई account नहीं — सीधे form भरें</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Auth screen (Email tab + OTP tab) ─────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => setScreen('options')} style={s.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {tab === 'email' ? 'Email / Password' : 'Mobile OTP'}
        </Text>
      </View>

      {/* Tab switcher */}
      <View style={[s.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={[s.tabBtn, tab === 'email' && { backgroundColor: '#3b82f6' }]} onPress={() => setTab('email')}>
          <Feather name="mail" size={14} color={tab === 'email' ? '#fff' : colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: tab === 'email' ? '#fff' : colors.mutedForeground }}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'otp' && { backgroundColor: '#10b981' }]} onPress={() => setTab('otp')}>
          <Feather name="smartphone" size={14} color={tab === 'otp' ? '#fff' : colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: tab === 'otp' ? '#fff' : colors.mutedForeground }}>OTP</Text>
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}>

        {tab === 'email' ? (
          <>
            {/* Login / Signup toggle */}
            <View style={[s.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity style={[s.tabBtn, emailMode === 'login' && { backgroundColor: '#3b82f622' }]} onPress={() => setEmailMode('login')}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: emailMode === 'login' ? '#3b82f6' : colors.mutedForeground }}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tabBtn, emailMode === 'signup' && { backgroundColor: '#3b82f622' }]} onPress={() => setEmailMode('signup')}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: emailMode === 'signup' ? '#3b82f6' : colors.mutedForeground }}>Signup</Text>
              </TouchableOpacity>
            </View>

            {emailMode === 'signup' && (
              <>
                <Text style={[s.label, { color: colors.mutedForeground }]}>आपका नाम *</Text>
                <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={eName} onChangeText={setEName} placeholder="पूरा नाम" placeholderTextColor={colors.mutedForeground} />
                <Text style={[s.label, { color: colors.mutedForeground }]}>Phone (Optional)</Text>
                <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={ePhone} onChangeText={setEPhone} placeholder="10-digit number"
                  placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" maxLength={10} />
              </>
            )}

            <Text style={[s.label, { color: colors.mutedForeground }]}>Email *</Text>
            <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={eEmail} onChangeText={setEEmail} placeholder="example@gmail.com"
              placeholderTextColor={colors.mutedForeground} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

            <Text style={[s.label, { color: colors.mutedForeground }]}>Password *</Text>
            <View style={{ position: 'relative' }}>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, paddingRight: 48 }]}
                value={ePass} onChangeText={setEPass}
                placeholder={emailMode === 'signup' ? 'कम से कम 6 characters' : 'Password'}
                placeholderTextColor={colors.mutedForeground} secureTextEntry={!showPass} />
              <TouchableOpacity onPress={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: '#3b82f6' }, loading && { opacity: 0.5 }]}
              onPress={emailMode === 'signup' ? handleEmailSignup : handleEmailLogin}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={[s.submitText, { color: '#fff' }]}>
                    {emailMode === 'signup' ? 'Account बनाएं' : 'Login करें'}
                  </Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[s.infoBox, { backgroundColor: '#052e16', borderColor: '#10b981' }]}>
              <Feather name="smartphone" size={16} color="#10b981" />
              <Text style={{ color: '#10b981', fontSize: 13, flex: 1, lineHeight: 18 }}>
                अपना mobile number दर्ज करें। OTP आपके phone पर भेजा जाएगा।
              </Text>
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>Mobile Number *</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: '#10b981', backgroundColor: colors.card, fontSize: 20, fontWeight: '700', letterSpacing: 2, textAlign: 'center' }]}
              value={otpPhone} onChangeText={setOtpPhone}
              placeholder="10-digit number" placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad" maxLength={10}
            />

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: '#10b981' }, (!otpPhone.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleRequestOtp} disabled={!otpPhone.trim() || loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Feather name="send" size={18} color="#fff" />
                    <Text style={[s.submitText, { color: '#fff' }]}>OTP भेजें</Text>
                  </View>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: c.foreground },
  headerSub:    { fontSize: 12, marginTop: 2 },
  iconBtn:      { padding: 6 },
  bigTitle:     { fontSize: 20, fontWeight: '800' },
  label:        { fontSize: 13, fontWeight: '600' },
  input:        { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15 },
  submitBtn:    { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitText:   { fontWeight: '800', fontSize: 16 },
  infoBox:      { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'flex-start' },
  tabBar:       { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, gap: 4, margin: Platform.OS === 'web' ? 0 : 0 },
  tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  optCard:      { backgroundColor: c.card, borderRadius: 16, borderWidth: 1.5, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optIcon:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optTitle:     { fontSize: 15, fontWeight: '700', color: c.foreground },
  optSub:       { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  dividerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine:  { flex: 1, height: 1 },
  dividerText:  { fontSize: 12, fontWeight: '600' },
  googleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 1.5, borderColor: '#4285F4', paddingVertical: 15, paddingHorizontal: 20, minHeight: 54 },
  googleIcon:   { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center', marginRight: 30 },
  card:         { backgroundColor: c.card, borderRadius: 20, borderWidth: 1.5, padding: 24, width: '100%', gap: 12, alignItems: 'center' },
});
