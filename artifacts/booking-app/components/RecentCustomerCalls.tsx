/**
 * RecentCustomerCalls
 *
 * Dashboard section showing the last matched customer calls (Missed / Completed).
 * Only customers already in the technician's database ever appear here —
 * unknown numbers are filtered by useCallerDetection before storage.
 *
 * Each row:
 *  - Customer name + status badge (🔴 Missed / ✅ Completed)
 *  - Phone number + relative time
 *  - "Call Back" button (opens dialer via Linking.openURL)
 *
 * Shows nothing if:
 *  - No history yet
 *  - Platform is web/iOS (Android-only feature)
 *  - Caller ID permission not granted
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking,
  Platform, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { CallHistoryEntry } from '@/hooks/useCallHistory';

interface Props {
  history: CallHistoryEntry[];
  isGranted: boolean;
  onEnablePress: () => void;
  onClearHistory: () => void;
}

// ── Relative time helper ──────────────────────────────────────────────────────
function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins   = Math.floor(diffMs / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function RecentCustomerCalls({
  history,
  isGranted,
  onEnablePress,
  onClearHistory,
}: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  // ── Android-only — silently hidden on web/iOS ─────────────────────────────
  if (Platform.OS !== 'android') return null;

  const s = createStyles(colors);
  const displayList = expanded ? history : history.slice(0, 4);

  // ── Permission not granted → invite card ──────────────────────────────────
  if (!isGranted) {
    return (
      <View style={s.inviteCard}>
        <View style={s.inviteLeft}>
          <Text style={s.inviteIcon}>📲</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.inviteTitle, { color: colors.foreground }]}>Caller ID</Text>
            <Text style={[s.inviteSub, { color: colors.mutedForeground }]}>
              Know which customer is calling — enable once, works instantly.
            </Text>
          </View>
        </View>
        <TouchableOpacity style={s.inviteBtn} onPress={onEnablePress} activeOpacity={0.8}>
          <Text style={s.inviteBtnText}>Enable</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── No history yet ────────────────────────────────────────────────────────
  if (history.length === 0) {
    return (
      <View>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>
          📞 Recent Customer Calls
        </Text>
        <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="phone" size={28} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            No customer calls yet. Caller ID is active — when a saved customer calls, they'll appear here.
          </Text>
        </View>
      </View>
    );
  }

  // ── Call list ─────────────────────────────────────────────────────────────
  const handleClearPress = () => {
    Alert.alert(
      'Clear Call History',
      'Remove all recent customer call records?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: onClearHistory },
      ]
    );
  };

  return (
    <View>
      {/* Header */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>
          📞 Recent Customer Calls
        </Text>
        <TouchableOpacity onPress={handleClearPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="trash-2" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Rows */}
      <View style={{ gap: 8 }}>
        {displayList.map(entry => (
          <CallRow key={entry.id} entry={entry} colors={colors} styles={s} />
        ))}
      </View>

      {/* Show more / less */}
      {history.length > 4 && (
        <TouchableOpacity style={s.expandBtn} onPress={() => setExpanded(e => !e)}>
          <Text style={[s.expandBtnText, { color: colors.mutedForeground }]}>
            {expanded ? 'Show less' : `Show ${history.length - 4} more`}
          </Text>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Individual row ────────────────────────────────────────────────────────────
function CallRow({
  entry, colors, styles: s,
}: {
  entry: CallHistoryEntry;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
}) {
  const isMissed = entry.callStatus === 'Missed';

  const handleCallBack = () => {
    if (entry.phoneNumber) {
      Linking.openURL(`tel:${entry.phoneNumber}`);
    }
  };

  return (
    <View style={[s.row, { backgroundColor: colors.card, borderColor: isMissed ? '#ef444430' : '#22c55e22' }]}>
      {/* Status dot */}
      <View style={[s.statusDot, { backgroundColor: isMissed ? '#ef4444' : '#22c55e' }]} />

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.customerName, { color: colors.foreground }]} numberOfLines={1}>
            {entry.customerName}
          </Text>
          <View style={[s.statusBadge, { backgroundColor: isMissed ? '#ef444418' : '#22c55e18' }]}>
            <Text style={[s.statusBadgeText, { color: isMissed ? '#ef4444' : '#22c55e' }]}>
              {isMissed ? 'Missed' : '✓ Completed'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          {entry.phoneNumber ? (
            <Text style={[s.phone, { color: colors.mutedForeground }]}>{entry.phoneNumber}</Text>
          ) : (
            <Text style={[s.phone, { color: colors.mutedForeground, fontStyle: 'italic' }]}>
              Number unavailable
            </Text>
          )}
          <Text style={[s.dot, { color: colors.border }]}>·</Text>
          <Text style={[s.time, { color: colors.mutedForeground }]}>{relativeTime(entry.timestamp)}</Text>
        </View>
      </View>

      {/* Call Back button */}
      {entry.phoneNumber && (
        <TouchableOpacity style={s.callBackBtn} onPress={handleCallBack} activeOpacity={0.8}>
          <Feather name="phone" size={13} color="#22c55e" />
          <Text style={s.callBackText}>Call Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
    },
    sectionTitle: { fontSize: 15, fontWeight: '800' },
    emptyCard: {
      borderWidth: 1, borderRadius: 14, padding: 20,
      alignItems: 'center', gap: 10,
    },
    emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
    inviteCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#a855f710', borderWidth: 1, borderColor: '#a855f730',
      borderRadius: 14, padding: 14,
    },
    inviteLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    inviteIcon: { fontSize: 22 },
    inviteTitle: { fontSize: 14, fontWeight: '800' },
    inviteSub: { fontSize: 11, lineHeight: 16, marginTop: 2 },
    inviteBtn: {
      backgroundColor: '#a855f7', borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 8, shrink: 0,
    } as any,
    inviteBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2, shrink: 0 } as any,
    customerName: { fontSize: 14, fontWeight: '700', flex: 1 },
    statusBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    statusBadgeText: { fontSize: 10, fontWeight: '700' },
    phone: { fontSize: 12 },
    dot:   { fontSize: 12 },
    time:  { fontSize: 12 },
    callBackBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: '#22c55e18', borderWidth: 1, borderColor: '#22c55e40',
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    },
    callBackText: { fontSize: 11, fontWeight: '700', color: '#22c55e' },
    expandBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, paddingVertical: 10, marginTop: 2,
    },
    expandBtnText: { fontSize: 12, fontWeight: '600' },
  });
}
