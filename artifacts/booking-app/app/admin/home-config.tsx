import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Alert, Switch, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  useListServiceCategories, useGetHomeConfig,
  useCreateServiceCategory, useUpdateServiceCategory, useDeleteServiceCategory,
  useUpdateHomeConfig,
} from '@workspace/api-client-react';

// Curated Feather icon list for the icon picker
const ICON_OPTIONS = [
  'wind', 'zap', 'tool', 'droplet', 'edit-2', 'settings',
  'home', 'cpu', 'truck', 'activity', 'briefcase', 'camera',
  'anchor', 'box', 'coffee', 'filter', 'layers', 'map',
  'monitor', 'package', 'phone', 'radio', 'shield', 'sun',
  'thermometer', 'umbrella', 'wifi', 'scissors', 'sliders', 'star',
] as const;

const ACCENT_OPTIONS = [
  '#3b82f6', '#f59e0b', '#d97706', '#0ea5e9', '#ec4899',
  '#6b7280', '#22c55e', '#ef4444', '#8b5cf6', '#f97316',
  '#14b8a6', '#a855f7',
];

type Category = {
  id: number; name: string; icon: string; accent: string;
  professionType: string; sortOrder: number; isActive: boolean;
};

type EditModal = { visible: boolean; category: Category | null };

