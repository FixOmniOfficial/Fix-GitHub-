/**
 * Customer Authentication Screen
 * - Login: Mobile/Email + Password (2 fields, clean minimal UI)
 * - Register: Full Name, Mobile, Email, Password
 * - Forgot Password: Email → OTP (30s resend timer) → New Password
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const api = async (path: string, body: object) => {
  const r = await fetch(`${BASE_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data;
};

type Tab    = 'login' | 'register';
type Screen = 'auth' | 'forgot_email' | 'forgot_otp' | 'new_password' | 'success';

const RESEND_SECONDS = 30;

export default function CustomerAuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAppAuth();
  const { t } = useLanguage();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const s = styles(colors);

  const [screen, setScreen]     = useState<Screen>('auth');
  const [tab, setTab]           = useState<Tab>('login');
  const [loading, setLoading]   = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // ── Login fields ──────────────────────────────────────────────────
  const [loginInput, setLoginInput] = useState('');   // mobile or email
  const [loginPass, setLoginPass]   = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // ── Register fields ───────────────────────────────────────────────
  const [regName, setRegName]   = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass]   = useState('');
  const [showRegPass, setShowRegPass] = useState(false);

  // ── Forgot password fields ────────────────────────────────────────
  const [forgotEmail, setForgotEmail]   = useState('');
  const [forgotOtp, setForgotOtp]       = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [showNewPass, setShowNewPass]   = useState(false);
  const [demoOtp, setDemoOtp]           = useState('');
  const [resendTimer, setResendTimer]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRef   = useRef<TextInput>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startResendTimer() {
    setResendTimer(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setResendTimer(v => {
        if (v <= 1) { clearInterval(timerRef.current!); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  // ── Login ─────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginInput.trim()) { Alert.alert('', t.mobileOrEmail + ' जरूरी है।'); return; }
    if (!loginPass)         { Alert.alert('', t.password + ' जरूरी है।'); return; }
    setLoading(true);
    try {
      const data = await api('/booking/customer/login-v2', {
        mobileOrEmail: loginInput.trim(),
        password: loginPass,
      });
      await login({
        userType: 'customer',
        uniqueCode: data.uniqueCode,
        name: data.name,
        phone: data.phone ?? undefined,
        email: data.email ?? undefined,
        loginMethod: 'password',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Login failed');
    } finally { setLoading(false); }
  };

  // ── Register ──────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!regName.trim())  { Alert.alert('', t.fullName + ' जरूरी है।'); return; }
    if (!regPhone.trim()) { Alert.alert('', t.mobileNumber + ' जरूरी है।'); return; }
    if (!regEmail.trim()) { Alert.alert('', t.emailId + ' जरूरी है।'); return; }
    if (regPass.length < 8) { Alert.alert('', 'Password कम से कम 8 characters का होना चाहिए।'); return; }
    setLoading(true);
    try {
      const data = await api('/booking/customer/register', {
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPass,
      });
      await login({
        userType: 'customer',
        uniqueCode: data.uniqueCode,
        name: data.name,
        phone: data.phone ?? undefined,
        email: data.email ?? undefined,
        loginMethod: 'password',
      });
      setSuccessMsg(data.name);
      setScreen('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Registration failed');
    } finally { setLoading(false); }
  };

  // ── Forgot password: Step 1 — send OTP ───────────────────────────
  const handleSendForgotOtp = async () => {
    if (!forgotEmail.trim()) { Alert.alert('', 'Email जरूरी है।'); return; }
    setLoading(true);
    try {
      const res = await api('/booking/customer/forgot-password', { email: forgotEmail.trim().toLowerCase() });
      setDemoOtp(res.demoOtp ?? '');
      setForgotOtp('');
      setScreen('forgot_otp');
      startResendTimer();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => otpRef.current?.focus(), 400);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'OTP request failed');
    } finally { setLoading(false); }
  };

  // ── Forgot password: Step 2 — verify OTP ─────────────────────────
  const handleVerifyForgotOtp = async () => {
    if (forgotOtp.trim().length < 6) { Alert.alert('', '6-digit OTP डालें।'); return; }
    setLoading(true);
    try {
      await api('/booking/customer/verify-otp-email', {
        email: forgotEmail.trim().toLowerCase(), otp: forgotOtp.trim(),
      });
      setScreen('new_password');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'OTP गलत है');
    } finally { setLoading(false); }
  };

  // ── Forgot password: Step 3 — set new password ───────────────────
  const handleResetPassword = async () => {
    if (forgotNewPass.length < 8) { Alert.alert('', 'Password कम से कम 8 characters का होना चाहिए।'); return; }
    setLoading(true);
    try {
      await api('/booking/customer/reset-password', {
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPass,
      });
      Alert.alert('✅ ' + t.resetSuccess, 'अब अपने नए password से login करें।', [{
        text: 'Login करें',
        onPress: () => { setTab('login'); setScreen('auth'); setForgotEmail(''); setForgotOtp(''); setForgotNewPass(''); },
      }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Password reset failed');
    } finally { setLoading(false); }
  };

  // ════════ SCREENS ═══════════════════════════════════════════════

  // ── Success ──────────────────────────────────────────────────────
  if (screen === 'success') {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingTop: topPad }]}>
        <View style={[s.card, { borderColor: '#3b82f6' }]}>
          <Text style={{ fontSize: 52, textAlign: 'center' }}>🎉</Text>
          <Text style={[s.bigTitle, { color: colors.foreground }]}>{t.accountCreated}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center' }}>
            Welcome, {successMsg}! आपका account बन गया है।
          </Text>
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: '#3b82f6', width: '100%' }]}
            onPress={() => router.replace('/(tabs)' as any)}>
            <Text style={[s.submitText, { color: '#fff' }]}>{t.continueToApp}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Forgot — enter email ──────────────────────────────────────────
  if (screen === 'forgot_email') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={() => setScreen('auth')} style={s.iconBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{t.forgotPasswordTitle}</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>{t.forgotPasswordDesc}</Text>
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 60 }}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>{t.emailId} *</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: '#6366f1', backgroundColor: colors.card }]}
            value={forgotEmail} onChangeText={setForgotEmail}
            placeholder="example@gmail.com" placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          />
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: '#6366f1' }, (!forgotEmail.trim() || loading) && { opacity: 0.5 }]}
            onPress={handleSendForgotOtp} disabled={!forgotEmail.trim() || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Feather name="send" size={18} color="#fff" />
                <Text style={[s.submitText, { color: '#fff' }]}>{t.sendOtp}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Forgot — OTP entry ────────────────────────────────────────────
  if (screen === 'forgot_otp') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={() => setScreen('forgot_email')} style={s.iconBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{t.otpVerifyTitle}</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>
              {t.otpSentTo}: {forgotEmail}
            </Text>
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 60 }}>

          {demoOtp ? (
            <View style={[s.infoBox, { backgroundColor: '#1c2a00', borderColor: '#84cc16' }]}>
              <Feather name="terminal" size={16} color="#84cc16" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#84cc16', fontWeight: '800', fontSize: 13 }}>Demo OTP: {demoOtp}</Text>
                <Text style={{ color: '#84cc16', fontSize: 11, marginTop: 2 }}>
                  SMTP configure होने पर real email आएगा
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={[s.label, { color: colors.mutedForeground }]}>{t.enterOtp} *</Text>
          <TextInput
            ref={otpRef}
            style={[s.input, { color: colors.foreground, borderColor: '#6366f1', backgroundColor: colors.card, fontSize: 28, fontWeight: '900', letterSpacing: 8, textAlign: 'center' }]}
            value={forgotOtp} onChangeText={(t) => setForgotOtp(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="——————" placeholderTextColor={colors.mutedForeground + '55'}
            keyboardType="number-pad" maxLength={6}
          />

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: '#6366f1' }, (forgotOtp.length < 6 || loading) && { opacity: 0.5 }]}
            onPress={handleVerifyForgotOtp} disabled={forgotOtp.length < 6 || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={[s.submitText, { color: '#fff' }]}>{t.verifyOtp}</Text>
            )}
          </TouchableOpacity>

          {/* Resend with 30s timer */}
          <TouchableOpacity
            onPress={resendTimer === 0 ? () => { setForgotOtp(''); handleSendForgotOtp(); } : undefined}
            style={{ alignItems: 'center', paddingVertical: 8 }}
            disabled={resendTimer > 0 || loading}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
              {resendTimer > 0
                ? `${t.resendIn} ${resendTimer}${t.seconds}`
                : <Text style={{ color: '#6366f1', fontWeight: '700' }}>{t.resendOtp}</Text>
              }
            </Text>
          </TouchableOpacity>

          <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: 'center' }}>
            OTP 10 minutes तक valid है
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ── Forgot — new password ─────────────────────────────────────────
  if (screen === 'new_password') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={() => setScreen('forgot_otp')} style={s.iconBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t.resetPasswordTitle}</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 60 }}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>{t.newPassword} *</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: '#6366f1', backgroundColor: colors.card, paddingRight: 48 }]}
              value={forgotNewPass} onChangeText={setForgotNewPass}
              placeholder="कम से कम 8 characters" placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showNewPass}
            />
            <TouchableOpacity onPress={() => setShowNewPass(v => !v)}
              style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
              <Feather name={showNewPass ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: '#6366f1' }, (forgotNewPass.length < 8 || loading) && { opacity: 0.5 }]}
            onPress={handleResetPassword} disabled={forgotNewPass.length < 8 || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={[s.submitText, { color: '#fff' }]}>Password Save करें</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Main auth screen — Login / Register tabs ──────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t.customerLogin}</Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground }]}>👤 Customer Section</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={[s.tabBtn, tab === 'login' && { backgroundColor: '#3b82f6' }]} onPress={() => setTab('login')}>
          <Feather name="log-in" size={14} color={tab === 'login' ? '#fff' : colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: tab === 'login' ? '#fff' : colors.mutedForeground }}>{t.login}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'register' && { backgroundColor: '#3b82f6' }]} onPress={() => setTab('register')}>
          <Feather name="user-plus" size={14} color={tab === 'register' ? '#fff' : colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: tab === 'register' ? '#fff' : colors.mutedForeground }}>{t.register}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}>

        {tab === 'login' ? (
          /* ── LOGIN FORM ── */
          <>
            <View style={[s.infoBox, { backgroundColor: colors.card + 'cc', borderColor: colors.border }]}>
              <Feather name="shield" size={15} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1 }}>
                {t.phoneUnique} — अपना registered mobile या email दर्ज करें
              </Text>
            </View>

            {/* Field 1: Mobile or Email */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.mobileOrEmail} *</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: '#3b82f6', backgroundColor: colors.card }]}
              value={loginInput} onChangeText={setLoginInput}
              placeholder="9876543210 या example@gmail.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="default" autoCapitalize="none" autoCorrect={false}
            />

            {/* Field 2: Password with eye toggle */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.password} *</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: '#3b82f6', backgroundColor: colors.card, paddingRight: 48 }]}
                value={loginPass} onChangeText={setLoginPass}
                placeholder={t.password} placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showLoginPass}
              />
              <TouchableOpacity onPress={() => setShowLoginPass(v => !v)}
                style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                <Feather name={showLoginPass ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Forgot Password link */}
            <TouchableOpacity onPress={() => setScreen('forgot_email')} style={{ alignSelf: 'flex-end', marginTop: -6 }}>
              <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600' }}>{t.forgotPassword}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: '#3b82f6' }, (!loginInput.trim() || !loginPass || loading) && { opacity: 0.5 }]}
              onPress={handleLogin} disabled={!loginInput.trim() || !loginPass || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Feather name="log-in" size={18} color="#fff" />
                  <Text style={[s.submitText, { color: '#fff' }]}>{t.login}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setTab('register')} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t.noAccount}{' '}
                <Text style={{ color: '#3b82f6', fontWeight: '700' }}>{t.register}</Text>
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ── REGISTER FORM ── */
          <>
            <View style={[s.infoBox, { backgroundColor: '#052e16', borderColor: '#22c55e55' }]}>
              <Feather name="user-check" size={15} color="#22c55e" />
              <Text style={{ color: '#22c55e', fontSize: 12, flex: 1 }}>
                Free account बनाएं — Bookings track करें, updates पाएं।
              </Text>
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.fullName} *</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={regName} onChangeText={setRegName}
              placeholder="पूरा नाम" placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.mobileNumber} *</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={regPhone} onChangeText={setRegPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad" maxLength={10}
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.emailId} *</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={regEmail} onChangeText={setRegEmail}
              placeholder="example@gmail.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.password} *</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, paddingRight: 48 }]}
                value={regPass} onChangeText={setRegPass}
                placeholder="कम से कम 8 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showRegPass}
              />
              <TouchableOpacity onPress={() => setShowRegPass(v => !v)}
                style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                <Feather name={showRegPass ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: '#3b82f6' }, (!regName.trim() || !regPhone.trim() || !regEmail.trim() || regPass.length < 8 || loading) && { opacity: 0.5 }]}
              onPress={handleRegister}
              disabled={!regName.trim() || !regPhone.trim() || !regEmail.trim() || regPass.length < 8 || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Feather name="user-check" size={18} color="#fff" />
                  <Text style={[s.submitText, { color: '#fff' }]}>Account बनाएं</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setTab('login')} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t.alreadyHaveAccount}{' '}
                <Text style={{ color: '#3b82f6', fontWeight: '700' }}>{t.login}</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: c.foreground },
  headerSub:   { fontSize: 12, marginTop: 2 },
  iconBtn:     { padding: 6 },
  bigTitle:    { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  label:       { fontSize: 13, fontWeight: '600' },
  input:       { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15 },
  submitBtn:   { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitText:  { fontWeight: '800', fontSize: 16 },
  infoBox:     { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'flex-start' },
  tabBar:      { flexDirection: 'row', borderRadius: 0, borderTopWidth: 1, borderBottomWidth: 1, padding: 8, gap: 6, marginHorizontal: 0 },
  tabBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  card:        { backgroundColor: c.card, borderRadius: 20, borderWidth: 1.5, padding: 28, width: '100%', gap: 14, alignItems: 'center' },
});
