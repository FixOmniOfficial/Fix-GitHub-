import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useColors } from '@/hooks/useColors';
import { useCreateBooking } from '@workspace/api-client-react';
import { useAppAuth } from '@/contexts/AppAuthContext';
import PhoneInput from '@/components/PhoneInput';

// ── Guest Auth Gate Modal ─────────────────────────────────────────────────────
function GuestAuthModal({
  visible, onLogin, onContinueAsGuest, onClose, colors,
}: {
  visible: boolean;
  onLogin: () => void;
  onContinueAsGuest: () => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, gap: 16 }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4 }} />

          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 36 }}>🔐</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground }}>Login to Confirm Booking</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Create a free account — track bookings, get updates, view history.
            </Text>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={{ backgroundColor: '#3b82f6', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
            onPress={onLogin}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Feather name="log-in" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Login / Register</Text>
            </View>
          </TouchableOpacity>

          {/* Continue as guest */}
          <TouchableOpacity
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            onPress={onContinueAsGuest}>
            <Text style={{ color: colors.mutedForeground, fontWeight: '600', fontSize: 14 }}>
              Continue as Guest (booking won't be tracked)
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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
  const { user } = useAppAuth();

  const createBooking = useCreateBooking();

  const [name, setName] = useState(user?.userType === 'customer' ? (user.name ?? '') : '');
  const [phone, setPhone] = useState(user?.userType === 'customer' ? (user.phone ?? '') : '');
  const [whatsapp, setWhatsapp] = useState('');
  const [house, setHouse] = useState('');
  const [floor, setFloor] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [notes, setNotes] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  const doSubmit = () => {
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

  const handleSubmit = () => {
    if (!validate()) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    // Show auth modal for guest users
    if (!user || user.userType !== 'customer') {
      setShowAuthModal(true);
      return;
    }
    doSubmit();
  };

  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Guest Auth Modal */}
      <GuestAuthModal
        visible={showAuthModal}
        colors={colors}
        onLogin={() => {
          setShowAuthModal(false);
          router.push('/auth/customer' as any);
        }}
        onContinueAsGuest={() => {
          setShowAuthModal(false);
          doSubmit();
        }}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Booking Form</Text>
          <Text style={s.headerSub}>Fill in your details</Text>
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

        {/* Login nudge for guests */}
        {!user && (
          <TouchableOpacity
            style={{ marginHorizontal: 16, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#3b82f610', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f644', padding: 12 }}
            onPress={() => router.push('/auth/customer' as any)}>
            <Feather name="log-in" size={16} color="#3b82f6" />
            <Text style={{ flex: 1, color: '#3b82f6', fontSize: 13 }}>
              Login — bookings will be tracked and you'll get updates
            </Text>
            <Feather name="chevron-right" size={14} color="#3b82f6" />
          </TouchableOpacity>
        )}

        <View style={s.form}>
          {/* Name */}
          <View style={s.field}>
            <Text style={s.label}>Full Name <Text style={s.required}>*</Text></Text>
            <TextInput
              style={[s.input, errors.name ? s.inputError : null]}
              value={name} onChangeText={setName}
              placeholder="Your name" placeholderTextColor={colors.mutedForeground}
            />
            {errors.name && <Text style={s.errorText}>{errors.name}</Text>}
          </View>

          {/* Phone row */}
          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Mobile <Text style={s.required}>*</Text></Text>
              <PhoneInput
                value={phone} onChangeText={setPhone}
                borderColor={errors.phone ? '#ef4444' : undefined}
              />
              {errors.phone && <Text style={s.errorText}>{errors.phone}</Text>}
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>WhatsApp</Text>
              <PhoneInput value={whatsapp} onChangeText={setWhatsapp} placeholder="optional" />
            </View>
          </View>

          {/* Address fields */}
          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>House No.</Text>
              <TextInput style={s.input} value={house} onChangeText={setHouse}
                placeholder="A-101" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Floor</Text>
              <TextInput style={s.input} value={floor} onChangeText={setFloor}
                placeholder="2nd" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Full Address</Text>
            <TextInput
              style={[s.input, { minHeight: 72, textAlignVertical: 'top' }]}
              value={address} onChangeText={setAddress}
              placeholder="Society, Street, Area, City…" placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={3}
            />
          </View>

          {/* GPS + Location */}
          <View style={s.field}>
            <Text style={s.label}>GPS Location</Text>
            <View style={s.row}>
              <TextInput
                style={[s.input, { flex: 1, fontSize: 12 }]}
                value={location} onChangeText={setLocation}
                placeholder="maps.google.com/?q=…" placeholderTextColor={colors.mutedForeground}
              />
              <TouchableOpacity style={[s.gpsBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={handleGPS} disabled={gpsLoading}>
                {gpsLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Feather name="navigation" size={18} color={colors.primary} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Booking Time */}
          <View style={s.field}>
            <Text style={s.label}>Preferred Time</Text>
            <TextInput
              style={s.input} value={bookingTime} onChangeText={setBookingTime}
              placeholder="e.g. Tomorrow 10am or 25 Jan 2pm"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          {/* Notes */}
          <View style={s.field}>
            <Text style={s.label}>Notes / Problem Description</Text>
            <TextInput
              style={[s.input, { minHeight: 88, textAlignVertical: 'top' }]}
              value={notes} onChangeText={setNotes}
              placeholder="Describe the issue or any special notes…"
              placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={4}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, createBooking.isPending && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={createBooking.isPending}
          >
            {createBooking.isPending
              ? <ActivityIndicator color="#000" />
              : (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Feather name="check-circle" size={20} color="#000" />
                  <Text style={s.submitText}>Confirm Booking</Text>
                </View>
              )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn:    { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: c.foreground },
  headerSub:  { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  profBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, margin: 16, marginBottom: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border },
  profEmoji:  { fontSize: 32 },
  profInfo:   { flex: 1 },
  profName:   { fontSize: 15, fontWeight: '700', color: c.foreground },
  profType:   { fontSize: 12, color: c.mutedForeground, textTransform: 'capitalize', marginTop: 2 },
  chargeBadge:{ backgroundColor: c.primary + '22', borderRadius: 10, padding: 8, alignItems: 'center' },
  chargeLabel:{ fontSize: 10, color: c.primary, fontWeight: '600' },
  chargeAmt:  { fontSize: 15, fontWeight: '800', color: c.primary },
  form:       { padding: 16, gap: 14 },
  row:        { flexDirection: 'row', gap: 12 },
  field:      { gap: 6 },
  label:      { fontSize: 13, fontWeight: '600', color: c.mutedForeground },
  required:   { color: '#ef4444' },
  input:      { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 13, fontSize: 14, color: c.foreground },
  inputError: { borderColor: '#ef4444' },
  errorText:  { color: '#ef4444', fontSize: 12 },
  gpsBtn:     { width: 50, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtn:  { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 8 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
