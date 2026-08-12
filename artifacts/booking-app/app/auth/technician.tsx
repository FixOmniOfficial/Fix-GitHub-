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
import { useTechnicianSignup } from '@workspace/api-client-react';

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
  { type: 'painter',       label: 'Painter',        emoji: '🖌️' },
  { type: 'repair',        label: 'Repair',         emoji: '⚙️' },
];

type Screen = 'choice' | 'signup' | 'signup_success' | 'login_code' | 'login_otp';

export default function TechnicianAuthScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const topPad   = Platform.OS === 'web' ? 67 : insets.top;
  const { login } = useAppAuth();
  const s = styles(colors);

  const [screen, setScreen]           = useState<Screen>('choice');
  const [loading, setLoading]         = useState(false);

  // ── Signup state ─────────────────────────────────────
  const [signupName, setSignupName]   = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [profType, setProfType]       = useState('ac_technician');
  const [generatedCode, setGenCode]   = useState('');
  const signup = useTechnicianSignup();

  // ── OTP login state ───────────────────────────────────
  const [techCode, setTechCode]         = useState('');
  const [techLoginPhone, setLoginPhone] = useState('');   // user-entered phone for verification
  const [techName, setTechName]         = useState('');
  const [maskedPhone, setMaskedPhone]   = useState('');   // XXXXXX4321 — from server response
  const [demoOtp, setDemoOtp]           = useState('');   // shown in UI (demo mode)
  const [otpInput, setOtpInput]         = useState('');
  const otpRef = useRef<TextInput>(null);

  // ── Signup ────────────────────────────────────────────
  const handleSignup = async () => {
    if (!signupName.trim()) { Alert.alert('Required', 'नाम जरूरी है।'); return; }
    // Strict 10-digit Indian mobile validation
    const cleanPhone = signupPhone.trim().replace(/\D/g, '');
    if (signupPhone.trim() && (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone))) {
      Alert.alert('Invalid Phone', '10-digit Indian mobile number required (starts with 6-9).\nExample: 9876543210');
      return;
    }
    setLoading(true);
    try {
      const tech = await signup.mutateAsync({
        data: { name: signupName.trim(), phone: signupPhone.trim() || undefined, professionType: profType },
      });
      await login({
        userType: 'technician',
        uniqueCode: tech.uniqueCode,
        name: tech.name,
        phone: tech.phone ?? undefined,
        professionalId: tech.id,
        professionType: tech.professionType,
      });
      setGenCode(tech.uniqueCode);
      setScreen('signup_success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Signup failed। कृपया दोबारा try करें।');
    } finally { setLoading(false); }
  };

  // ── Step 1: validate code + phone → request OTP ──────
  const handleRequestOtp = async () => {
    const code = techCode.trim().toUpperCase();
    if (!code.startsWith('TECH-') || code.length < 10) {
      Alert.alert('Invalid Code', 'TECH- से शुरू होने वाला valid code दर्ज करें।'); return;
    }
    const ph = techLoginPhone.trim().replace(/\D/g, '');
    if (ph.length !== 10 || !/^[6-9]/.test(ph)) {
      Alert.alert('Invalid Number', 'Exactly 10-digit Indian mobile number required (starts with 6-9).\nExample: 9876543210');
      return;
    }
    setLoading(true);
    try {
      const res = await api('/booking/technician/request-otp', { uniqueCode: code, phone: ph });
      setTechName(res.name);
      setMaskedPhone(res.maskedPhone ?? '');  // e.g. XXXXXX4321
      setDemoOtp(res.demoOtp ?? '');
      setOtpInput('');
      setScreen('login_otp');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => otpRef.current?.focus(), 400);
    } catch (e: any) {
      Alert.alert('Verification Failed', e.message ?? 'Code या number verify नहीं हो सका।');
    } finally { setLoading(false); }
  };

  // ── Step 2: verify OTP ────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpInput.trim().length < 6) { Alert.alert('', '6-digit OTP दर्ज करें।'); return; }
    setLoading(true);
    try {
      const tech = await api('/booking/technician/verify-otp', {
        uniqueCode: techCode.trim().toUpperCase(),
        otp: otpInput.trim(),
      });
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
      Alert.alert('OTP गलत है', e.message ?? 'कृपया सही OTP डालें।');
    } finally { setLoading(false); }
  };

  const copyCode = () => {
    Clipboard.setString(generatedCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied!', 'Code clipboard में copy हो गया।');
  };

  // ════════ SCREENS ═══════════════════════════════════════

  // ── Choice screen ─────────────────────────────────────
  if (screen === 'choice') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Technician Login</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>🔧 अपना account बनाएं या login करें</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
            <Text style={{ fontSize: 52 }}>🔧</Text>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Technician Portal</Text>
            <Text style={[s.mutedText, { color: colors.mutedForeground, textAlign: 'center' }]}>
              पहले से registered हैं तो login करें, नए हैं तो signup करें
            </Text>
          </View>

          <TouchableOpacity style={[s.bigCard, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
            onPress={() => setScreen('login_code')}>
            <View style={[s.bigCardIcon, { backgroundColor: colors.primary + '22' }]}>
              <Feather name="smartphone" size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.bigCardTitle, { color: colors.foreground }]}>Login करें</Text>
              <Text style={[s.bigCardSub, { color: colors.mutedForeground }]}>
                अपना TECH code + Mobile OTP से login करें
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.bigCard, { borderColor: colors.border }]}
            onPress={() => setScreen('signup')}>
            <View style={[s.bigCardIcon, { backgroundColor: colors.card }]}>
              <Feather name="user-plus" size={26} color={colors.foreground} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.bigCardTitle, { color: colors.foreground }]}>नया Account बनाएं</Text>
              <Text style={[s.bigCardSub, { color: colors.mutedForeground }]}>
                Register करें और unique TECH code पाएं
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Signup form ───────────────────────────────────────
  if (screen === 'signup') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={() => setScreen('choice')} style={s.iconBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>नया Account</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>आपका नाम *</Text>
          <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={signupName} onChangeText={setSignupName} placeholder="पूरा नाम लिखें" placeholderTextColor={colors.mutedForeground} />

          <Text style={[s.label, { color: colors.mutedForeground }]}>Phone Number</Text>
          <TextInput style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={signupPhone} onChangeText={setSignupPhone} placeholder="10-अंक का number"
            placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" maxLength={10} />

          <Text style={[s.label, { color: colors.mutedForeground }]}>आप क्या काम करते हैं? *</Text>
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

          <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary }, (!signupName.trim() || loading) && { opacity: 0.5 }]}
            onPress={handleSignup} disabled={!signupName.trim() || loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>Register → Unique ID पाएं</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Signup success ────────────────────────────────────
  if (screen === 'signup_success') {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingTop: topPad }]}>
        <View style={[s.codeCard, { borderColor: colors.primary }]}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>🎉</Text>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>आपकी Unique ID</Text>
          <Text style={[s.mutedText, { color: colors.mutedForeground, textAlign: 'center' }]}>
            इसे संभाल कर रखें — यही आपकी login ID है
          </Text>
          <View style={[s.otpBox, { backgroundColor: colors.primary + '22', borderColor: colors.primary, borderStyle: 'dashed' }]}>
            <Text style={[s.otpText, { color: colors.primary, letterSpacing: 3 }]}>{generatedCode}</Text>
          </View>
          <TouchableOpacity style={[s.outlineBtn, { borderColor: colors.border }]} onPress={copyCode}>
            <Feather name="copy" size={16} color={colors.foreground} />
            <Text style={[s.outlineBtnText, { color: colors.foreground }]}>Code Copy करें</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: '#f59e0b', textAlign: 'center', lineHeight: 18 }}>
            ⚠️ यह code दोबारा नहीं दिखाया जाएगा। कहीं note करें।
          </Text>
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary, width: '100%' }]}
            onPress={() => router.replace('/technician/home' as any)}>
            <Text style={s.submitText}>Dashboard पर जाएं</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Login Step 1: Enter TECH code ─────────────────────
  if (screen === 'login_code') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={() => setScreen('choice')} style={s.iconBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Login — Step 1/2</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>अपना Technician Code दर्ज करें</Text>
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}>

          {/* Step indicator */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={[s.stepDot, { backgroundColor: colors.primary }]}><Text style={s.stepNum}>1</Text></View>
            <View style={[s.stepLine, { backgroundColor: colors.border }]} />
            <View style={[s.stepDot, { backgroundColor: colors.border }]}><Text style={[s.stepNum, { color: colors.mutedForeground }]}>2</Text></View>
            <Text style={[s.mutedText, { color: colors.mutedForeground, marginLeft: 6 }]}>Code → OTP</Text>
          </View>

          <View style={[s.infoBox, { backgroundColor: '#1c0a00', borderColor: '#f59e0b55' }]}>
            <Feather name="shield" size={16} color="#f59e0b" />
            <Text style={{ color: '#f59e0b', fontSize: 13, flex: 1, lineHeight: 18 }}>
              Security: OTP केवल account से registered mobile number पर भेजा जाएगा।
            </Text>
          </View>

          <Text style={[s.label, { color: colors.mutedForeground }]}>Technician Code *</Text>
          <TextInput
            style={[s.input, { color: colors.primary, borderColor: colors.primary, backgroundColor: colors.card, fontSize: 20, fontWeight: '800', letterSpacing: 3, textAlign: 'center' }]}
            value={techCode} onChangeText={(t) => setTechCode(t.toUpperCase())}
            placeholder="TECH-XXXXXX" placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters" autoCorrect={false}
          />

          <Text style={[s.label, { color: colors.mutedForeground }]}>Registered Mobile Number *</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontSize: 17, letterSpacing: 1, textAlign: 'center' }]}
            value={techLoginPhone} onChangeText={setLoginPhone}
            placeholder="Account वाला 10-digit number" placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad" maxLength={10}
          />

          <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary }, (!techCode.trim() || !techLoginPhone.trim() || loading) && { opacity: 0.5 }]}
            onPress={handleRequestOtp} disabled={!techCode.trim() || !techLoginPhone.trim() || loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Feather name="smartphone" size={18} color="#000" />
                  <Text style={s.submitText}>OTP भेजें →</Text>
                </View>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setScreen('signup')} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
              Account नहीं है?{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Register करें</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Login Step 2: Enter OTP ───────────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => { setScreen('login_code'); setDemoOtp(''); }} style={s.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Login — Step 2/2</Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground }]}>OTP verify करें</Text>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}>

        {/* Step indicator */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={[s.stepDot, { backgroundColor: colors.primary + '55' }]}>
            <Feather name="check" size={12} color={colors.primary} />
          </View>
          <View style={[s.stepLine, { backgroundColor: colors.primary }]} />
          <View style={[s.stepDot, { backgroundColor: colors.primary }]}><Text style={s.stepNum}>2</Text></View>
          <Text style={[s.mutedText, { color: colors.mutedForeground, marginLeft: 6 }]}>Code ✓ → OTP</Text>
        </View>

        {/* Who is logging in */}
        <View style={[s.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="user-check" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 14 }}>{techName}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              📱 {maskedPhone}  ·  {techCode.toUpperCase()}
            </Text>
            <Text style={{ color: '#22c55e', fontSize: 11, marginTop: 2 }}>
              ✅ Mobile number verified — OTP भेजा गया
            </Text>
          </View>
        </View>

        {/* Demo OTP banner — remove in production when SMS is live */}
        {demoOtp ? (
          <View style={[s.infoBox, { backgroundColor: '#1c2a00', borderColor: '#84cc16' }]}>
            <Feather name="terminal" size={16} color="#84cc16" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#84cc16', fontWeight: '800', fontSize: 13 }}>
                Demo OTP: {demoOtp}
              </Text>
              <Text style={{ color: '#84cc16', fontSize: 11, marginTop: 2 }}>
                SMS integration pending — production में real SMS आएगा
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={[s.label, { color: colors.mutedForeground }]}>6-Digit OTP *</Text>
        <TextInput
          ref={otpRef}
          style={[s.input, { color: colors.foreground, borderColor: colors.primary, backgroundColor: colors.card, fontSize: 28, fontWeight: '900', letterSpacing: 8, textAlign: 'center' }]}
          value={otpInput} onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="------" placeholderTextColor={colors.mutedForeground + '55'}
          keyboardType="number-pad" maxLength={6}
        />

        <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary }, (otpInput.length < 6 || loading) && { opacity: 0.5 }]}
          onPress={handleVerifyOtp} disabled={otpInput.length < 6 || loading}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Feather name="log-in" size={18} color="#000" />
                <Text style={s.submitText}>Login करें</Text>
              </View>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setDemoOtp(''); handleRequestOtp(); }}
          style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
            OTP नहीं मिला?{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>दोबारा भेजें</Text>
          </Text>
        </TouchableOpacity>
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
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  mutedText:    { fontSize: 13 },
  label:        { fontSize: 13, fontWeight: '600' },
  input:        { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15 },
  submitBtn:    { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitText:   { fontWeight: '800', color: '#000', fontSize: 16 },
  outlineBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  outlineBtnText: { fontSize: 14, fontWeight: '600' },
  infoBox:      { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'flex-start' },
  bigCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderRadius: 16, padding: 16, backgroundColor: 'transparent' },
  bigCardIcon:  { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bigCardTitle: { fontSize: 16, fontWeight: '800' },
  bigCardSub:   { fontSize: 12 },
  stepDot:      { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNum:      { fontSize: 12, fontWeight: '900', color: '#000' },
  stepLine:     { flex: 1, height: 2, borderRadius: 1 },
  profCard:     { width: '30%', borderRadius: 12, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 6 },
  profLabel:    { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  codeCard:     { backgroundColor: c.card, borderRadius: 20, borderWidth: 1.5, padding: 24, width: '100%', gap: 12, alignItems: 'center' },
  otpBox:       { borderWidth: 2, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 28, alignItems: 'center' },
  otpText:      { fontSize: 26, fontWeight: '900' },
});
