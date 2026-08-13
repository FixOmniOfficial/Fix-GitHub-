/**
 * TestModeBanner — floating pill shown at the top of every screen when
 * Test Mode is active.  Tap "Switch" to go to the profile picker,
 * tap "Exit" to restore real auth and go back to home.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTestMode } from '@/contexts/TestModeContext';

export default function TestModeBanner() {
  const { isTestMode, activeProfile, exitTestMode } = useTestMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isTestMode ? 0 : -80,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [isTestMode]);

  if (!isTestMode && !activeProfile) return null;

  const topOffset = Platform.OS === 'web' ? 8 : insets.top + 6;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: topOffset, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents={isTestMode ? 'box-none' : 'none'}
    >
      <View style={styles.pill}>
        {/* Left — role indicator */}
        <View style={styles.leftSection}>
          <Text style={styles.flask}>🧪</Text>
          <View>
            <Text style={styles.modeLabel}>TEST MODE</Text>
            <Text style={styles.roleLabel}>
              {activeProfile?.emoji ?? ''} {activeProfile?.label ?? ''}
            </Text>
          </View>
        </View>

        {/* Right — actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => router.push('/test-mode' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.switchBtnText}>Switch</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exitBtn}
            onPress={async () => {
              await exitTestMode();
              router.replace('/(tabs)' as any);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.exitBtnText}>✕ Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#a855f7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    shadowColor: '#a855f7',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    minWidth: 260,
    maxWidth: 420,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  flask: {
    fontSize: 18,
  },
  modeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 1.2,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchBtn: {
    backgroundColor: '#a855f722',
    borderWidth: 1,
    borderColor: '#a855f755',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  switchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c084fc',
  },
  exitBtn: {
    backgroundColor: '#ef444422',
    borderWidth: 1,
    borderColor: '#ef444455',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  exitBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f87171',
  },
});
