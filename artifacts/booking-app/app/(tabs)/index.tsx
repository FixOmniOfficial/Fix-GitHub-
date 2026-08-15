import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Linking, Alert, Image,
  Modal, Animated, Pressable, Dimensions, TextInput,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const LOGO = require('@/assets/fixomni-logo.jpg');
const { width: SCREEN_W } = Dimensions.get('window');

// ── Logo Zoom Modal ───────────────────────────────────────────────────────────
function LogoZoomModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.3);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.3, useNativeDriver: true, tension: 100, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[zoomStyles.backdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View style={[zoomStyles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Image source={LOGO} style={zoomStyles.bigLogo} resizeMode="contain" />
          <Text style={zoomStyles.bigName}>Fix Omni</Text>
          <TouchableOpacity style={zoomStyles.closeBtn} onPress={handleClose} activeOpacity={0.8}>
            <Text style={zoomStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const zoomStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    alignItems: 'center', gap: 16,
    width: Math.min(SCREEN_W - 48, 340),
  },
  bigLogo: {
    width: Math.min(SCREEN_W - 48, 340),
    height: Math.min(SCREEN_W - 48, 340),
    borderRadius: 0,
  },
  bigName: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 0.3, textAlign: 'center' },
  bigTagline: { fontSize: 0 },
  closeBtn: {
    marginTop: 4, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 40, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useScreenVisibility } from '@/contexts/ScreenVisibilityContext';
import ScreenDisabled from '@/components/ScreenDisabled';
import {
  useListBookings, useListServiceCategories, useGetHomeConfig,
  useCreateAppRating, useGetAppRatingsSummary,
} from '@workspace/api-client-react';
import { useAppAuth } from '@/contexts/AppAuthContext';
import { useTestMode } from '@/contexts/TestModeContext';
import { useQueryClient } from '@tanstack/react-query';

const PROFESSION_LABELS_FALLBACK: Record<string, string> = {
  ac_technician: 'AC Service', electrician: 'Electrician',
  carpenter: 'Carpenter', plumber: 'Plumber',
  painter: 'Painter', repair: 'Repair',
};

const STAR_LABELS = ['', 'Very Bad 😞', 'Bad 😕', 'Okay 😐', 'Good 😊', 'Excellent 🤩'];

// ── Inline Rating Widget ──────────────────────────────────────────────────────
function RatingWidget({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [done, setDone] = useState(false);

  const queryClient = useQueryClient();
  const createRating = useCreateAppRating();
  const { data: summary } = useGetAppRatingsSummary({});
  const { user } = useAppAuth();

  const display = hovered || selected;

  const handleStar = (star: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(star);
  };

  const handleSubmit = () => {
    if (!selected) return;
    const raterType = user?.userType === 'technician' ? 'technician' : 'customer';
    createRating.mutate(
      { data: { raterType, raterName: user?.name?.trim() || undefined, rating: selected } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries();
          setDone(true);
        },
        onError: () => Alert.alert('Error', 'Rating could not be submitted. Please retry.'),
      }
    );
  };

  const s = styles(colors);

  const avg = summary?.averageRating ?? 0;
  const total = summary?.totalRatings ?? 0;

  // ── Thank-you state ──
  if (done) {
    return (
      <View style={[s.ratingWidget, { borderColor: '#f59e0b55', backgroundColor: '#f59e0b08' }]}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 30 }}>🙏</Text>
          <Text style={[s.ratingWidgetTitle, { color: colors.foreground }]}>
            Thank you! Your rating was received
          </Text>
          <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
            {[1,2,3,4,5].map(s => (
              <Feather key={s} name="star" size={15} color={s <= selected ? '#f59e0b' : colors.border} />
            ))}
          </View>
          {avg > 0 && (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
              Overall: {avg.toFixed(1)}⭐ ({total} ratings)
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── Rating widget ──
  return (
    <View style={[s.ratingWidget, { borderColor: '#f59e0b55', backgroundColor: '#f59e0b08' }]}>
      {/* Top row: label + avg */}
      <View style={s.ratingWidgetTop}>
        <View style={{ flex: 1 }}>
          <Text style={[s.ratingWidgetTitle, { color: colors.foreground }]}>⭐ Rate the App</Text>
          <Text style={[s.ratingWidgetSub, { color: colors.mutedForeground }]}>
            Tap stars for an instant rating!
          </Text>
        </View>
        {avg > 0 && (
          <View style={s.ratingAvgBadge}>
            <Text style={[s.ratingAvgNum, { color: '#f59e0b' }]}>{avg.toFixed(1)}</Text>
            <Text style={[s.ratingAvgTotal, { color: colors.mutedForeground }]}>{total} ratings</Text>
          </View>
        )}
      </View>

      {/* Stars */}
      <View style={s.starRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleStar(star)}
            onPressIn={() => setHovered(star)}
            onPressOut={() => setHovered(0)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Feather
              name={star <= display ? 'star' : 'star'}
              size={40}
              color={star <= display ? '#f59e0b' : colors.border}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Label + submit */}
      {selected > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ color: '#f59e0b', fontSize: 14, fontWeight: '700' }}>
            {STAR_LABELS[selected]}
          </Text>
          <TouchableOpacity
            style={[s.ratingSubmitBtn, createRating.isPending && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={createRating.isPending}
            activeOpacity={0.85}
          >
            {createRating.isPending
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.ratingSubmitText}>Submit</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Avatar Initial Fallback ────────────────────────────────────────────────────
function AvatarInitial({ name, size, fontSize, textColor, bgColor }: {
  name: string; size: number; fontSize: number; textColor: string; bgColor: string;
}) {
  const initial = (name || '?').trim()[0]?.toUpperCase() ?? '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize, fontWeight: '800', color: textColor }}>{initial}</Text>
    </View>
  );
}

const ALPHA_ONLY = /^[a-zA-Z\s]*$/;

// ── Home Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { isScreenEnabled } = useScreenVisibility();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = insets.top;
  const { user, logout, updateUser } = useAppAuth();
  if (!isScreenEnabled('customer_home')) return <ScreenDisabled label="Home" />;
  const { isTestMode } = useTestMode();
  const [logoModalVisible, setLogoModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const openNameEdit = () => {
    setNameInput(user?.name ?? '');
    setNameError('');
    setNameModalVisible(true);
  };

  const handleNameChange = (text: string) => {
    setNameInput(text);
    if (text && !ALPHA_ONLY.test(text)) {
      setNameError('Numbers and special characters are not allowed in the Name field.');
    } else {
      setNameError('');
    }
  };

  const saveNameEdit = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (!ALPHA_ONLY.test(trimmed)) {
      setNameError('Numbers and special characters are not allowed in the Name field.');
      return;
    }
    updateUser({ name: trimmed });
    setNameModalVisible(false);
  };

  const { data: recentBookings, isLoading } = useListBookings({});
  const { data: categories, isLoading: catsLoading } = useListServiceCategories({});
  const { data: homeConfig } = useGetHomeConfig({});

  const recent = (recentBookings ?? []).slice(0, 3);
  const activeCategories = (categories ?? [])
    .filter(c => c.isActive)
    .filter(c => !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  const s = styles(colors);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      `${user?.name} — are you sure you want to logout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 80 : insets.bottom + 220 }}
      >
        {/* ── Header Bar ── */}
        <LogoZoomModal visible={logoModalVisible} onClose={() => setLogoModalVisible(false)} />
        <View style={[s.header, { paddingTop: topPad + 10 }]}>
          <View style={s.logoRow}>
            <TouchableOpacity
              onPress={() => setLogoModalVisible(true)}
              activeOpacity={0.85}
              style={s.logoBox}
            >
              <Image source={LOGO} style={s.logoImg} resizeMode="cover" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>Fix Omni</Text>
              <Text style={s.heroTagline}>Services Booking • Trusted Service</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {homeConfig && (
              <TouchableOpacity
                style={s.helplineIconBtn}
                onPress={() => Linking.openURL(`tel:${homeConfig.helplineNumber}`)}
                activeOpacity={0.7}
              >
                <Feather name="phone-call" size={17} color="#22c55e" />
              </TouchableOpacity>
            )}
            {/* Notification Bell — replaces the empty avatar circle */}
            <TouchableOpacity
              style={s.bellBtn}
              onPress={() => router.push('/(tabs)/notifications' as any)}
              activeOpacity={0.8}
            >
              <Feather name="bell" size={18} color={colors.primary} />
            </TouchableOpacity>
            {!user && (
              <TouchableOpacity
                style={[s.loginHeaderBtn, { borderColor: colors.primary }]}
                onPress={() => router.push('/auth' as any)}
                activeOpacity={0.8}
              >
                <Feather name="user" size={15} color={colors.primary} />
                <Text style={[s.loginHeaderText, { color: colors.primary }]}>Login</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Name Edit Modal ── */}
        <Modal visible={nameModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setNameModalVisible(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 32 }} onPress={() => setNameModalVisible(false)}>
            <Pressable onPress={() => {}} style={{ backgroundColor: colors.background, borderRadius: 20, padding: 24, width: '100%', gap: 14, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.foreground }}>Edit Name</Text>
              <TextInput
                style={{ backgroundColor: colors.card, borderWidth: 1.5, borderColor: nameError ? '#ef4444' : colors.primary, borderRadius: 12, padding: 14, fontSize: 16, color: colors.foreground }}
                value={nameInput} onChangeText={handleNameChange}
                placeholder="Your name (letters only)" placeholderTextColor={colors.mutedForeground}
                autoFocus returnKeyType="done" onSubmitEditing={saveNameEdit}
              />
              {nameError ? <Text style={{ color: '#ef4444', fontSize: 12, marginTop: -8 }}>{nameError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 13, alignItems: 'center' }} onPress={() => setNameModalVisible(false)}>
                  <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, borderRadius: 12, backgroundColor: colors.primary, paddingVertical: 13, alignItems: 'center' }} onPress={saveNameEdit}>
                  <Text style={{ color: '#000', fontWeight: '800' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── 1. User Welcome Banner — always at top ── */}
        {user && (
          <View style={[s.welcomeBanner, {
            borderColor: user.userType === 'technician' ? colors.primary + '55' : '#3b82f655',
            backgroundColor: user.userType === 'technician' ? colors.primary + '12' : '#3b82f612',
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <View style={[s.profileAvatar, { borderColor: user.userType === 'technician' ? colors.primary : '#3b82f6' }]}>
                {user.avatar
                  ? <ExpoImage
                      source={{ uri: user.avatar }}
                      style={s.profileAvatarImg}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                    />
                  : <AvatarInitial
                      name={user.name ?? '?'}
                      size={56} fontSize={22}
                      textColor={user.userType === 'technician' ? '#000' : '#fff'}
                      bgColor={user.userType === 'technician' ? colors.primary : '#3b82f6'}
                    />
                }
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.welcomeName, { color: colors.foreground }]}>{user.name}</Text>
                <View style={[s.roleBadge, { backgroundColor: user.userType === 'technician' ? colors.primary + '22' : '#3b82f622' }]}>
                  <Text style={[s.roleBadgeText, { color: user.userType === 'technician' ? colors.primary : '#3b82f6' }]}>
                    {user.userType === 'technician' ? '🔧 TECHNICIAN' : '👤 CUSTOMER'}
                  </Text>
                </View>
                {user.email && <Text style={[s.welcomeEmail, { color: colors.mutedForeground }]}>{user.email}</Text>}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {user.userType === 'technician' ? (
                <TouchableOpacity style={[s.bannerActionBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={() => router.push('/technician/home' as any)}>
                  <Feather name="grid" size={14} color="#000" />
                  <Text style={[s.bannerActionText, { color: '#000' }]}>Dashboard</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.bannerActionBtn, { backgroundColor: '#3b82f6', flex: 1 }]} onPress={() => router.push('/(tabs)/bookings' as any)}>
                  <Feather name="calendar" size={14} color="#fff" />
                  <Text style={[s.bannerActionText, { color: '#fff' }]}>Bookings</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.bannerLogoutBtn, { borderColor: colors.border }]} onPress={handleLogout}>
                <Feather name="log-out" size={13} color={colors.mutedForeground} />
                <Text style={[s.bannerLogoutText, { color: colors.mutedForeground }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Not logged in → Login CTA ── */}
        {!user && (
          <TouchableOpacity
            style={[s.loginCta, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '10' }]}
            onPress={() => router.push('/auth' as any)}
            activeOpacity={0.85}
          >
            <View style={[s.loginCtaIconWrap, { backgroundColor: colors.primary + '22' }]}>
              <Feather name="user" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.loginCtaTitle, { color: colors.foreground }]}>Login / Register</Text>
              <Text style={[s.loginCtaSub, { color: colors.mutedForeground }]}>Track bookings, view history, create account</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* ── Dev Mode entry point ── */}
        {!user && !isTestMode && (
          <TouchableOpacity style={[s.devModeLink, { borderColor: '#a855f733' }]} onPress={() => router.push('/test-mode' as any)} activeOpacity={0.7}>
            <Text style={s.devModeLinkText}>🧪 Developer / Test Mode</Text>
            <Feather name="chevron-right" size={13} color="#a855f7" />
          </TouchableOpacity>
        )}

        {/* ── 2. Quick Stats — always visible ── */}
        <View style={[s.statRow, { paddingHorizontal: 16, marginTop: 14 }]}>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: colors.primary }]}>{recentBookings?.length ?? '—'}</Text>
            <Text style={s.statLabel}>Total Bookings</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: '#22c55e' }]}>{recentBookings?.filter(b => b.rating === 'good').length ?? '—'}</Text>
            <Text style={s.statLabel}>Good Ratings</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: colors.primary }]}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
            <Text style={s.statLabel}>Today</Text>
          </View>
        </View>

        {/* ── 3. Service Categories (with search bar) ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Choose a Service</Text>
          {/* Search bar */}
          <View style={[s.searchBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: 0 }}
              placeholder="Search services..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          {catsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : activeCategories.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 20, fontSize: 13 }}>No services found for "{searchQuery}"</Text>
          ) : (
            <View style={s.grid}>
              {activeCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.gridCard, { borderColor: colors.border }]}
                  onPress={() => router.push(`/professional/${cat.professionType}`)}
                  activeOpacity={0.7}
                >
                  <View style={[s.gridIcon, { backgroundColor: (cat.accent ?? '#6b7280') + '22' }]}>
                    {(cat as any).imageUrl ? (
                      <Image
                        source={{ uri: (cat as any).imageUrl }}
                        style={{ width: 32, height: 32, borderRadius: 8 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Feather name={(cat.icon ?? 'settings') as any} size={26} color={cat.accent ?? '#6b7280'} />
                    )}
                  </View>
                  <Text style={s.gridLabel}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── 4. Recent Bookings ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Bookings</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : recent.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather name="calendar" size={32} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No bookings yet</Text>
            </View>
          ) : (
            recent.map((b) => (
              <TouchableOpacity key={b.id} style={s.bookingCard} onPress={() => router.push(`/booking/${b.id}`)} activeOpacity={0.8}>
                <View style={s.bookingLeft}>
                  <Text style={s.bookingName}>{b.customerName}</Text>
                  <Text style={s.bookingMeta}>{PROFESSION_LABELS_FALLBACK[b.professionType] ?? b.professionType} · {b.phone}</Text>
                </View>
                <View style={[s.ratingDot, { backgroundColor: b.rating === 'good' ? '#22c55e' : b.rating === 'bad' ? '#ef4444' : colors.border }]} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── 5. ⭐ Rate the App — moved to bottom ── */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <RatingWidget colors={colors} />
        </View>

      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
    gap: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logoBox: {
    width: 46, height: 46, borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#6b21a8',
  },
  logoImg: { width: 46, height: 46, borderRadius: 11 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: c.foreground, letterSpacing: -0.5 },
  heroTagline: { fontSize: 10, color: c.mutedForeground, marginTop: 1 },
  helplineIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#022c22',
    borderWidth: 1, borderColor: '#166534',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: c.card,
    borderWidth: 1.5, borderColor: c.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  loginHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  loginHeaderText: { fontSize: 12, fontWeight: '700' },

  // ── Rating Widget ──
  ratingWidget: {
    borderRadius: 16, borderWidth: 1.5,
    padding: 16, gap: 10,
  },
  ratingWidgetTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ratingWidgetTitle: { fontSize: 15, fontWeight: '800' },
  ratingWidgetSub: { fontSize: 11, marginTop: 2 },
  ratingAvgBadge: { alignItems: 'center', gap: 1 },
  ratingAvgNum: { fontSize: 22, fontWeight: '900' },
  ratingAvgTotal: { fontSize: 9, fontWeight: '600' },
  starRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 2 },
  ratingSubmitBtn: {
    backgroundColor: '#f59e0b', borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 8, minWidth: 80, alignItems: 'center',
  },
  ratingSubmitText: { fontSize: 13, fontWeight: '800', color: '#000' },

  // Welcome banner
  welcomeBanner: {
    marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  profileAvatar: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)', overflow: 'hidden',
  },
  profileAvatarImg: { width: 60, height: 60, borderRadius: 30 },
  welcomeName: { fontSize: 17, fontWeight: '800' },
  welcomeEmail: { fontSize: 11, marginTop: 2 },
  googleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#4285F420', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  roleBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  roleBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  bannerActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
  },
  bannerActionText: { fontSize: 12, fontWeight: '700' },
  bannerLogoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 5,
    justifyContent: 'center',
  },
  bannerLogoutText: { fontSize: 11, fontWeight: '600' },

  // Login CTA
  loginCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, borderWidth: 1.5, padding: 14,
  },
  loginCtaIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  loginCtaTitle: { fontSize: 14, fontWeight: '700' },
  loginCtaSub: { fontSize: 12, marginTop: 2 },

  // Dev mode entry link
  devModeLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 8,
    borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
    paddingVertical: 8, paddingHorizontal: 14,
  },
  devModeLinkText: {
    fontSize: 11, fontWeight: '600', color: '#a855f7',
  },

  // Stats
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: c.card,
    borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: c.border,
  },
  statNum: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 10, color: c.mutedForeground, marginTop: 2, textAlign: 'center' },

  // Service grid
  section: { padding: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: c.foreground, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: {
    width: '47%', backgroundColor: c.card,
    borderRadius: 16, padding: 16, borderWidth: 1,
    alignItems: 'flex-start', gap: 8,
  },
  gridIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: 14, fontWeight: '600', color: c.foreground },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14,
  },

  // Recent bookings
  emptyCard: {
    alignItems: 'center', gap: 8,
    backgroundColor: c.card, borderRadius: 14, padding: 32,
    borderWidth: 1, borderColor: c.border,
  },
  emptyText: { fontSize: 14, color: c.mutedForeground },
  bookingCard: {
    backgroundColor: c.card, borderRadius: 12, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  bookingLeft: { flex: 1 },
  bookingName: { fontSize: 15, fontWeight: '600', color: c.foreground },
  bookingMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  ratingDot: { width: 10, height: 10, borderRadius: 5 },
});
