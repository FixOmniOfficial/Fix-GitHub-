import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useGetBooking, useUpdateBooking } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: colors.foreground }}>{String(value)}</Text>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: booking, isLoading } = useGetBooking(parseInt(id ?? '0'), {
    query: { enabled: !!id },
  });
  const updateBooking = useUpdateBooking();

  const handleRating = (rating: 'good' | 'bad') => {
    if (!booking) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newRating = booking.rating === rating ? null : rating;
    updateBooking.mutate(
      { id: parseInt(id ?? '0'), data: { rating: newRating ?? undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => Alert.alert('Error', 'Rating update failed'),
      },
    );
  };

  const s = styles(colors);

  if (isLoading) {
    return <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} />
    </View>;
  }

  if (!booking) {
    return <View style={[s.root, { alignItems: 'center', justifyContent: 'center', paddingTop: topPad }]}>
      <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
      <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Booking not found</Text>
    </View>;
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{booking.customerName}</Text>
          <Text style={s.headerSub}>{booking.bookingUid}</Text>
        </View>
        {booking.rating && (
          <Text style={{ fontSize: 22 }}>{booking.rating === 'good' ? '👍' : '👎'}</Text>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 40 }}
      >
        {/* Rating Card */}
        <View style={s.ratingCard}>
          <Text style={s.ratingTitle}>Customer Rating</Text>
          <Text style={s.ratingDesc}>इस customer को rate करें</Text>
          <View style={s.ratingRow}>
            <TouchableOpacity
              style={[s.ratingBtn, booking.rating === 'good' && s.ratingBtnGood]}
              onPress={() => handleRating('good')}
              disabled={updateBooking.isPending}
              activeOpacity={0.8}
            >
              <Text style={s.ratingEmoji}>👍</Text>
              <Text style={[s.ratingBtnLabel, booking.rating === 'good' && { color: '#22c55e' }]}>Good</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.ratingBtn, booking.rating === 'bad' && s.ratingBtnBad]}
              onPress={() => handleRating('bad')}
              disabled={updateBooking.isPending}
              activeOpacity={0.8}
            >
              <Text style={s.ratingEmoji}>👎</Text>
              <Text style={[s.ratingBtnLabel, booking.rating === 'bad' && { color: '#ef4444' }]}>Bad</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Professional info */}
        {booking.professionalName && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Professional</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <Text style={{ fontSize: 28 }}>{booking.professionalEmoji ?? '👤'}</Text>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>{booking.professionalName}</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{booking.professionType}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Customer details */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Customer Details</Text>
          <View style={{ marginTop: 10 }}>
            <InfoRow label="Name" value={booking.customerName} />
            <InfoRow label="Mobile" value={booking.phone} />
            <InfoRow label="WhatsApp" value={booking.whatsappPhone} />
          </View>
        </View>

        {/* Address */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Address</Text>
          <View style={{ marginTop: 10 }}>
            <InfoRow label="House / Flat" value={booking.houseNumber} />
            <InfoRow label="Floor" value={booking.floorNumber} />
            <InfoRow label="Full Address" value={booking.address} />
            <InfoRow label="Location" value={booking.location} />
          </View>
        </View>

        {/* Booking info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Booking Info</Text>
          <View style={{ marginTop: 10 }}>
            <InfoRow label="Booking ID" value={booking.bookingUid} />
            <InfoRow label="Booking Time" value={booking.bookingTime ? new Date(booking.bookingTime).toLocaleString('en-IN') : null} />
            <InfoRow label="Visiting Charge" value={booking.visitingCharge ? `₹${booking.visitingCharge}` : null} />
            <InfoRow label="Notes" value={booking.notes} />
            <InfoRow label="Created" value={new Date(booking.createdAt).toLocaleString('en-IN')} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: c.foreground },
  headerSub: { fontSize: 11, fontFamily: 'monospace', color: c.primary, marginTop: 1 },
  ratingCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  ratingTitle: { fontSize: 16, fontWeight: '700', color: c.foreground },
  ratingDesc: { fontSize: 12, color: c.mutedForeground, marginTop: 2, marginBottom: 14 },
  ratingRow: { flexDirection: 'row', gap: 12 },
  ratingBtn: {
    flex: 1, backgroundColor: c.secondary,
    borderRadius: 12, paddingVertical: 16, alignItems: 'center', gap: 4,
    borderWidth: 2, borderColor: 'transparent',
  },
  ratingBtnGood: { borderColor: '#22c55e', backgroundColor: '#22c55e15' },
  ratingBtnBad: { borderColor: '#ef4444', backgroundColor: '#ef444415' },
  ratingEmoji: { fontSize: 28 },
  ratingBtnLabel: { fontSize: 13, fontWeight: '700', color: c.mutedForeground },
  card: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: c.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
});
