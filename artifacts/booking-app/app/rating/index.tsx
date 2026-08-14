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
import { useCreateAppRating, useGetAppRatingsSummary } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const RATER_TYPES = [
  { key: 'customer',    label: 'Customer',  icon: '👤' },
  { key: 'technician',  label: 'Technician', icon: '🔧' },
];

export default function RatingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const createRating = useCreateAppRating();
  const { data: summary } = useGetAppRatingsSummary({});

  const [raterType, setRaterType] = useState<'customer' | 'technician'>('customer');
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleStar = (s: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(s);
  };

  const handleSubmit = () => {
    if (rating === 0) { Alert.alert('', 'Please select a rating'); return; }
    createRating.mutate(
      { data: { raterType, raterName: name.trim() || undefined, rating, comment: comment.trim() || undefined } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries();
          setSubmitted(true);
        },
        onError: () => Alert.alert('Error', 'Rating could not be submitted. Please retry.'),
      },
    );
  };

  const s = styles(colors);

  if (submitted) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <View style={s.thankIcon}>
          {[...Array(rating)].map((_, i) => (
            <Feather key={i} name="star" size={28} color="#f59e0b" />
          ))}
        </View>
        <Text style={s.thankTitle}>Thank you for your rating! 🙏</Text>
        <Text style={s.thankSub}>Your feedback helps us improve.</Text>
        {summary && (
          <View style={s.summaryCard}>
            <Text style={[s.avgNum, { color: colors.primary }]}>{summary.averageRating?.toFixed(1)}</Text>
            <View style={s.starsRow}>
              {[1,2,3,4,5].map(s => <Feather key={s} name="star" size={20} color={s <= Math.round(summary.averageRating ?? 0) ? '#f59e0b' : '#333'} />)}
            </View>
            <Text style={s.totalText}>{summary.totalRatings} ratings</Text>
          </View>
        )}
        <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary, marginTop: 28 }]} onPress={() => router.back()}>
          <Text style={[s.submitText, { color: colors.primaryForeground }]}>Go to Home</Text>
        </TouchableOpacity>
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
          <Text style={s.headerTitle}>Rate the App</Text>
          <Text style={s.headerSub}>Rate the App</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}
      >
        {/* Current average */}
        {summary && (
          <View style={s.avgCard}>
            <Text style={[s.avgNum, { color: colors.primary }]}>{summary.averageRating?.toFixed(1)}</Text>
            <View style={s.starsRow}>
              {[1,2,3,4,5].map(st => <Feather key={st} name="star" size={18} color={st <= Math.round(summary.averageRating ?? 0) ? '#f59e0b' : '#333'} />)}
            </View>
            <Text style={s.totalText}>{summary.totalRatings} ratings</Text>
          </View>
        )}

        {/* Rater type */}
        <View style={s.field}>
          <Text style={s.label}>Who are you?</Text>
          <View style={s.typeRow}>
            {RATER_TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[s.typeBtn, raterType === t.key && s.typeBtnActive]} onPress={() => setRaterType(t.key as any)}>
                <Text style={s.typeEmoji}>{t.icon}</Text>
                <Text style={[s.typeBtnText, raterType === t.key && { color: colors.primaryForeground }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Name (optional) */}
        <View style={s.field}>
          <Text style={s.label}>Name (Optional)</Text>
          <TextInput style={s.input} value={name} onChangeText={setName}
            placeholder="Your name" placeholderTextColor={colors.mutedForeground} />
        </View>

        {/* Stars */}
        <View style={s.field}>
          <Text style={s.label}>Give Rating <Text style={s.required}>*</Text></Text>
          <View style={s.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleStar(star)} activeOpacity={0.7}>
                <Feather
                  name="star"
                  size={44}
                  color={star <= rating ? '#f59e0b' : colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={s.ratingLabel}>
              {['', 'Very Bad 😞', 'Bad 😕', 'Okay 😐', 'Good 😊', 'Excellent 🤩'][rating]}
            </Text>
          )}
        </View>

        {/* Comment */}
        <View style={s.field}>
          <Text style={s.label}>Comment (Optional)</Text>
          <TextInput
            style={[s.input, s.multiline]}
            value={comment} onChangeText={setComment}
            placeholder="Share your thoughts about the app..." placeholderTextColor={colors.mutedForeground}
            multiline numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: rating > 0 ? colors.primary : colors.secondary }, createRating.isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={createRating.isPending}
          activeOpacity={0.85}
        >
          {createRating.isPending ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>⭐ Submit Rating</Text>}
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
  avgCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: c.border, marginBottom: 20, gap: 6,
  },
  avgNum: { fontSize: 48, fontWeight: '800' },
  starsRow: { flexDirection: 'row', gap: 4 },
  totalText: { fontSize: 12, color: c.mutedForeground },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: c.mutedForeground, marginBottom: 8 },
  required: { color: c.destructive },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.card, borderRadius: 12, padding: 14, borderWidth: 2, borderColor: 'transparent',
  },
  typeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  typeEmoji: { fontSize: 18 },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: c.foreground },
  input: {
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: c.foreground,
  },
  multiline: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  starRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  ratingLabel: { fontSize: 16, fontWeight: '600', color: c.foreground, marginTop: 8 },
  submitBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#000' },
  // success
  thankIcon: { flexDirection: 'row', gap: 4, marginBottom: 20 },
  thankTitle: { fontSize: 24, fontWeight: '800', color: c.foreground, textAlign: 'center' },
  thankSub: { fontSize: 14, color: c.mutedForeground, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  summaryCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: c.border, marginTop: 24, gap: 6, width: '80%',
  },
});
