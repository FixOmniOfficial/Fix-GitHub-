import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function ScreenDisabled({ label = 'This screen' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <Feather name="eye-off" size={52} color="#475569" />
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.subtitle}>This section is temporarily unavailable.</Text>
      <Text style={styles.hint}>Please check back later or contact your administrator.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },
});
