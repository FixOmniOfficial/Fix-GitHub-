import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useColors } from '@/hooks/useColors';
import { useCreateBooking } from '@workspace/api-client-react';

export default function NewBookingScreen() {
  const params = useLocalSearchParams<{
    professionalId: string;
    professionalName: string;
    professionType: string;
    professionalEmoji: string;
    visitingCharge: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const createBooking = useCreateBooking();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [house, setHouse] = useState('');
  const [floor, setFloor] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [notes, setNotes] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const visitingCharge = params.visitingCharge ? parseFloat(params.visitingCharge) : null;

  const handleGPS = async () => {
    if (Platform.OS === 'web') {
      navigator.geolocation?.getCurrentPosition(
        (pos) => setLocation(`https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`),
        () => Alert.alert('Error', 'Could not get location'),
      );
      return;
    }
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'Location permission is required.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(`https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not get GPS location.');
    } finally {
      setGpsLoading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!phone.trim() || phone.trim().length < 10) e.phone = 'Valid mobile number required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    createBooking.mutate({
      data: {
        customerName: name.trim(),
        phone: phone.trim(),
        whatsappPhone: whatsapp.trim() || undefined,
        houseNumber: house.trim() || undefined,
        floorNumber: floor.trim() || undefined,
        address: address.trim() || undefined,
        location: location.trim() || undefined,
        bookingTime: bookingTime.trim() || undefined,
        visitingCharge: visitingCharge ?? undefined,
        professionalId: params.professionalId ? parseInt(params.professionalId) : undefined,
        professionType: params.professionType ?? 'repair',
        notes: notes.trim() || undefined,
      },
    }, {
      onSuccess: (booking) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: '/booking/success', params: { bookingUid: booking.bookingUid } });
      },
      onError: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Booking failed. Please try again.');
      },
    });
  };

  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Booking Form</Text>
          <Text style={s.headerSub}>अपनी जानकारी भरें</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}
      >
        {/* Professional banner */}
        <View style={s.profBanner}>
          <Text style={s.profEmoji}>{params.professionalEmoji ?? '👤'}</Text>
          <View style={s.profInfo}>
            <Text style={s.profName}>{params.professionalName ?? 'Professional'}</Text>
            <Text style={s.profType}>{params.professionType}</Text>
          </View>
          {visitingCharge != null && visitingCharge > 0 && (
            <View style={s.chargeBadge}>
              <Text style={s.chargeLabel}>Visiting</Text>
              <Text style={s.chargeAmt}>₹{visitingCharge}</Text>
            </View>
          )}
        </View>

        <View style={s.form}>
          {/* Name */}
          <View style={s.field}>
            <Text style={s.label}>Full Name <Text style={s.required}>*</Text></Text>
            <TextInput
              style={[s.input, errors.name ? s.inputError : null]}
              value={name} onChangeText={setName}
              placeholder="अपना नाम" placeholderTextColor={colors.mutedForeground}
            />
            {errors.name && <Text style={s.errorText}>{errors.name}</Text>}
          </View>

          {/* Phone row */}
          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Mobile <Text style={s.required}>*</Text></Text>
              <TextInput
                style={[s.input, errors.phone ? s.inputError : null]}
                value={phone} onChangeText={setPhone}
                placeholder="9876543210" placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
              {errors.phone && <Text style={s.errorText}>{errors.phone}</Text>}
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>WhatsApp</Text>
              <TextInput
                style={s.input}
                value={whatsapp} onChangeText={setWhatsapp}
                placeholder="If different" placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={s.divider} />

          {/* Address */}
          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>House / Flat No.</Text>
              <TextInput style={s.input} value={house} onChangeText={setHouse}
                placeholder="A-201" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Floor</Text>
              <TextInput style={s.input} value={floor} onChangeText={setFloor}
                placeholder="2nd Floor" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Full Address</Text>
            <TextInput
              style={[s.input, s.multiline]}
              value={address} onChangeText={setAddress}
              placeholder="Sector 12, Noida, UP" placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={3}
            />
          </View>

          {/* Location */}
          <View style={s.field}>
            <View style={s.labelRow}>
              <Text style={s.label}>Area / Location</Text>
              <TouchableOpacity onPress={handleGPS} style={s.gpsBtn} disabled={gpsLoading}>
                {gpsLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <><Feather name="navigation" size={12} color={colors.primary} /><Text style={[s.gpsBtnText, { color: colors.primary }]}> GPS</Text></>
                }
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.input}
              value={location} onChangeText={setLocation}
              placeholder="Locality or Maps link" placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={s.divider} />

          {/* Booking time */}
          <View style={s.field}>
            <Text style={s.label}>Booking Date & Time</Text>
            <TextInput
              style={s.input}
              value={bookingTime} onChangeText={setBookingTime}
              placeholder="e.g. 2025-01-15 10:30 AM" placeholderTextColor={colors.mutedForeground}
            />
          </View>

          {/* Notes */}
          <View style={s.field}>
            <Text style={s.label}>Notes (Optional)</Text>
            <TextInput
              style={[s.input, s.multiline]}
              value={notes} onChangeText={setNotes}
              placeholder="कोई विशेष जानकारी..." placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={2}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, createBooking.isPending && s.submitDisabled]}
            onPress={handleSubmit}
            disabled={createBooking.isPending}
            activeOpacity={0.85}
          >
            {createBooking.isPending
              ? <ActivityIndicator color="#000" />
              : <Text style={s.submitText}>✓ Booking Confirm करें</Text>
            }
          </TouchableOpacity>
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
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground },
  profBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, padding: 14, borderRadius: 14,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  profEmoji: { fontSize: 32 },
  profInfo: { flex: 1 },
  profName: { fontSize: 16, fontWeight: '700', color: c.foreground },
  profType: { fontSize: 12, color: c.mutedForeground, textTransform: 'capitalize', marginTop: 2 },
  chargeBadge: {
    backgroundColor: '#f59e0b22', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center',
  },
  chargeLabel: { fontSize: 9, fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase' },
  chargeAmt: { fontSize: 16, fontWeight: '800', color: '#f59e0b' },
  form: { paddingHorizontal: 16 },
  field: { marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: c.mutedForeground, marginBottom: 6 },
  required: { color: c.destructive },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center' },
  gpsBtnText: { fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: c.foreground,
  },
  multiline: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  inputError: { borderColor: c.destructive },
  errorText: { fontSize: 11, color: c.destructive, marginTop: 4 },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 8 },
  submitBtn: {
    backgroundColor: c.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '700', color: c.primaryForeground },
});
