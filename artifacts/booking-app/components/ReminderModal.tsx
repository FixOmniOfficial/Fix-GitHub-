/**
 * ReminderModal — Full-featured reminder form
 *
 * • Auto-fills customer name, phone, notes
 * • Date + Time picker: native DateTimePicker (Android/iOS) or editable
 *   TextInput (web / fallback)
 * • Ringtone selection: Default sound | Vibrate | Silent
 * • Saves to API + schedules a device local notification (alarm)
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, Alert, Platform, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useColors } from '@/hooks/useColors';

// ─── DateTimePicker — only loaded on native ───────────────────────────────────
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  // Dynamic require keeps web bundle clean
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

// ─── Notification handler (set once at module level) ─────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReminderTarget {
  name: string;
  phone: string;
  notes?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  target: ReminderTarget | null;
  techCode: string;
  apiBase: string;          // process.env.EXPO_PUBLIC_API_URL ?? ''
}

type Ringtone = 'default' | 'vibrate' | 'silent';
type PickerMode = 'date' | 'time' | null;

const pad = (n: number) => String(n).padStart(2, '0');

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReminderModal({ visible, onClose, onSaved, target, techCode, apiBase }: Props) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const s       = styles(colors);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title,    setTitle]    = useState('');
  const [notes,    setNotes]    = useState('');
  const [ringtone, setRingtone] = useState<Ringtone>('default');
  const [saving,   setSaving]   = useState(false);

  // Date/Time state — single Date object as source of truth
  const [selDate,     setSelDate]     = useState<Date>(new Date());
  const [pickerMode,  setPickerMode]  = useState<PickerMode>(null);
  // Web fallback — editable strings
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');

  // ── Reset form when modal opens ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);   // default: 30 min from now
    now.setSeconds(0, 0);
    setTitle('');
    setNotes(target?.notes?.trim() ?? '');
    setRingtone('default');
    setSelDate(now);
    setDateStr(toDateStr(now));
    setTimeStr(toTimeStr(now));
    setPickerMode(null);
  }, [visible]);

  // ── Resolve final Date from web strings or native Date object ───────────────
  const resolveDate = (): Date | null => {
    if (Platform.OS === 'web') {
      if (!dateStr.trim() && !timeStr.trim()) return null;
      const iso = `${dateStr.trim()}T${timeStr.trim() || '00:00'}:00`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : d;
    }
    return selDate;
  };

  // ── Request notification permission ─────────────────────────────────────────
  const ensurePermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;      // web can't schedule alarms
    const perms = await Notifications.getPermissionsAsync();
    const granted = (perms as any).granted ?? (perms as any).status === 'granted';
    if (granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    const wasGranted = (asked as any).granted ?? (asked as any).status === 'granted';
    if (!wasGranted) {
      Alert.alert(
        '🔔 Permission Required',
        'Please allow notification permission to ring reminder alarms. Go to Settings → App → Notifications to enable it.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // ── Schedule device alarm ────────────────────────────────────────────────────
  const scheduleAlarm = async (at: Date, finalTitle: string) => {
    const granted = await ensurePermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔔 ${finalTitle}`,
        body: `${target?.name ?? ''} — ${notes.trim() || 'Reminder'}`,
        sound: ringtone === 'default' ? 'default' : undefined,
        vibrate: ringtone !== 'silent' ? [0, 250, 250, 250] : [0],
        data: { customerName: target?.name, customerPhone: target?.phone },
      },
      trigger: { date: at } as any,
    });
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    const finalTitle = title.trim() || `Reminder — ${target?.name ?? ''}`;
    const at = resolveDate();

    if (at && at <= new Date()) {
      Alert.alert('', 'Date/Time must be in the future'); return;
    }

    setSaving(true);
    const reminderAt = at
      ? `${toDateStr(at)} ${toTimeStr(at)}`
      : null;

    try {
      await fetch(`${apiBase}/api/booking/tech-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          techCode, title: finalTitle,
          note: notes.trim() || null,
          reminderAt, ringtone,
          customerName: target?.name ?? null,
          customerPhone: target?.phone ?? null,
        }),
      });

      // Schedule device alarm if a future time was chosen
      if (at) {
        try { await scheduleAlarm(at, finalTitle); } catch (_) { /* alarm failed — reminder still saved */ }
      }

      onSaved?.();
      onClose();
      const timeLabel = at ? ` ${toDateStr(at)} ${toTimeStr(at)} hrs` : '';
      Alert.alert('✅ Reminder Set!', `Alarm set for "${finalTitle}"${timeLabel}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save');
    }
    setSaving(false);
  };

  // ── DateTimePicker onChange ──────────────────────────────────────────────────
  const onPickerChange = (_: any, picked?: Date) => {
    if (!picked) { setPickerMode(null); return; }
    setSelDate(picked);
    if (Platform.OS === 'android') {
      // On Android: date picked → auto-advance to time; time picked → done
      if (pickerMode === 'date') setPickerMode('time');
      else setPickerMode(null);
    }
    // iOS: stays open until user closes modal
  };

  // ── Formatted display string for native ─────────────────────────────────────
  const displayDate = toDateStr(selDate);
  const displayTime = toTimeStr(selDate);

  // ── Ringtone options ─────────────────────────────────────────────────────────
  const ringtones: { value: Ringtone; icon: string; label: string; color: string }[] = [
    { value: 'default', icon: '🔔', label: 'Sound',    color: '#f59e0b' },
    { value: 'vibrate', icon: '📳', label: 'Vibrate',  color: '#8b5cf6' },
    { value: 'silent',  icon: '🔕', label: 'Silent',   color: colors.mutedForeground },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[s.root, { backgroundColor: colors.background }]}>
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <View style={[s.header, {
          paddingTop: Platform.OS === 'web' ? 16 : insets.top + 10,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        }]}>
          <TouchableOpacity onPress={onClose} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#f59e0b', letterSpacing: 1 }}>SET REMINDER</Text>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>🔔 Alarm Schedule</Text>
          </View>
          {/* Save button in header */}
          <TouchableOpacity
            onPress={save} disabled={saving}
            style={[s.headerSaveBtn, { backgroundColor: '#f59e0b', opacity: saving ? 0.6 : 1 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={{ fontSize: 13, fontWeight: '800', color: '#000' }}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Customer chip (auto-filled, read-only) ──────────────────────── */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: '#f59e0b44' }]}>
            <Text style={[s.label, { color: '#f59e0b', marginBottom: 8 }]}>👤 CUSTOMER (AUTO-FILLED)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.avatar}>
                <Text style={{ fontSize: 18 }}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.foreground }}>
                  {target?.name ?? '—'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  {target?.phone ?? '—'}
                </Text>
              </View>
              <View style={s.autoBadge}>
                <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '700' }}>AUTO</Text>
              </View>
            </View>
          </View>

          {/* ── Title / Purpose ─────────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.label}>TITLE / PURPOSE</Text>
            <TextInput
              placeholder={`Reminder — ${target?.name ?? ''}`}
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            />
          </View>

          {/* ── Date + Time ─────────────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.label}>📅 DATE & TIME</Text>

            {Platform.OS === 'web' ? (
              /* Web — editable text inputs */
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[s.pickerBtn, { flex: 1, borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Feather name="calendar" size={15} color="#f59e0b" />
                  <TextInput
                    value={dateStr}
                    onChangeText={setDateStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                    style={{ flex: 1, fontSize: 14, color: colors.foreground, fontWeight: '600' }}
                  />
                </View>
                <View style={[s.pickerBtn, { flex: 1, borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Feather name="clock" size={15} color="#f59e0b" />
                  <TextInput
                    value={timeStr}
                    onChangeText={setTimeStr}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                    style={{ flex: 1, fontSize: 14, color: colors.foreground, fontWeight: '600' }}
                  />
                </View>
              </View>
            ) : (
              /* Native — tappable buttons that open DateTimePicker */
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setPickerMode(pickerMode === 'date' ? null : 'date')}
                    activeOpacity={0.8}
                    style={[s.pickerBtn, {
                      flex: 1,
                      backgroundColor: pickerMode === 'date' ? '#f59e0b22' : colors.card,
                      borderColor: pickerMode === 'date' ? '#f59e0b' : colors.border,
                    }]}
                  >
                    <Feather name="calendar" size={15} color="#f59e0b" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{displayDate}</Text>
                    <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setPickerMode(pickerMode === 'time' ? null : 'time')}
                    activeOpacity={0.8}
                    style={[s.pickerBtn, {
                      flex: 1,
                      backgroundColor: pickerMode === 'time' ? '#f59e0b22' : colors.card,
                      borderColor: pickerMode === 'time' ? '#f59e0b' : colors.border,
                    }]}
                  >
                    <Feather name="clock" size={15} color="#f59e0b" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{displayTime}</Text>
                    <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                {/* Native DateTimePicker — inline on iOS, dialog on Android */}
                {pickerMode !== null && DateTimePicker && (
                  <DateTimePicker
                    value={selDate}
                    mode={pickerMode}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onPickerChange}
                    minimumDate={new Date()}
                    themeVariant="dark"
                    style={{ alignSelf: 'stretch', marginTop: 4 }}
                  />
                )}
                {/* iOS: done button to close picker */}
                {pickerMode !== null && Platform.OS === 'ios' && (
                  <TouchableOpacity
                    onPress={() => setPickerMode(null)}
                    style={{ alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#f59e0b22', borderRadius: 8 }}
                  >
                    <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 13 }}>Done ✓</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 4 }}>
              ⏰ Set time par device par alarm bajega
            </Text>
          </View>

          {/* ── Notes (auto-filled from customer) ───────────────────────────── */}
          <View style={s.card}>
            <Text style={s.label}>📝 NOTES</Text>
            <TextInput
              placeholder="Meeting ka maksad, kaam ki details, important points..."
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[s.input, s.notesInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            />
          </View>

          {/* ── Ringtone / Alert type ────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.label}>🎵 ALERT TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {ringtones.map(r => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setRingtone(r.value)}
                  activeOpacity={0.8}
                  style={[
                    s.ringtoneBtn,
                    {
                      flex: 1,
                      borderColor: ringtone === r.value ? r.color : colors.border,
                      backgroundColor: ringtone === r.value ? r.color + '22' : colors.card,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{r.icon}</Text>
                  <Text style={{
                    fontSize: 11, fontWeight: ringtone === r.value ? '800' : '500',
                    color: ringtone === r.value ? r.color : colors.mutedForeground,
                  }}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {Platform.OS === 'web' && (
              <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 6 }}>
                * Device alarm sirf Android/iOS app mein kaam karta hai
              </Text>
            )}
          </View>

          {/* ── Save button (bottom) ─────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={save}
            activeOpacity={0.85}
            disabled={saving}
            style={[s.saveBtn, { opacity: saving ? 0.7 : 1 }]}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#000' }}>Set Reminder</Text>
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  headerBtn:   { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSaveBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  card:        { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 },
  label:       { fontSize: 10, fontWeight: '700', color: c.mutedForeground, letterSpacing: 0.8, marginBottom: 2 },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b22', alignItems: 'center', justifyContent: 'center' },
  autoBadge:   { backgroundColor: '#f59e0b22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  input:       { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14 },
  notesInput:  { minHeight: 88, paddingTop: 11 },
  pickerBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 11 },
  ringtoneBtn: { alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12 },
  saveBtn:     { backgroundColor: '#f59e0b', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
