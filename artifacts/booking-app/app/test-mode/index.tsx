/**
 * Test Mode — Profile Picker Screen
 *
 * Two entry paths:
 *  A) Normal: user taps "🧪 Developer / Test Mode" on home → picks a profile
 *  B) Auto-login: service-center sandbox opens this URL with query params:
 *       /booking-app/test-mode?autoLogin=1&code=TEST-0001&name=Suresh&role=technician&type=ac_technician&emoji=❄️
 *     → instantly logs in as that user + navigates to their dashboard
 *
 * Selecting any card calls enterTestMode(profile) which:
 *   1. Saves previous real user
 *   2. Calls AppAuthContext.login(testUser) → all existing route guards pass
 *   3. Navigates to the role's main screen
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  useTestMode,
  PRESET_TEST_PROFILES,
  TestProfile,
} from '@/contexts/TestModeContext';

// ── Destination route per role ─────────────────────────────────────────────────
function getDestination(profile: TestProfile): string {
  if (profile.user.userType === 'technician') return '/technician/home';
  return '/(tabs)';
}

// ── Build a custom profile from URL params (from sandbox "Login as Web") ──────
function buildProfileFromParams(params: {
  code?: string;
  name?: string;
  role?: string;
  type?: string;
  emoji?: string;
}): TestProfile | null {
  const { code, name, role, type, emoji } = params;
  if (!code || !name || !role) return null;

  if (role === 'technician') {
    const typeKey = type ?? 'repair';
    const PROF_LABELS: Record<string, string> = {
      ac_technician: 'AC Technician', electrician: 'Electrician',
      plumber: 'Plumber', carpenter: 'Carpenter', painter: 'Painter', repair: 'Repair',
    };
    return {
      id: `sandbox-tech-${code}`,
      label: PROF_LABELS[typeKey] ?? typeKey,
      emoji: emoji ?? '🤖',
      roleTag: 'TECHNICIAN',
      description: `Sandbox technician · ${code}`,
      color: '#a855f7',
      user: {
        userType: 'technician',
        uniqueCode: code,
        name,
        professionType: typeKey,
      },
    };
  }

  if (role === 'customer') {
    return {
      id: `sandbox-cust-${code}`,
      label: 'Customer',
      emoji: emoji ?? '👤',
      roleTag: 'CUSTOMER',
      description: `Sandbox customer · ${code}`,
      color: '#3b82f6',
      user: {
        userType: 'customer',
        uniqueCode: code,
        name,
      },
    };
  }

  return null;
}

// ── Profile Card ──────────────────────────────────────────────────────────────
function ProfileCard({
  profile, isActive, onSelect, loading,
}: {
  profile: TestProfile;
  isActive: boolean;
  onSelect: () => void;
  loading: boolean;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderColor: isActive ? profile.color : colors.border,
          backgroundColor: isActive ? profile.color + '18' : colors.card,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
      disabled={loading}
    >
      {isActive && (
        <View style={[styles.activeBadge, { backgroundColor: profile.color }]}>
          <Text style={styles.activeBadgeText}>ACTIVE</Text>
        </View>
      )}
      <View style={styles.cardInner}>
        <View style={[styles.emojiWrap, { backgroundColor: profile.color + '22', borderColor: profile.color + '55' }]}>
          <Text style={styles.emoji}>{profile.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.cardLabel, { color: colors.foreground }]}>{profile.label}</Text>
            <View style={[styles.roleTag, { backgroundColor: profile.color + '22' }]}>
              <Text style={[styles.roleTagText, { color: profile.color }]}>{profile.roleTag}</Text>
            </View>
          </View>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{profile.description}</Text>
        </View>
        {loading
          ? <ActivityIndicator size="small" color={profile.color} />
          : <Feather name="chevron-right" size={20} color={isActive ? profile.color : colors.mutedForeground} />}
      </View>
      <View style={styles.destinationRow}>
        <Feather name="navigation" size={10} color={colors.mutedForeground} />
        <Text style={[styles.destinationText, { color: colors.mutedForeground }]}>
          Opens: {getDestination(profile).replace(/[/()]/g, ' ').trim()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Auto-Login Banner — shown when arriving from sandbox "Login as Web" ────────
function AutoLoginBanner({ profile, colors }: { profile: TestProfile; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[s_auto.banner, { borderColor: profile.color + '55', backgroundColor: profile.color + '10' }]}>
      <Text style={s_auto.icon}>🌐</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s_auto.title, { color: profile.color }]}>Logging in as {profile.emoji} {profile.label}</Text>
        <Text style={[s_auto.sub, { color: colors.mutedForeground }]}>
          Coming from Web Sandbox · {profile.user.uniqueCode}
        </Text>
      </View>
      <ActivityIndicator color={profile.color} />
    </View>
  );
}

const s_auto = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 16,
  },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '800' },
  sub: { fontSize: 11, marginTop: 2 },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TestModeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const params  = useLocalSearchParams<{
    autoLogin?: string;
    code?: string;
    name?: string;
    role?: string;
    type?: string;
    emoji?: string;
  }>();
  const { isTestMode, activeProfile, enterTestMode, exitTestMode, switchProfile } = useTestMode();

  const [loadingId,       setLoadingId]       = useState<string | null>(null);
  const [autoProfile,     setAutoProfile]      = useState<TestProfile | null>(null);
  const [autoLoginDone,   setAutoLoginDone]    = useState(false);
  const autoLoginTriggered = useRef(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // ── Auto-login from URL params (service-center sandbox → web) ────────────────
  useEffect(() => {
    if (autoLoginTriggered.current) return;
    if (params.autoLogin !== '1') return;

    const profile = buildProfileFromParams(params);
    if (!profile) return;

    autoLoginTriggered.current = true;
    setAutoProfile(profile);

    // Small delay so the loading banner renders first
    const timer = setTimeout(async () => {
      try {
        if (isTestMode) {
          await switchProfile(profile);
        } else {
          await enterTestMode(profile);
        }
        setAutoLoginDone(true);
        router.replace(getDestination(profile) as any);
      } catch (e: any) {
        Alert.alert('Auto-Login Failed', e?.message ?? 'Could not activate test mode from URL params.');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [params.autoLogin]);

  const handleSelect = async (profile: TestProfile) => {
    setLoadingId(profile.id);
    try {
      if (isTestMode) {
        await switchProfile(profile);
      } else {
        await enterTestMode(profile);
      }
      router.replace(getDestination(profile) as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Profile switch failed');
    } finally {
      setLoadingId(null);
    }
  };

  const handleExit = async () => {
    await exitTestMode();
    router.replace('/(tabs)' as any);
  };

  const s = createStyles(colors);

  // While auto-login is in progress, show a minimal loading screen
  if (autoProfile && !autoLoginDone) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 10 }]}>
          <Text style={s.headerTitle}>🧪 Test Mode</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <AutoLoginBanner profile={autoProfile} colors={colors} />
          <Text style={[s.sectionSub, { textAlign: 'center', marginTop: 24 }]}>
            Activating test session…
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>🧪 Test Mode</Text>
          <Text style={s.headerSub}>Role Switcher — Developer Only</Text>
        </View>
        {isTestMode && (
          <TouchableOpacity style={s.exitHeaderBtn} onPress={handleExit} activeOpacity={0.8}>
            <Text style={s.exitHeaderText}>Exit Test Mode</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
      >
        {/* Warning banner */}
        <View style={s.warnBanner}>
          <Text style={s.warnIcon}>⚠️</Text>
          <Text style={s.warnText}>
            Test Mode bypasses real authentication. All screens open instantly — no password/OTP required.
            Always exit before handing the device to a real user.
          </Text>
        </View>

        {/* Current status */}
        {isTestMode && activeProfile && (
          <View style={[s.statusCard, { borderColor: activeProfile.color + '55', backgroundColor: activeProfile.color + '10' }]}>
            <Text style={[s.statusLabel, { color: activeProfile.color }]}>Currently previewing as</Text>
            <Text style={[s.statusProfile, { color: colors.foreground }]}>
              {activeProfile.emoji} {activeProfile.label}
            </Text>
            <TouchableOpacity style={s.exitCardBtn} onPress={handleExit} activeOpacity={0.8}>
              <Feather name="x-circle" size={14} color="#f87171" />
              <Text style={s.exitCardBtnText}>Exit Test Mode</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section title */}
        <Text style={s.sectionTitle}>Select a Test Profile</Text>
        <Text style={s.sectionSub}>
          Tap any card to instantly switch into that role's UI — no real credentials needed.
          You can also open this page from the web sandbox to auto-login as a generated test user.
        </Text>

        {/* Profile cards */}
        <View style={{ gap: 12, marginTop: 12 }}>
          {PRESET_TEST_PROFILES.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={isTestMode && activeProfile?.id === profile.id}
              onSelect={() => handleSelect(profile)}
              loading={loadingId === profile.id}
            />
          ))}
        </View>

        {/* How it works */}
        <View style={s.howItWorks}>
          <Text style={s.howTitle}>How Test Mode Works</Text>
          {[
            { icon: '1️⃣', text: 'Tap a profile card above — or open from Web Sandbox with auto-login URL.' },
            { icon: '2️⃣', text: 'The app instantly logs you in as a test user — no API call, no OTP.' },
            { icon: '3️⃣', text: 'A purple banner appears at the top of every screen.' },
            { icon: '4️⃣', text: 'Use "Switch" in the banner to change profiles, or "✕ Exit" to go back to real auth.' },
          ].map((step, i) => (
            <View key={i} style={s.howStep}>
              <Text style={s.howIcon}>{step.icon}</Text>
              <Text style={[s.howText, { color: colors.mutedForeground }]}>{step.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
    headerSub: { fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
    exitHeaderBtn: {
      backgroundColor: '#ef444418', borderWidth: 1, borderColor: '#ef444444',
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    },
    exitHeaderText: { fontSize: 11, fontWeight: '700', color: '#f87171' },
    warnBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: '#78350f18', borderWidth: 1, borderColor: '#f59e0b44',
      borderRadius: 12, padding: 14, marginTop: 16,
    },
    warnIcon: { fontSize: 16, marginTop: 1 },
    warnText: { flex: 1, fontSize: 12, color: '#fbbf24', lineHeight: 18 },
    statusCard: {
      borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 14, gap: 4,
    },
    statusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
    statusProfile: { fontSize: 16, fontWeight: '800' },
    exitCardBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
      alignSelf: 'flex-start', backgroundColor: '#ef444418', borderWidth: 1,
      borderColor: '#ef444444', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    },
    exitCardBtnText: { fontSize: 11, fontWeight: '700', color: '#f87171' },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginTop: 24 },
    sectionSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 4, lineHeight: 18 },
    howItWorks: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 14, padding: 16, marginTop: 24, gap: 10,
    },
    howTitle: { fontSize: 13, fontWeight: '800', color: colors.foreground, marginBottom: 4 },
    howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    howIcon: { fontSize: 15 },
    howText: { flex: 1, fontSize: 12, lineHeight: 18 },
  });
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 8, overflow: 'hidden' },
  activeBadge: {
    position: 'absolute', top: 10, right: 10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiWrap: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  cardLabel: { fontSize: 15, fontWeight: '800' },
  roleTag: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  roleTagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  cardDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  destinationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 60 },
  destinationText: { fontSize: 10 },
});
