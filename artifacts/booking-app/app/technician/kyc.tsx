/**
 * KYC Verification Screen — Technician
 * Allows technician to:
 *  1. View their current KYC status
 *  2. Fill in personal details (name, email)
 *  3. Upload PAN Card + Address Proof photos
 *  4. Submit / re-submit for review
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppAuth } from '@/contexts/AppAuthContext';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

type KycStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

interface KycDoc {
  id: number;
  fullName: string;
  email: string | null;
  panCardPath: string | null;
  addressProofPath: string | null;
  status: KycStatus;
  reviewNotes: string | null;
  reviewerName: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

const STATUS_CONFIG: Record<KycStatus, { label: string; labelHi: string; color: string; bg: string; icon: string }> = {
  not_submitted: { label: 'Not Submitted', labelHi: 'जमा नहीं',  color: '#94a3b8', bg: '#1e293b', icon: 'file-text' },
  pending:       { label: 'Pending',       labelHi: 'समीक्षाधीन', color: '#f59e0b', bg: '#451a03', icon: 'clock'     },
  verified:      { label: 'Verified ✅',   labelHi: 'सत्यापित',   color: '#10b981', bg: '#064e3b', icon: 'check-circle' },
  rejected:      { label: 'Rejected ❌',   labelHi: 'अस्वीकृत',   color: '#f43f5e', bg: '#4c0519', icon: 'x-circle'  },
};

// ── Upload a photo to the API server (multipart) ──────────────────────────────
async function uploadPhoto(uri: string, techCode: string): Promise<string> {
  const ext  = uri.split('.').pop() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const form = new FormData();
  form.append('file', { uri, name: `kyc-${Date.now()}.${ext}`, type: mime } as any);
  const r = await fetch(`${API}/api/storage/uploads/multipart`, {
    method: 'POST',
    headers: { 'X-Tech-Code': techCode },
    body: form,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error ?? 'Upload failed');
  }
  const { objectPath } = await r.json();
  return objectPath as string;
}

// ── Pick an image from camera or gallery ─────────────────────────────────────
async function pickImage(source: 'camera' | 'gallery'): Promise<string | null> {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Camera permission is needed.'); return null; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    return res.canceled ? null : res.assets[0].uri;
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Gallery permission is needed.'); return null; }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    return res.canceled ? null : res.assets[0].uri;
  }
}

export default function KycScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAppAuth();
  const techCode = (user as any)?.uniqueCode ?? '';

  const [status,   setStatus]   = useState<KycStatus>('not_submitted');
  const [kycDoc,   setKycDoc]   = useState<KycDoc | null>(null);
  const [loading,  setLoading]  = useState(true);

  // Form state
  const [fullName,    setFullName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [panUri,      setPanUri]      = useState<string | null>(null);   // local URI before upload
  const [addrUri,     setAddrUri]     = useState<string | null>(null);
  const [panPath,     setPanPath]     = useState<string | null>(null);   // uploaded objectPath
  const [addrPath,    setAddrPath]    = useState<string | null>(null);
  const [uploading,   setUploading]   = useState<'pan' | 'addr' | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  // ── Load existing KYC status ────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    if (!techCode) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/kyc/status`, {
        headers: { 'X-Tech-Code': techCode },
      });
      const data = await r.json();
      setStatus(data.status === 'not_submitted' ? 'not_submitted' : data.status);
      if (data.kycDoc) {
        setKycDoc(data.kycDoc);
        setFullName(data.kycDoc.fullName ?? '');
        setEmail(data.kycDoc.email ?? '');
        setPanPath(data.kycDoc.panCardPath);
        setAddrPath(data.kycDoc.addressProofPath);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [techCode]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ── Photo picker sheet ──────────────────────────────────────────────────────
  const handlePickDoc = useCallback(async (which: 'pan' | 'addr') => {
    Alert.alert('Upload Document', 'Choose source', [
      { text: 'Camera',  onPress: async () => {
        const uri = await pickImage('camera');
        if (!uri) return;
        which === 'pan' ? setPanUri(uri) : setAddrUri(uri);
        await handleUpload(which, uri);
      }},
      { text: 'Gallery', onPress: async () => {
        const uri = await pickImage('gallery');
        if (!uri) return;
        which === 'pan' ? setPanUri(uri) : setAddrUri(uri);
        await handleUpload(which, uri);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [techCode]);

  const handleUpload = async (which: 'pan' | 'addr', uri: string) => {
    setUploading(which);
    try {
      const path = await uploadPhoto(uri, techCode);
      which === 'pan' ? setPanPath(path) : setAddrPath(path);
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message ?? 'Could not upload document');
    } finally {
      setUploading(null);
    }
  };

  // ── Submit KYC ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!fullName.trim()) { Alert.alert('Missing Info', 'Full name is required'); return; }
    if (!panPath && !addrPath) { Alert.alert('Missing Documents', 'Please upload at least one document'); return; }

    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/kyc/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tech-Code': techCode },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), panCardPath: panPath, addressProofPath: addrPath }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Submission failed');
      Alert.alert('✅ Submitted!', 'Your KYC documents have been submitted for review. You will be notified once reviewed.');
      await loadStatus();
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cfg = STATUS_CONFIG[status];
  const canResubmit = status === 'rejected' || status === 'not_submitted';
  const isPending = status === 'pending';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#94a3b8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KYC Verification</Text>
        <TouchableOpacity onPress={loadStatus} style={styles.backBtn}>
          <Feather name="refresh-cw" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* ── Status Banner ─────────────────────────────────────────────── */}
        <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as any} size={28} color={cfg.color} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={styles.statusHi}>{cfg.labelHi}</Text>
            {kycDoc?.reviewedAt && (
              <Text style={styles.statusMeta}>
                Reviewed {new Date(kycDoc.reviewedAt).toLocaleDateString('en-IN')}
                {kycDoc.reviewerName ? ` by ${kycDoc.reviewerName}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Review notes (on rejection) */}
        {status === 'rejected' && kycDoc?.reviewNotes && (
          <View style={styles.reviewNotesBox}>
            <Text style={styles.reviewNotesLabel}>Rejection Reason:</Text>
            <Text style={styles.reviewNotesText}>{kycDoc.reviewNotes}</Text>
          </View>
        )}

        {/* Verified message */}
        {status === 'verified' && (
          <View style={styles.verifiedBox}>
            <Text style={styles.verifiedText}>🎉 Your KYC is verified! You can now receive customer bookings.</Text>
          </View>
        )}

        {/* ── Form (shown when not verified) ────────────────────────────── */}
        {(canResubmit || isPending) && (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Personal Details</Text>

            <Text style={styles.fieldLabel}>Full Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, isPending && styles.inputDisabled]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="As on government ID"
              placeholderTextColor="#475569"
              editable={!isPending}
            />

            <Text style={styles.fieldLabel}>Email (optional)</Text>
            <TextInput
              style={[styles.input, isPending && styles.inputDisabled]}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#475569"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isPending}
            />
          </View>
        )}

        {/* ── Document Upload ────────────────────────────────────────────── */}
        {(canResubmit || isPending) && (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Documents</Text>
            <Text style={styles.docHelp}>Upload clear photos of your documents (max 10MB each)</Text>

            {/* PAN Card */}
            <DocUploadRow
              label="PAN Card"
              labelHi="पैन कार्ड"
              icon="credit-card"
              localUri={panUri}
              uploaded={!!panPath}
              uploading={uploading === 'pan'}
              disabled={isPending}
              onPick={() => handlePickDoc('pan')}
            />

            {/* Address Proof */}
            <DocUploadRow
              label="Address Proof"
              labelHi="पता प्रमाण"
              icon="home"
              localUri={addrUri}
              uploaded={!!addrPath}
              uploading={uploading === 'addr'}
              disabled={isPending}
              onPick={() => handlePickDoc('addr')}
            />
          </View>
        )}

        {/* ── Submit button ──────────────────────────────────────────────── */}
        {canResubmit && (
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !!uploading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !!uploading}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.submitBtnText}>
                  {status === 'rejected' ? '🔄 Re-submit KYC' : '📤 Submit KYC'}
                </Text>
            }
          </TouchableOpacity>
        )}

        {isPending && (
          <View style={styles.pendingNote}>
            <Feather name="info" size={14} color="#f59e0b" />
            <Text style={styles.pendingNoteText}>
              Your KYC is under review. You'll be notified once it's processed.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Doc Upload Row Component ──────────────────────────────────────────────────
function DocUploadRow({
  label, labelHi, icon, localUri, uploaded, uploading, disabled, onPick,
}: {
  label: string; labelHi: string; icon: string;
  localUri: string | null; uploaded: boolean; uploading: boolean;
  disabled: boolean; onPick: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.docRow, disabled && styles.docRowDisabled, uploaded && styles.docRowUploaded]}
      onPress={disabled ? undefined : onPick}
      disabled={disabled || uploading}
    >
      <View style={styles.docIconBox}>
        <Feather name={icon as any} size={20} color={uploaded ? '#10b981' : '#94a3b8'} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.docLabel, uploaded && { color: '#10b981' }]}>{label}</Text>
        <Text style={styles.docLabelHi}>{labelHi}</Text>
      </View>
      <View style={styles.docStatus}>
        {uploading ? (
          <ActivityIndicator size="small" color="#f59e0b" />
        ) : uploaded ? (
          <View style={styles.docBadgeSuccess}>
            <Feather name="check" size={12} color="#10b981" />
            <Text style={styles.docBadgeSuccessText}>Uploaded</Text>
          </View>
        ) : (
          <View style={styles.docBadge}>
            <Feather name="upload" size={12} color="#94a3b8" />
            <Text style={styles.docBadgeText}>Upload</Text>
          </View>
        )}
      </View>
      {localUri && (
        <Image source={{ uri: localUri }} style={styles.docThumb} />
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f172a' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  backBtn:        { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle:    { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  body:           { padding: 16, gap: 16 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statusLabel:    { fontSize: 16, fontWeight: '700' },
  statusHi:       { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusMeta:     { fontSize: 11, color: '#64748b', marginTop: 4 },

  reviewNotesBox: {
    backgroundColor: '#4c0519', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#9f1239',
  },
  reviewNotesLabel: { fontSize: 11, fontWeight: '700', color: '#fb7185', marginBottom: 4 },
  reviewNotesText:  { fontSize: 13, color: '#fda4af' },

  verifiedBox: {
    backgroundColor: '#064e3b', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#059669',
  },
  verifiedText: { fontSize: 13, color: '#34d399', lineHeight: 20 },

  formCard: {
    backgroundColor: '#1e293b', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle:   { fontSize: 14, fontWeight: '700', color: '#f1f5f9', marginBottom: 14 },
  fieldLabel:     { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: '600' },
  required:       { color: '#f43f5e' },
  input: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: '#f1f5f9', fontSize: 14, marginBottom: 14,
  },
  inputDisabled:  { opacity: 0.5 },

  docHelp:        { fontSize: 11, color: '#64748b', marginBottom: 12 },
  docRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#334155',
  },
  docRowUploaded: { borderColor: '#059669' },
  docRowDisabled: { opacity: 0.6 },
  docIconBox:     { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  docLabel:       { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  docLabelHi:     { fontSize: 11, color: '#475569', marginTop: 2 },
  docStatus:      { marginLeft: 'auto', paddingLeft: 8 },
  docBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  docBadgeText:   { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  docBadgeSuccess: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#064e3b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  docBadgeSuccessText: { fontSize: 11, color: '#10b981', fontWeight: '600' },
  docThumb:       { width: 36, height: 36, borderRadius: 6, marginLeft: 8 },

  submitBtn: {
    backgroundColor: '#d97706', borderRadius: 12, padding: 15,
    alignItems: 'center', marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },

  pendingNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#451a03', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#92400e',
  },
  pendingNoteText: { flex: 1, fontSize: 12, color: '#fcd34d', lineHeight: 18 },
});
