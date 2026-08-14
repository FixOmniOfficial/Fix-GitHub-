/**
 * Technician Authentication Screen
 * - Login: Mobile/Email + Technician ID + Password (3 mandatory fields)
 * - Register: Full Name, Mobile, Email, Password → auto-assigned TECH code
 * - Forgot Password: Email → OTP (30s resend timer) → New Password
 * - Temp Passcode login: TECH ID + temp passcode → force password change
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator, Clipboard, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import PhoneInput from '@/components/PhoneInput';

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

const PROFESSION_TYPES = [
  { type: 'ac_technician', label: 'AC Technician', emoji: '❄️' },
  { type: 'electrician',   label: 'Electrician',   emoji: '⚡' },
  { type: 'carpenter',     label: 'Carpenter',      emoji: '🪚' },
  { type: 'plumber',       label: 'Plumber',        emoji: '🔧' },
  { type: 'painter',       label: 'Painter',        emoji: '🎨' },
  { type: 'repair',        label: 'Repair',         emoji: '⚙️' },
];

type Tab    = 'login' | 'register' | 'temp';
type Screen = 'auth' | 'forgot_email' | 'forgot_otp' | 'new_password' | 'set_password_forced' | 'success';

const RESEND_SECONDS = 30;

export default function TechnicianAuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAppAuth();
  const { t } = useLanguage();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const s = styles(colors);

  const [screen, setScreen]   = useState<Screen>('auth');
  const [tab, setTab]         = useState<Tab>('login');
  const [loading, setLoading] = useState(false);

  // ── Login fields (3 mandatory) ────────────────────────────────────
  const [loginInput, setLoginInput] = useState('');   // mobile or email
  const [loginTechId, setLoginTechId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // ── Field-specific login errors + shake animation ─────────────────
  const [loginInputErr,  setLoginInputErr]  = useState('');
  const [loginTechIdErr, setLoginTechIdErr] = useState('');
  const [loginPassErr,   setLoginPassErr]   = useState('');
  const shakeInput  = useRef(new Animated.Value(0)).current;
  const shakeTechId = useRef(new Animated.Value(0)).current;
  const shakePass   = useRef(new Animated.Value(0)).current;

  const triggerShake = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 8,   duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8,  duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── Register fields ───────────────────────────────────────────────
  const [regName, setRegName]     = useState('');
  const [regPhone, setRegPhone]   = useState('');
  const [regEmail, setRegEmail]   = useState('');
  const [regPass, setRegPass]     = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [profType, setProfType]   = useState('ac_technician');
  const [generatedCode, setGeneratedCode] = useState('');

  // ── Temp passcode login ───────────────────────────────────────────
  const [tempTechId, setTempTechId] = useState('');
  const [tempPasscode, setTempPasscode] = useState('');
  const [loggedInTech, setLoggedInTech] = useState<any>(null);

  // ── Forced password change (after temp passcode login) ───────────
  const [forcedNewPass, setForcedNewPass] = useState('');
  const [showForcedPass, setShowForcedPass] = useState(false);

  // ── Forgot password fields ────────────────────────────────────────
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp]     = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [demoOtp, setDemoOtp]         = useState('');
  const [resendTimer, setResendTimer] = useState(0);
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

  // ── Login (3-field) with field-specific error feedback ───────────
  const handleLogin = async () => {
    // Clear previous errors
    setLoginInputErr(''); setLoginTechIdErr(''); setLoginPassErr('');
    // Client-side required checks
    if (!loginInput.trim()) {
      setLoginInputErr(t.mobileOrEmail + ' is required.');
      triggerShake(shakeInput); return;
    }
    if (!loginTechId.trim()) {
      setLoginTechIdErr(t.techId + ' is required.');
      triggerShake(shakeTechId); return;
    }
    if (!loginPass) {
      setLoginPassErr(t.password + ' is required.');
      triggerShake(shakePass); return;
    }
    setLoading(true);
    try {
      const BASE = process.env.EXPO_PUBLIC_API_URL ?? '';
      const r = await fetch(`${BASE}/api/booking/technician/login-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: loginInput.trim(), techId: loginTechId.trim().toUpperCase(), password: loginPass }),
      });
      const data = await r.json();
      if (!r.ok) {
        // Route error to the exact field the server flagged
        const field: string = data.field ?? '';
        const msg: string = data.error ?? 'Login failed';
        if (field === 'mobileOrEmail') { setLoginInputErr(msg);  triggerShake(shakeInput);  }
        else if (field === 'techId')   { setLoginTechIdErr(msg); triggerShake(shakeTechId); }
        else if (field === 'password') { setLoginPassErr(msg);   triggerShake(shakePass);   }
        else                           { Alert.alert(t.error, msg); }
        return;
      }
      await login({
        userType: 'technician',
        uniqueCode: data.uniqueCode,
        name: data.name,
        phone: data.phone ?? undefined,
        email: data.email ?? undefined,
        avatar: data.avatarUrl ?? undefined,
        professionalId: data.id,
        professionType: data.professionType,
        loginMethod: 'password',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/technician/home' as any);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Login failed');
    } finally { setLoading(false); }
  };

  // ── Register ──────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!regName.trim())  { Alert.alert('', t.fullName + ' is required.'); return; }
    if (!regPhone.trim()) { Alert.alert('', t.mobileNumber + ' is required.'); return; }
    if (!regEmail.trim()) { Alert.alert('', t.emailId + ' is required.'); return; }
    if (regPass.length < 8) { Alert.alert('', 'Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const data = await api('/booking/technician/register', {
        name: regName.trim(), phone: regPhone.trim(),
        email: regEmail.trim().toLowerCase(), password: regPass,
        professionType: profType,
      });
      await login({
        userType: 'technician',
        uniqueCode: data.uniqueCode,
        name: data.name,
        phone: data.phone ?? undefined,
        email: data.email ?? undefined,
        professionalId: data.id,
        professionType: data.professionType,
        loginMethod: 'password',
      });
      setGeneratedCode(data.uniqueCode);
      setScreen('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Registration failed');
    } finally { setLoading(false); }
  };

  // ── Temp passcode login ───────────────────────────────────────────
  const handleTempLogin = async () => {
    if (!tempTechId.trim()) { Alert.alert('', t.techId + ' is required.'); return; }
    if (!tempPasscode.trim()) { Alert.alert('', 'Temporary Passcode is required.'); return; }
    setLoading(true);
    try {
      const data = await api('/booking/technician/temp-passcode-login', {
        techId: tempTechId.trim().toUpperCase(),
        tempPasscode: tempPasscode.trim(),
      });
      // Don't fully login yet — force password change first
      setLoggedInTech(data);
      setScreen('set_password_forced');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Login failed');
    } finally { setLoading(false); }
  };

  // ── Forced password set (after temp passcode) ─────────────────────
  const handleSetForcedPassword = async () => {
    if (forcedNewPass.length < 8) {
      Alert.alert('', 'Password must be at least 8 characters.'); return;
    }
    setLoading(true);
    try {
      // We use reset-password with the already-verified temp passcode token
      // Since temp passcode cleared server-side, we need to use forgot flow approach
      // Instead: call a set-password endpoint using the OTP field approach
      // For simplicity: use forgot-password → reset cycle won't work here (no OTP)
      // We'll directly update via a dedicated reset using the uniqueCode
      const BASE = BASE_URL;
      const r = await fetch(`${BASE}/api/booking/technician/login-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // Actually we need a different approach - post directly to forgot then verify
      // Simplest: use the technician's email + send OTP via admin, then reset
      // For this forced flow, we'll call a special update using uniqueCode directly
      // Use the POST /booking/technician/forgot-password then reset flow
      // But that requires email. Let's use the direct approach:
      const techEmail = loggedInTech?.email;
      if (!techEmail) {
        Alert.alert('Error', 'Email not registered. Please contact Admin.');
        setLoading(false);
        return;
      }
      // Send OTP to email (auto)
      const otp6 = await api('/booking/technician/forgot-password', { email: techEmail });
      // For forced flow, we need user to get the OTP — but this is post-temp-login
      // Instead, store in state and navigate to OTP screen
      setForgotEmail(techEmail);
      setDemoOtp(otp6.demoOtp ?? '');
      setForgotOtp('');
      setScreen('forgot_otp');
      startResendTimer();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Failed');
    } finally { setLoading(false); }
  };

  // ── Forgot password steps ─────────────────────────────────────────
  const handleSendForgotOtp = async () => {
    if (!forgotEmail.trim()) { Alert.alert('', 'Email is required.'); return; }
    setLoading(true);
    try {
      const res = await api('/booking/technician/forgot-password', { email: forgotEmail.trim().toLowerCase() });
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

  const handleVerifyForgotOtp = async () => {
    if (forgotOtp.trim().length < 6) { Alert.alert('', 'Please enter the 6-digit OTP.'); return; }
    setLoading(true);
    try {
      await api('/booking/technician/verify-otp-email', {
        email: forgotEmail.trim().toLowerCase(), otp: forgotOtp.trim(),
      });
      setScreen('new_password');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Incorrect OTP');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (forgotNewPass.length < 8) { Alert.alert('', 'Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await api('/booking/technician/reset-password', {
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPass,
      });
      // If this was a forced password change, now complete the login
      if (loggedInTech) {
        await login({
          userType: 'technician',
          uniqueCode: loggedInTech.uniqueCode,
          name: loggedInTech.name,
          phone: loggedInTech.phone ?? undefined,
          email: loggedInTech.email ?? undefined,
          professionalId: loggedInTech.id,
          professionType: loggedInTech.professionType,
          loginMethod: 'password',
        });
        Alert.alert('✅ Password Set!', 'Your new password has been set. Go to Dashboard.', [{
          text: 'Dashboard',
          onPress: () => router.replace('/technician/home' as any),
        }]);
      } else {
        Alert.alert('✅ ' + t.resetSuccess, 'You can now login with your new password.', [{
          text: 'Login',
          onPress: () => { setTab('login'); setScreen('auth'); setForgotEmail(''); setForgotOtp(''); setForgotNewPass(''); },
        }]);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? 'Password reset failed');
    } finally { setLoading(false); }
  };

  const copyCode = () => {
    Clipboard.setString(generatedCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied!', 'Technician ID copied to clipboard.');
  };

  // ════════ SCREENS ═══════════════════════════════════════════════

  if (screen === 'success') {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingTop: topPad }]}>
        <View style={[s.card, { borderColor: colors.primary }]}>
          <Text style={{ fontSize: 52, textAlign: 'center' }}>🎉</Text>
          <Text style={[s.bigTitle, { color: colors.foreground }]}>{t.yourTechId}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center' }}>
            {t.techIdAssigned}
          </Text>
          <View style={[s.codeBox, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
            <Text style={[s.codeText, { color: colors.primary }]}>{generatedCode}</Text>
          </View>
          <TouchableOpacity style={[s.outlineBtn, { borderColor: colors.border }]} onPress={copyCode}>
            <Feather name="copy" size={16} color={colors.foreground} />
            <Text style={[s.outlineBtnText, { color: colors.foreground }]}>Copy Code</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: '#f59e0b', textAlign: 'center', lineHeight: 18 }}>
            {t.saveTechId}
          </Text>
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary, width: '100%' }]}
            onPress={() => router.replace('/technician/home' as any)}>
            <Text style={[s.submitText, { color: '#000' }]}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'set_password_forced') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Set New Password</Text>
            <Text style={[s.headerSub, { color: '#f59e0b' }]}>⚠️ A new password is required for security</Text>
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 60 }}>
          <View style={[s.infoBox, { backgroundColor: '#1c0a00', borderColor: '#f59e0b55' }]}>
            <Feather name="alert-triangle" size={16} color="#f59e0b" />
            <Text style={{ color: '#f59e0b', fontSize: 13, flex: 1 }}>
              You logged in with an Admin-issued temporary passcode.
              Set a new password to access your Dashboard.
            </Text>
          </View>

          <Text style={[s.label, { color: colors.mutedForeground }]}>
            New Password * (OTP will be sent to your email)
          </Text>
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: '#f59e0b' }, loading && { opacity: 0.5 }]}
            onPress={handleSetForcedPassword} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Feather name="mail" size={18} color="#000" />
                <Text style={[s.submitText, { color: '#000' }]}>Reset Password via Email OTP</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

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
          <View style={[s.infoBox, { backgroundColor: '#1c1000', borderColor: '#a78bfa44' }]}>
            <Feather name="info" size={15} color="#a78bfa" />
            <Text style={{ color: '#a78bfa', fontSize: 12, flex: 1 }}>
              Your Technician ID will also be sent with the OTP email.
            </Text>
          </View>
          <Text style={[s.label, { color: colors.mutedForeground }]}>{t.emailId} *</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: '#6366f1', backgroundColor: colors.card }]}
            value={forgotEmail} onChangeText={setForgotEmail}
            placeholder="registered email"
            placeholderTextColor={colors.mutedForeground}
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
                <Text style={{ color: '#84cc16', fontSize: 11, marginTop: 2 }}>A real email will be sent once SMTP is configured</Text>
              </View>
            </View>
          ) : null}

          <Text style={[s.label, { color: colors.mutedForeground }]}>{t.enterOtp} *</Text>
          <TextInput
            ref={otpRef}
            style={[s.input, { color: colors.foreground, borderColor: '#6366f1', backgroundColor: colors.card, fontSize: 28, fontWeight: '900', letterSpacing: 8, textAlign: 'center' }]}
            value={forgotOtp} onChangeText={(v) => setForgotOtp(v.replace(/\D/g, '').slice(0, 6))}
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
            OTP valid for 10 minutes · Check email for Technician ID too
          </Text>
        </ScrollView>
      </View>
    );
  }

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
              placeholder="At least 8 characters" placeholderTextColor={colors.mutedForeground}
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
              <Text style={[s.submitText, { color: '#fff' }]}>Save Password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Main auth screen (Login / Register / Temp Passcode tabs) ──────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t.technicianLogin}</Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground }]}>🔧 Technician Portal</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={[s.tabBtn, tab === 'login' && { backgroundColor: colors.primary }]} onPress={() => setTab('login')}>
          <Feather name="log-in" size={13} color={tab === 'login' ? '#000' : colors.mutedForeground} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: tab === 'login' ? '#000' : colors.mutedForeground }}>{t.login}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'register' && { backgroundColor: colors.primary }]} onPress={() => setTab('register')}>
          <Feather name="user-plus" size={13} color={tab === 'register' ? '#000' : colors.mutedForeground} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: tab === 'register' ? '#000' : colors.mutedForeground }}>{t.register}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'temp' && { backgroundColor: '#f59e0b' }]} onPress={() => setTab('temp')}>
          <Feather name="key" size={13} color={tab === 'temp' ? '#000' : colors.mutedForeground} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: tab === 'temp' ? '#000' : colors.mutedForeground }}>Temp Code</Text>
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}>

        {tab === 'login' && (
          <>
            <View style={[s.infoBox, { backgroundColor: '#1c0a00', borderColor: '#f59e0b44' }]}>
              <Feather name="shield" size={15} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontSize: 12, flex: 1 }}>
                All 3 fields are required — Mobile/Email + Technician ID + Password
              </Text>
            </View>

            {/* Field 1: Mobile or Email */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.mobileOrEmail} *</Text>
            <Animated.View style={{ transform: [{ translateX: shakeInput }] }}>
              <TextInput
                style={[s.input, { color: colors.foreground, backgroundColor: colors.card,
                  borderColor: loginInputErr ? '#ef4444' : colors.primary }]}
                value={loginInput}
                onChangeText={v => { setLoginInput(v); if (loginInputErr) setLoginInputErr(''); }}
                placeholder="9876543210 or example@gmail.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="default" autoCapitalize="none" autoCorrect={false}
              />
            </Animated.View>
            {!!loginInputErr && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: -8 }}>{loginInputErr}</Text>
            )}

            {/* Field 2: Technician ID */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.techId} *</Text>
            <Animated.View style={{ transform: [{ translateX: shakeTechId }] }}>
              <TextInput
                style={[s.input, { color: loginTechIdErr ? '#ef4444' : colors.primary, backgroundColor: colors.card,
                  borderColor: loginTechIdErr ? '#ef4444' : colors.primary,
                  fontSize: 18, fontWeight: '800', letterSpacing: 2, textAlign: 'center' }]}
                value={loginTechId}
                onChangeText={v => { setLoginTechId(v.toUpperCase()); if (loginTechIdErr) setLoginTechIdErr(''); }}
                placeholder="TECH-XXXXXX" placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters" autoCorrect={false}
              />
            </Animated.View>
            {!!loginTechIdErr && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: -8 }}>{loginTechIdErr}</Text>
            )}

            {/* Field 3: Password with eye toggle */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.password} *</Text>
            <Animated.View style={[{ position: 'relative' }, { transform: [{ translateX: shakePass }] }]}>
              <TextInput
                style={[s.input, { color: colors.foreground, backgroundColor: colors.card, paddingRight: 48,
                  borderColor: loginPassErr ? '#ef4444' : colors.primary }]}
                value={loginPass}
                onChangeText={v => { setLoginPass(v); if (loginPassErr) setLoginPassErr(''); }}
                placeholder={t.password} placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showLoginPass}
              />
              <TouchableOpacity onPress={() => setShowLoginPass(v => !v)}
                style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                <Feather name={showLoginPass ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </Animated.View>
            {!!loginPassErr && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: -8 }}>{loginPassErr}</Text>
            )}

            <TouchableOpacity onPress={() => setScreen('forgot_email')} style={{ alignSelf: 'flex-end', marginTop: -6 }}>
              <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600' }}>{t.forgotPassword}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: colors.primary }, (!loginInput.trim() || !loginTechId.trim() || !loginPass || loading) && { opacity: 0.5 }]}
              onPress={handleLogin}
              disabled={!loginInput.trim() || !loginTechId.trim() || !loginPass || loading}>
              {loading ? <ActivityIndicator color="#000" /> : (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Feather name="log-in" size={18} color="#000" />
                  <Text style={s.submitText}>{t.login}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setTab('register')} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t.noAccount}{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t.register}</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'register' && (
          <>
            <View style={[s.infoBox, { backgroundColor: '#052e16', borderColor: '#22c55e44' }]}>
              <Feather name="user-check" size={15} color="#22c55e" />
              <Text style={{ color: '#22c55e', fontSize: 12, flex: 1 }}>
                After registering you'll receive a unique Technician ID — always use it to login.
              </Text>
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.fullName} *</Text>
            <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={regName} onChangeText={setRegName} placeholder="Full name" placeholderTextColor={colors.mutedForeground} />

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.mobileNumber} *</Text>
            <PhoneInput value={regPhone} onChangeText={setRegPhone} />

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.emailId} *</Text>
            <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={regEmail} onChangeText={setRegEmail} placeholder="example@gmail.com"
              placeholderTextColor={colors.mutedForeground} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.password} *</Text>
            <View style={{ position: 'relative' }}>
              <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, paddingRight: 48 }]}
                value={regPass} onChangeText={setRegPass} placeholder="At least 8 characters"
                placeholderTextColor={colors.mutedForeground} secureTextEntry={!showRegPass} />
              <TouchableOpacity onPress={() => setShowRegPass(v => !v)}
                style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                <Feather name={showRegPass ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.professionType} *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {PROFESSION_TYPES.map(p => (
                <TouchableOpacity key={p.type}
                  style={[s.profCard, { borderColor: profType === p.type ? colors.primary : colors.border, backgroundColor: profType === p.type ? colors.primary + '22' : colors.card }]}
                  onPress={() => setProfType(p.type)}>
                  <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                  <Text style={[s.profLabel, { color: profType === p.type ? colors.primary : colors.foreground }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: colors.primary }, (!regName.trim() || !regPhone.trim() || !regEmail.trim() || regPass.length < 8 || loading) && { opacity: 0.5 }]}
              onPress={handleRegister}
              disabled={!regName.trim() || !regPhone.trim() || !regEmail.trim() || regPass.length < 8 || loading}>
              {loading ? <ActivityIndicator color="#000" /> : (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Feather name="user-check" size={18} color="#000" />
                  <Text style={s.submitText}>Register → Get ID</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setTab('login')} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t.alreadyHaveAccount}{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t.login}</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'temp' && (
          <>
            <View style={[s.infoBox, { backgroundColor: '#1c0a00', borderColor: '#f59e0b55' }]}>
              <Feather name="key" size={15} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontSize: 12, flex: 1 }}>
                Enter the temporary passcode provided by the Admin.
                After login you must set a new password.
              </Text>
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>{t.techId} *</Text>
            <TextInput
              style={[s.input, { color: colors.primary, borderColor: colors.primary, backgroundColor: colors.card, fontSize: 18, fontWeight: '800', letterSpacing: 2, textAlign: 'center' }]}
              value={tempTechId} onChangeText={(v) => setTempTechId(v.toUpperCase())}
              placeholder="TECH-XXXXXX" placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters" autoCorrect={false}
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>Temporary Passcode *</Text>
            <TextInput
              style={[s.input, { color: '#f59e0b', borderColor: '#f59e0b', backgroundColor: colors.card, fontSize: 18, fontWeight: '800', letterSpacing: 2, textAlign: 'center' }]}
              value={tempPasscode} onChangeText={(v) => setTempPasscode(v.toUpperCase())}
              placeholder="Code from Admin" placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters" autoCorrect={false}
            />

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: '#f59e0b' }, (!tempTechId.trim() || !tempPasscode.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleTempLogin} disabled={!tempTechId.trim() || !tempPasscode.trim() || loading}>
              {loading ? <ActivityIndicator color="#000" /> : (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Feather name="unlock" size={18} color="#000" />
                  <Text style={s.submitText}>Login with Temp Code</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: c.foreground },
  headerSub:     { fontSize: 12, marginTop: 2 },
  iconBtn:       { padding: 6 },
  bigTitle:      { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  label:         { fontSize: 13, fontWeight: '600' },
  input:         { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15 },
  submitBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitText:    { fontWeight: '800', color: '#000', fontSize: 16 },
  infoBox:       { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'flex-start' },
  tabBar:        { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, padding: 8, gap: 6 },
  tabBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9 },
  card:          { backgroundColor: c.card, borderRadius: 20, borderWidth: 1.5, padding: 28, width: '100%', gap: 14, alignItems: 'center' },
  codeBox:       { borderWidth: 2, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 28, alignItems: 'center', borderStyle: 'dashed' },
  codeText:      { fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  outlineBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  outlineBtnText: { fontSize: 14, fontWeight: '600' },
  profCard:      { width: '30%', borderRadius: 12, borderWidth: 1.5, padding: 10, alignItems: 'center', gap: 4 },
  profLabel:     { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
