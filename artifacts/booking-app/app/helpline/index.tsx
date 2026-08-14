import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useCreateHelplineMessage } from '@workspace/api-client-react';

const SENDER_TYPES = [
  { key: 'customer',    label: 'Customer',    icon: '👤' },
  { key: 'technician',  label: 'Technician',  icon: '🔧' },
];

export default function HelplineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const createMessage = useCreateHelplineMessage();

  const [senderType, setSenderType] = useState<'customer' | 'technician'>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!message.trim()) e.message = 'Message is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    createMessage.mutate(
      { data: { senderType, senderName: name.trim(), phone: phone.trim() || undefined, message: message.trim() } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSubmitted(true);
        },
        onError: () => Alert.alert('Error', 'Message could not be sent. Please retry.'),
      },
    );
  };

  const s = styles(colors);

  if (submitted) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 16, alignSelf: 'flex-start' }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.successCenter}>
          <View style={s.successIcon}><Feather name="check-circle" size={52} color="#22c55e" /></View>
          <Text style={s.successTitle}>Message sent!</Text>
          <Text style={s.successSub}>Admin will contact you soon.</Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary, marginTop: 28 }]} onPress={() => router.back()}>
            <Text style={[s.btnText, { color: colors.primaryForeground }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Helpline</Text>
          <Text style={s.headerSub}>Send a direct message to Admin</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}
      >
        {/* Who are you */}
        <View style={s.field}>
          <Text style={s.label}>Who are you?</Text>
          <View style={s.typeRow}>
            {SENDER_TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.typeBtn, senderType === t.key && s.typeBtnActive]}
                onPress={() => setSenderType(t.key as any)}
              >
                <Text style={s.typeEmoji}>{t.icon}</Text>
                <Text style={[s.typeBtnText, senderType === t.key && { color: colors.primaryForeground }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Name */}
        <View style={s.field}>
          <Text style={s.label}>Your Name <Text style={s.required}>*</Text></Text>
          <TextInput
            style={[s.input, errors.name && s.inputError]}
            value={name} onChangeText={setName}
            placeholder="Full Name" placeholderTextColor={colors.mutedForeground}
          />
          {errors.name && <Text style={s.errorText}>{errors.name}</Text>}
        </View>

        {/* Phone */}
        <View style={s.field}>
          <Text style={s.label}>Mobile Number</Text>
          <TextInput
            style={s.input}
            value={phone} onChangeText={setPhone}
            placeholder="9876543210" placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
          />
        </View>

        {/* Message */}
        <View style={s.field}>
          <Text style={s.label}>Your Message <Text style={s.required}>*</Text></Text>
          <TextInput
            style={[s.input, s.multiline, errors.message && s.inputError]}
            value={message} onChangeText={setMessage}
            placeholder="Describe your issue or suggestion..." placeholderTextColor={colors.mutedForeground}
            multiline numberOfLines={5}
          />
          {errors.message && <Text style={s.errorText}>{errors.message}</Text>}
        </View>

        <TouchableOpacity
          style={[s.btn, { backgroundColor: '#22c55e' }, createMessage.isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={createMessage.isPending}
          activeOpacity={0.85}
        >
          {createMessage.isPending
            ? <ActivityIndicator color="#fff" />
            : <><Feather name="send" size={16} color="#fff" /><Text style={[s.btnText, { color: '#fff' }]}>Send Message</Text></>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: c.mutedForeground, marginBottom: 8 },
  required: { color: c.destructive },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.card, borderRadius: 12, padding: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  typeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  typeEmoji: { fontSize: 18 },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: c.foreground },
  input: {
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: c.foreground,
  },
  multiline: { height: 120, textAlignVertical: 'top', paddingTop: 12 },
  inputError: { borderColor: c.destructive },
  errorText: { fontSize: 11, color: c.destructive, marginTop: 4 },
  btn: {
    borderRadius: 14, paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  successCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '800', color: c.foreground, textAlign: 'center' },
  successSub: { fontSize: 14, color: c.mutedForeground, textAlign: 'center', marginTop: 8, lineHeight: 22 },
});
