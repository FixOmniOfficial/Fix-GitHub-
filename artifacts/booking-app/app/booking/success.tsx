import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

export default function SuccessScreen() {
  const { bookingUid } = useLocalSearchParams<{ bookingUid: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🎉 Booking Confirmed!\nBooking ID: ${bookingUid}\nSave this ID for reference.`,
        title: 'Booking Confirmation',
      });
    } catch {}
  };

  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      {/* Checkmark */}
      <View style={s.iconWrap}>
        <View style={s.outerCircle}>
          <View style={s.innerCircle}>
            <Feather name="check" size={52} color="#fff" strokeWidth={3} />
          </View>
        </View>
      </View>

      <Text style={s.title}>Booking Confirmed! 🎉</Text>
      <Text style={s.subtitle}>Your booking was placed successfully.</Text>
      <Text style={s.subtitle}>Our team will contact you soon.</Text>

      {/* Booking ID box */}
      <View style={s.idBox}>
        <Text style={s.idLabel}>Your Booking ID</Text>
        <Text style={s.idText}>{bookingUid}</Text>
        <Text style={s.idNote}>Keep this ID safe</Text>
      </View>

      {/* Action buttons */}
      <View style={s.actions}>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Feather name="share-2" size={18} color={colors.foreground} />
          <Text style={s.shareBtnText}>Share ID</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.homeBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.85}
        >
          <Text style={s.homeBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: { marginBottom: 28 },
  outerCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#22c55e22',
    alignItems: 'center', justifyContent: 'center',
  },
  innerCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#22c55e',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 28, fontWeight: '800', color: c.foreground,
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    fontSize: 14, color: c.mutedForeground,
    textAlign: 'center', lineHeight: 22,
  },
  idBox: {
    marginTop: 32,
    backgroundColor: c.card, borderRadius: 16, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#22c55e55',
    width: '100%',
  },
  idLabel: { fontSize: 11, fontWeight: '700', color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1 },
  idText: {
    fontSize: 26, fontWeight: '800', color: c.foreground,
    fontFamily: 'monospace', marginTop: 8, letterSpacing: 2,
  },
  idNote: { fontSize: 12, color: c.mutedForeground, marginTop: 8 },
  actions: { width: '100%', gap: 12, marginTop: 28 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.card, borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: c.border,
  },
  shareBtnText: { fontSize: 15, fontWeight: '600', color: c.foreground },
  homeBtn: {
    backgroundColor: c.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 16, fontWeight: '700', color: c.primaryForeground },
});
