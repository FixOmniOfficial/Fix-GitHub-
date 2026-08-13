/**
 * CallerIdBanner
 *
 * Floating banner that slides down from the top of the screen when a
 * registered customer's call is incoming.
 *
 * Behaviour:
 *  - Animates in (slide-down) when incomingCall.state === 'RINGING'.
 *  - Shows customer name (or "Incoming call" if number not available on Android 10+).
 *  - "Call Back" shortcut (tap to re-open dialer if they missed it mid-task).
 *  - "✕" dismiss button — does NOT reject the call, only hides the banner.
 *  - Auto-dismissed by useCallerDetection when state transitions away from RINGING.
 *
 * Renders nothing on web/iOS (Android-only feature).
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { IncomingCallInfo } from '@/hooks/useCallerDetection';

interface Props {
  incomingCall: IncomingCallInfo | null;
  onDismiss: () => void;
}

export default function CallerIdBanner({ incomingCall, onDismiss }: Props) {
  const insets   = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(-140)).current;
  const visible  = !!incomingCall;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : -140,
      useNativeDriver: true,
      bounciness: 6,
      speed: 14,
    }).start();
  }, [visible]);

  // Android only — on web/iOS this renders nothing
  if (Platform.OS !== 'android') return null;

  const hasName   = !!incomingCall?.customerName;
  const hasNumber = !!incomingCall?.phoneNumber;

  const handleCallBack = () => {
    if (incomingCall?.phoneNumber) {
      Linking.openURL(`tel:${incomingCall.phoneNumber}`);
    }
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        { top: insets.top + 8, transform: [{ translateY: slideY }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Left — incoming call icon pulsing ring */}
      <View style={styles.iconWrap}>
        <View style={styles.iconRing} />
        <Feather name="phone-incoming" size={18} color="#22c55e" />
      </View>

      {/* Centre — name / number */}
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>
          {hasName ? '📞 Customer Calling' : '📞 Incoming Call'}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {hasName
            ? incomingCall!.customerName!
            : (hasNumber ? incomingCall!.phoneNumber! : 'Unknown Number')}
        </Text>
        {hasName && hasNumber && (
          <Text style={styles.phone}>{incomingCall!.phoneNumber}</Text>
        )}
        {!hasNumber && (
          <Text style={styles.limitNote}>
            Number hidden on Android 10+ (OS policy)
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {hasNumber && (
          <TouchableOpacity style={styles.callBtn} onPress={handleCallBack} activeOpacity={0.8}>
            <Feather name="phone" size={14} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Feather name="x" size={14} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', left: 12, right: 12, zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1.5, borderColor: '#22c55e55',
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 16,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative', width: 38, height: 38 },
  iconRing: {
    position: 'absolute', width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.5, borderColor: '#22c55e44',
  },
  label: { fontSize: 10, color: '#22c55e', fontWeight: '700', letterSpacing: 0.5 },
  name: { fontSize: 16, fontWeight: '800', color: '#f1f5f9', marginTop: 1 },
  phone: { fontSize: 11, color: '#64748b', marginTop: 2 },
  limitNote: { fontSize: 10, color: '#475569', marginTop: 2, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  callBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center',
  },
  dismissBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
});