export default function AdminHomeConfigScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { isAdmin } = useAdminAuth();
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useListServiceCategories({});
  const { data: homeConfig } = useGetHomeConfig({});

  const { mutateAsync: createCat } = useCreateServiceCategory();
  const { mutateAsync: updateCat } = useUpdateServiceCategory();
  const { mutateAsync: deleteCat } = useDeleteServiceCategory();
  const { mutateAsync: updateConfig } = useUpdateHomeConfig();

  const [editModal, setEditModal] = useState<EditModal>({ visible: false, category: null });
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('settings');
  const [editAccent, setEditAccent] = useState('#6b7280');
  const [editProfType, setEditProfType] = useState('');
  const [saving, setSaving] = useState(false);

  // Helpline edit state
  const [helplineNum, setHelplineNum] = useState('');
  const [helplineName, setHelplineName] = useState('');
  const [helplineEditing, setHelplineEditing] = useState(false);

  useEffect(() => {
    if (homeConfig) {
      setHelplineNum(homeConfig.helplineNumber);
      setHelplineName(homeConfig.helplineName);
    }
  }, [homeConfig]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.mutedForeground }}>Admin access required</Text>
      </View>
    );
  }

  const isLocked = homeConfig?.isLocked ?? false;
  const s = styles(colors);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['listServiceCategories'] });
    queryClient.invalidateQueries({ queryKey: ['getHomeConfig'] });
  };

  const openAdd = () => {
    if (isLocked) { Alert.alert('Locked', 'Home page is locked. Please unlock it first.'); return; }
    setEditModal({ visible: true, category: null });
    setEditName(''); setEditIcon('settings'); setEditAccent('#6b7280'); setEditProfType('');
  };

  const openEdit = (cat: Category) => {
    if (isLocked) { Alert.alert('Locked', 'Home page is locked. Please unlock it first.'); return; }
    setEditModal({ visible: true, category: cat });
    setEditName(cat.name); setEditIcon(cat.icon); setEditAccent(cat.accent); setEditProfType(cat.professionType);
  };

  const closeModal = () => setEditModal({ visible: false, category: null });

  const handleSaveCategory = async () => {
    if (!editName.trim() || !editProfType.trim()) {
      Alert.alert('Required', 'Name and Profession Type are required.'); return;
    }
    setSaving(true);
    try {
      if (editModal.category) {
        await updateCat({ id: editModal.category.id, data: { name: editName.trim(), icon: editIcon, accent: editAccent, professionType: editProfType.trim() } });
      } else {
        const maxOrder = Math.max(0, ...(categories ?? []).map(c => c.sortOrder));
        await createCat({ data: { name: editName.trim(), icon: editIcon, accent: editAccent, professionType: editProfType.trim(), sortOrder: maxOrder + 1 } });
      }
      invalidate();
      closeModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cat: Category) => {
    if (isLocked) { Alert.alert('Locked', 'Home page is locked.'); return; }
    Alert.alert('Delete?', `Delete "${cat.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteCat({ id: cat.id });
        invalidate();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }},
    ]);
  };

  const handleMove = async (cat: Category, direction: 'up' | 'down') => {
    if (isLocked) { Alert.alert('Locked', 'Home page is locked.'); return; }
    const sorted = [...(categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapCat = sorted[swapIdx];
    await Promise.all([
      updateCat({ id: cat.id, data: { sortOrder: swapCat.sortOrder } }),
      updateCat({ id: swapCat.id, data: { sortOrder: cat.sortOrder } }),
    ]);
    invalidate();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleToggleActive = async (cat: Category) => {
    if (isLocked) { Alert.alert('Locked', 'Home page is locked.'); return; }
    await updateCat({ id: cat.id, data: { isActive: !cat.isActive } });
    invalidate();
  };

  const handleToggleLock = async () => {
    const newLock = !isLocked;
    Alert.alert(
      newLock ? '🔒 Lock?' : '🔓 Unlock?',
      newLock
        ? 'Home page will be locked — no changes allowed.'
        : 'Home page will be unlocked — editing allowed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: newLock ? 'Lock' : 'Unlock', onPress: async () => {
          await updateConfig({ data: { isLocked: newLock } });
          invalidate();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }},
      ]
    );
  };

  const handleSaveHelpline = async () => {
    if (!helplineNum.trim()) { Alert.alert('Required', 'Phone number is required.'); return; }
    await updateConfig({ data: { helplineNumber: helplineNum.trim(), helplineName: helplineName.trim() || 'Admin Helpline' } });
    invalidate();
    setHelplineEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const sorted = [...(categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Home Config</Text>
          <Text style={s.headerSub}>Manage Services & Helpline</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={[s.addBtn, isLocked && { opacity: 0.4 }]}>
          <Feather name="plus" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }}
      >
        {/* Lock / Unlock toggle */}
        <TouchableOpacity
          style={[s.lockBanner, { backgroundColor: isLocked ? '#1c0a0a' : '#0a1c0a', borderColor: isLocked ? '#7f1d1d' : '#14532d' }]}
          onPress={handleToggleLock}
          activeOpacity={0.85}
        >
          <View style={[s.lockIcon, { backgroundColor: isLocked ? '#ef444422' : '#22c55e22' }]}>
            <Feather name={isLocked ? 'lock' : 'unlock'} size={22} color={isLocked ? '#ef4444' : '#22c55e'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.lockTitle, { color: isLocked ? '#ef4444' : '#22c55e' }]}>
              {isLocked ? '🔒 Home Page Locked' : '🔓 Home Page Unlocked'}
            </Text>
            <Text style={s.lockSub}>
              {isLocked ? 'Tap to unlock' : 'Tap to lock'}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Helpline Section */}
        <Text style={s.sectionLabel}>HELPLINE NUMBER</Text>
        <View style={s.card}>
          {helplineEditing ? (
            <View style={{ gap: 10 }}>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={helplineName}
                onChangeText={setHelplineName}
                placeholder="Helpline Name (e.g. Admin Support)"
                placeholderTextColor={colors.mutedForeground}
              />
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={helplineNum}
                onChangeText={setHelplineNum}
                placeholder="Phone Number"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={handleSaveHelpline}>
                  <Text style={{ fontWeight: '700', color: '#000' }}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={() => setHelplineEditing(false)}>
                  <Text style={{ fontWeight: '700', color: colors.foreground }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Feather name="phone" size={20} color="#22c55e" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{homeConfig?.helplineName ?? 'Helpline'}</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>{homeConfig?.helplineNumber ?? '—'}</Text>
              </View>
              <TouchableOpacity onPress={() => setHelplineEditing(true)} style={{ padding: 8 }}>
                <Feather name="edit-2" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Service Categories */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={s.sectionLabel}>SERVICE CATEGORIES</Text>
          {isLocked && <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '700' }}>LOCKED</Text>}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : sorted.length === 0 ? (
          <View style={[s.card, { alignItems: 'center', padding: 32 }]}>
            <Text style={{ color: colors.mutedForeground }}>No categories. Tap + to add one.</Text>
          </View>
        ) : (
          sorted.map((cat, idx) => (
            <View key={cat.id} style={[s.catRow, { opacity: cat.isActive ? 1 : 0.5 }]}>
              {/* Color dot & icon */}
              <View style={[s.catIcon, { backgroundColor: (cat.accent ?? '#6b7280') + '22' }]}>
                <Feather name={(cat.icon ?? 'settings') as any} size={20} color={cat.accent ?? '#6b7280'} />
              </View>

              {/* Name & type */}
              <View style={{ flex: 1 }}>
                <Text style={s.catName}>{cat.name}</Text>
                <Text style={s.catType}>{cat.professionType}</Text>
              </View>

              {/* Controls */}
              <View style={s.catControls}>
                {/* Active toggle */}
                <Switch
                  value={cat.isActive}
                  onValueChange={() => handleToggleActive(cat as Category)}
                  thumbColor={cat.isActive ? colors.primary : colors.mutedForeground}
                  trackColor={{ false: colors.border, true: colors.primary + '55' }}
                  style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                />
                {/* Up/Down */}
                <TouchableOpacity onPress={() => handleMove(cat as Category, 'up')} style={s.iconBtn} disabled={idx === 0}>
                  <Feather name="chevron-up" size={18} color={idx === 0 ? colors.border : colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleMove(cat as Category, 'down')} style={s.iconBtn} disabled={idx === sorted.length - 1}>
                  <Feather name="chevron-down" size={18} color={idx === sorted.length - 1 ? colors.border : colors.mutedForeground} />
                </TouchableOpacity>
                {/* Edit */}
                <TouchableOpacity onPress={() => openEdit(cat as Category)} style={s.iconBtn}>
                  <Feather name="edit-2" size={16} color={colors.primary} />
                </TouchableOpacity>
                {/* Delete */}
                <TouchableOpacity onPress={() => handleDelete(cat as Category)} style={s.iconBtn}>
                  <Feather name="trash-2" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[s.addCatBtn, isLocked && { opacity: 0.4 }]}
          onPress={openAdd}
          disabled={isLocked}
        >
          <Feather name="plus" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>Add New Service</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit / Add Modal */}
      <Modal visible={editModal.visible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={s.modalHeader}>
              <Text style={[s.headerTitle, { color: colors.foreground }]}>
                {editModal.category ? 'Edit Service' : 'Add New Service'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              {/* Name */}
              <Text style={s.fieldLabel}>Service Name *</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="e.g. AC Service"
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Profession type */}
              <Text style={s.fieldLabel}>Profession Type *</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={editProfType}
                onChangeText={setEditProfType}
                placeholder="e.g. ac_technician, plumber"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
              />

              {/* Icon picker */}
              <Text style={s.fieldLabel}>Choose Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {ICON_OPTIONS.map(ic => (
                  <TouchableOpacity
                    key={ic}
                    style={[s.iconPickerItem, editIcon === ic && { borderColor: editAccent, backgroundColor: editAccent + '22' }]}
                    onPress={() => setEditIcon(ic)}
                  >
                    <Feather name={ic as any} size={20} color={editIcon === ic ? editAccent : colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Accent color */}
              <Text style={s.fieldLabel}>Choose Color</Text>
              <View style={s.colorRow}>
                {ACCENT_OPTIONS.map(ac => (
                  <TouchableOpacity
                    key={ac}
                    style={[s.colorSwatch, { backgroundColor: ac }, editAccent === ac && s.colorSwatchSelected]}
                    onPress={() => setEditAccent(ac)}
                  />
                ))}
              </View>
            </ScrollView>

            {/* Preview */}
            <View style={s.previewRow}>
              <View style={[s.catIcon, { backgroundColor: editAccent + '22', marginRight: 10 }]}>
                <Feather name={editIcon as any} size={22} color={editAccent} />
              </View>
              <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 15 }}>{editName || 'Preview'}</Text>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: colors.primary, marginTop: 6 }, saving && { opacity: 0.6 }]}
              onPress={handleSaveCategory}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={{ fontWeight: '800', color: '#000', fontSize: 16 }}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 6 },
  addBtn: { padding: 8, backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: c.foreground },
  headerSub: { fontSize: 12, color: c.mutedForeground, marginTop: 1 },

  lockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 20,
  },
  lockIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontSize: 15, fontWeight: '700' },
  lockSub: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: c.mutedForeground,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },

  card: {
    backgroundColor: c.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 20,
  },

  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.card, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: c.border, marginBottom: 8,
  },
  catIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  catType: { fontSize: 11, color: c.mutedForeground, marginTop: 1 },
  catControls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: 4 },

  addCatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, borderWidth: 1.5, borderColor: c.primary,
    borderStyle: 'dashed', padding: 14, marginTop: 4,
  },

  input: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontSize: 14, marginBottom: 12,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: c.mutedForeground, marginBottom: 6 },

  iconPickerItem: {
    width: 44, height: 44, borderRadius: 10, marginRight: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
    backgroundColor: c.secondary,
  },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  colorSwatch: { width: 32, height: 32, borderRadius: 8 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#fff' },

  previewRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.background, borderRadius: 10, padding: 12, marginBottom: 8,
  },

  saveBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
});
