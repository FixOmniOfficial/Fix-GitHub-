/**
 * CallerIdPermissionSheet
 *
 * In-app rationale UI shown BEFORE the Android system permission dialog.
 * This satisfies Google Play's "prominent disclosure" requirement for
 * READ_PHONE_STATE — users see a clear, honest explanation in the app's own UI
 * before the OS dialog appears.
 *
 * Design:
 *  - Modal bottom sheet (slides up on Android).
 *  - Bullet list of exactly what the feature does and doesn't do.
 *  - Two CTAs: "Enable Caller ID" (proceeds to system dialog)
 *              "Maybe Later"     (dismisses; feature stays off)
 *  - No persistent re-prompting: once dismissed, this sheet never reappears.
 */
import React from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  Platform, SafeAreaView, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  visible: boolean;
  onEnable:  () => void;
  onDismiss: () => void;
}

const BULLETS = [
  { icon: '📞', text: 'When a customer calls, their name appears on your screen instantly.' },
  { icon: '🔒', text: 'No call data is recorded or sent to any server — matching happens only on your device.' },
  { icon: '📵', text: 'Unknown numbers are completely ignored — only your saved customers are matched.' },
  { icon: '⚙️',  text: 'You can turn this off at any time from Android Settings → App Permissions.' },
];

export default function CallerIdPermissionSheet({ visible, onEnable, onDismiss }: Props) {
  const colors = useColors();

  // This component is Android-only at runtime; no-op on web/iOS
  if (Platform.OS !== 'android') return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle pill */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Icon */}
            <View style={[styles.iconRing, { borderColor: '#a855f7' + '44', backgroundColor: '#a855f720' }]}>
              <Text style={styles.iconEmoji}>📲</Text>
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>
              Know Who's Calling
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Fix Omni can show your customer's name the moment they call — like a smart CRM right on your phone.
            </Text>

            {/* Bullets */}
            <View style={styles.bullets}>
              {BULLETS.map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletIcon}>{b.icon}</Text>
                  <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>{b.text}</Text>
                </View>
              ))}
            </View>

            {/* Permission label */}
            <View style={[styles.permBadge, { backgroundColor: '#a855f714', borderColor: '#a855f740' }]}>
              <Feather name="shield" size={12} color="#a855f7" />
              <Text style={styles.permBadgeText}>
                Requires: <Text style={{ fontWeight: '800' }}>READ_PHONE_STATE</Text>
                {' '}(standard, not call log)
              </Text>
            </View>
          </ScrollView>

          {/* CTAs */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.enableBtn, { backgroundColor: '#a855f7' }]}
              onPress={onEnable}
              activeOpacity={0.85}
            >
              <Feather name="phone-incoming" size={16} color="#fff" />
              <Text style={styles.enableBtnText}>Enable Caller ID</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.laterBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={[styles.laterBtnText, { color: colors.mutedForeground }]}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  body: { paddingHorizontal: 24, paddingBottom: 8, alignItems: 'center' },
  iconRing: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconEmoji: { fontSize: 32 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  bullets: { width: '100%', gap: 12, marginBottom: 16 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletIcon: { fontSize: 16, marginTop: 1 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 19 },
  permBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
    marginTop: 4,
  },
  permBadgeText: { fontSize: 11, color: '#a855f7', flex: 1 },
  footer: {
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 24,
    borderTopWidth: 1, gap: 10,
  },
  enableBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  enableBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  laterBtn: { alignItems: 'center', paddingVertical: 10 },
  laterBtnText: { fontSize: 14, fontWeight: '600' },
});
