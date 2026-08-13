/**
 * PhoneInput — fixed +91 prefix (non-editable) + 10-digit limit.
 * Drop-in replacement for a phone TextInput everywhere in the app.
 */
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  borderColor?: string;
  placeholder?: string;
  style?: object;
};

export default function PhoneInput({ value, onChangeText, borderColor, placeholder, style }: Props) {
  const colors = useColors();

  const handleChange = (raw: string) => {
    // strip non-digits, cap at 10
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    onChangeText(digits);
  };

  const bc = borderColor ?? colors.border;

  return (
    <View style={[s.wrapper, { borderColor: bc, backgroundColor: colors.card }, style]}>
      {/* Fixed prefix */}
      <View style={[s.prefix, { borderRightColor: bc }]}>
        <Text style={[s.prefixText, { color: colors.foreground }]}>+91</Text>
      </View>
      <TextInput
        style={[s.input, { color: colors.foreground }]}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder ?? '10-digit number'}
        placeholderTextColor={colors.mutedForeground}
        keyboardType="number-pad"
        maxLength={10}
        returnKeyType="done"
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  prefix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
});
