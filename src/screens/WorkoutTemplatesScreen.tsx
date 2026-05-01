import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutStackParamList } from '../navigation/WorkoutNavigator';
import { useWorkout } from '../context/WorkoutContext';
import { WorkoutTemplate } from '../types';
import { shareTemplates, importSharedTemplates } from '../services/workoutService';
import { useAuth } from '../context/AuthContext';
import { SKILL_COLORS, OSRS_SKILLS } from '../constants/osrsSkills';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'WorkoutTemplates'>;

// ─── Create / Edit modal ──────────────────────────────────────────────────────

interface TemplateModalProps {
  visible: boolean;
  initial?: { name: string; linkedSkillId?: string };
  onSave: (name: string, linkedSkillId?: string) => Promise<void>;
  onClose: () => void;
}

function TemplateModal({ visible, initial, onSave, onClose }: TemplateModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [linkedSkillId, setLinkedSkillId] = useState<string | undefined>(initial?.linkedSkillId);
  const [saving, setSaving] = useState(false);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setLinkedSkillId(initial?.linkedSkillId);
      setSaving(false);
      setSkillPickerOpen(false);
    }
  }, [visible]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed, linkedSkillId);
      onClose();
    } catch {
      setSaving(false);
      Alert.alert('Error', 'Could not save. Please try again.');
    }
  }

  const skillColor = linkedSkillId ? (SKILL_COLORS[linkedSkillId] ?? colors.gold) : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{initial ? 'Edit Workout' : 'New Workout'}</Text>

          <Text style={styles.modalLabel}>Name</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Back / Shoulder Day"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoFocus
            returnKeyType="done"
          />

          <Text style={styles.modalLabel}>Linked Skill (optional)</Text>
          <TouchableOpacity
            style={[styles.skillSelector, skillColor && { borderColor: `${skillColor}88` }]}
            onPress={() => setSkillPickerOpen(p => !p)}
          >
            {linkedSkillId ? (
              <Text style={[styles.skillSelectorText, { color: skillColor }]}>{linkedSkillId}</Text>
            ) : (
              <Text style={styles.skillSelectorPlaceholder}>None — tap to link a skill</Text>
            )}
            <Text style={styles.skillSelectorChevron}>{skillPickerOpen ? '⌄' : '›'}</Text>
          </TouchableOpacity>

          {skillPickerOpen && (
            <View style={styles.skillList}>
              <TouchableOpacity
                style={styles.skillOption}
                onPress={() => { setLinkedSkillId(undefined); setSkillPickerOpen(false); }}
              >
                <Text style={styles.skillOptionText}>None</Text>
              </TouchableOpacity>
              {OSRS_SKILLS.map(skill => {
                const c = SKILL_COLORS[skill] ?? colors.gold;
                return (
                  <TouchableOpacity
                    key={skill}
                    style={[styles.skillOption, linkedSkillId === skill && { backgroundColor: `${c}22` }]}
                    onPress={() => { setLinkedSkillId(skill); setSkillPickerOpen(false); }}
                  >
                    <Text style={[styles.skillOptionText, { color: c }]}>{skill}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, (!name.trim() || saving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color={colors.background} size="small" />
                : <Text style={styles.saveButtonText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Template row ─────────────────────────────────────────────────────────────

function TemplateRow({
  template, onPress, onEdit, onDelete, shareMode, selected,
}: {
  template: WorkoutTemplate;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  shareMode: boolean;
  selected: boolean;
}) {
  const skillColor = template.linkedSkillId ? (SKILL_COLORS[template.linkedSkillId] ?? colors.gold) : null;

  return (
    <TouchableOpacity
      style={[styles.templateRow, selected && styles.templateRowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {shareMode && (
        <View style={[styles.shareCheckbox, selected && styles.shareCheckboxSelected]}>
          {selected && <Text style={styles.shareCheckmark}>✓</Text>}
        </View>
      )}
      <View style={styles.templateRowInfo}>
        <Text style={styles.templateName}>{template.name}</Text>
        {skillColor && (
          <View style={[styles.skillPill, { backgroundColor: `${skillColor}22`, borderColor: `${skillColor}66` }]}>
            <Text style={[styles.skillPillText, { color: skillColor }]}>{template.linkedSkillId}</Text>
          </View>
        )}
      </View>
      {!shareMode && <>
        <TouchableOpacity style={styles.rowActionBtn} onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.rowActionEdit}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rowActionBtn, styles.rowActionDeleteBtn]} onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.rowActionDelete}>🗑</Text>
        </TouchableOpacity>
        <Text style={styles.rowChevron}>›</Text>
      </>}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function WorkoutTemplatesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useWorkout();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkoutTemplate | null>(null);

  // Share
  const [shareMode, setShareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);

  // Import
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importing, setImporting] = useState(false);

  function handleDelete(template: WorkoutTemplate) {
    confirmAction(
      'Delete Workout',
      `Delete "${template.name}"? This will also remove all its exercises.`,
      () => deleteTemplate(template.id).catch(() => Alert.alert('Error', 'Could not delete.'))
    );
  }

  function toggleShareMode() {
    setShareMode(v => !v);
    setSelectedIds(new Set());
    setShareCode(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleGenerateCode() {
    if (!user || selectedIds.size === 0) return;
    setSharing(true);
    try {
      const code = await shareTemplates(user.uid, Array.from(selectedIds));
      setShareCode(code);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not generate code.');
    } finally {
      setSharing(false);
    }
  }

  async function handleImport() {
    if (!user || !importCode.trim()) return;
    setImporting(true);
    try {
      const count = await importSharedTemplates(user.uid, importCode);
      setImportModalVisible(false);
      setImportCode('');
      Alert.alert('Imported!', `${count} workout${count !== 1 ? 's' : ''} added to your library.`);
    } catch (e: any) {
      Alert.alert('Not Found', e.message ?? 'Invalid code.');
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {shareMode ? (
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={toggleShareMode}>
              <Text style={styles.headerCancelText}>✕ Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerShareHint}>
              {selectedIds.size === 0 ? 'Tap workouts to select' : `${selectedIds.size} selected`}
            </Text>
            <TouchableOpacity
              style={[styles.generateBtn, (selectedIds.size === 0 || sharing) && styles.generateBtnDisabled]}
              onPress={handleGenerateCode}
              disabled={selectedIds.size === 0 || sharing}
            >
              {sharing
                ? <ActivityIndicator color={colors.background} size="small" />
                : <Text style={styles.generateBtnText}>Generate Code</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Workouts</Text>
              <Text style={styles.headerSubtitle}>Your training templates</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerActionBtn} onPress={() => setImportModalVisible(true)}>
                <Text style={styles.headerActionText}>Import</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerActionBtn} onPress={toggleShareMode}>
                <Text style={styles.headerActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={templates}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <TemplateRow
            template={item}
            shareMode={shareMode}
            selected={selectedIds.has(item.id)}
            onPress={() => shareMode
              ? toggleSelect(item.id)
              : navigation.push('WorkoutMetrics', { templateId: item.id, templateName: item.name })
            }
            onEdit={() => setEditTarget(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>No Workouts Yet</Text>
            <Text style={styles.emptyText}>Tap + to create your first workout template.</Text>
          </View>
        }
      />

      {/* FAB — hidden in share mode */}
      {!shareMode && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* Share code result modal */}
      <Modal visible={!!shareCode} transparent animationType="fade" onRequestClose={() => setShareCode(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShareCode(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Share Code</Text>
            <Text style={styles.shareCodeDisplay}>{shareCode}</Text>
            <Text style={styles.shareCodeHint}>
              Give this code to anyone with HabitScape. They tap Import and enter it to copy your workouts.
            </Text>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => Share.share({ message: `Join my HabitScape workout! Import code: ${shareCode}` })}
              >
                <Text style={styles.saveButtonText}>Share Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShareCode(null); toggleShareMode(); }}>
                <Text style={styles.cancelButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Import modal */}
      <Modal visible={importModalVisible} transparent animationType="fade" onRequestClose={() => setImportModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setImportModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Import Workouts</Text>
            <Text style={styles.modalLabel}>Enter share code</Text>
            <TextInput
              style={[styles.modalInput, styles.codeInput]}
              placeholder="e.g. ABC123"
              placeholderTextColor={colors.textSecondary}
              value={importCode}
              onChangeText={v => setImportCode(v.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleImport}
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setImportModalVisible(false)} disabled={importing}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!importCode.trim() || importing) && styles.saveButtonDisabled]}
                onPress={handleImport}
                disabled={!importCode.trim() || importing}
              >
                {importing
                  ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.saveButtonText}>Import</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create modal */}
      <TemplateModal
        visible={createModalVisible}
        onSave={(name, skillId) => createTemplate(name, skillId)}
        onClose={() => setCreateModalVisible(false)}
      />

      {/* Edit modal */}
      {editTarget && (
        <TemplateModal
          visible={!!editTarget}
          initial={{ name: editTarget.name, linkedSkillId: editTarget.linkedSkillId }}
          onSave={(name, skillId) => updateTemplate(editTarget.id, name, skillId)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  header: {
    backgroundColor: colors.surface,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
    ...bevel.raised,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.gold, marginBottom: 4 },
  headerSubtitle: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerActionBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceSunken, ...bevel.inset },
  headerActionText: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },
  headerCancelText: { fontFamily: fonts.display, fontSize: 16, color: colors.error },
  headerShareHint: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary, flex: 1, textAlign: 'center' },
  generateBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.gold, ...bevel.raised },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnText: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.background },
  shareCheckbox: {
    width: 22, height: 22, marginRight: 10,
    borderWidth: 2, borderColor: colors.textSecondary,
    justifyContent: 'center', alignItems: 'center',
    ...bevel.inset,
  },
  shareCheckboxSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  shareCheckmark: { fontFamily: fonts.display, fontSize: 14, fontWeight: '900', color: colors.background },
  shareCodeDisplay: {
    fontFamily: fonts.heading, fontSize: 36, color: colors.gold,
    textAlign: 'center', letterSpacing: 10, marginVertical: 20,
  },
  shareCodeHint: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  templateRowSelected: { backgroundColor: `${colors.gold}18`, borderColor: `${colors.gold}55` },
  codeInput: { textAlign: 'center', fontSize: 28, letterSpacing: 8, fontFamily: fonts.heading },

  listContent: { paddingVertical: 8, paddingBottom: 100 },

  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  templateRowInfo: { flex: 1, gap: 6 },
  templateName: { fontFamily: fonts.display, fontSize: 22, color: colors.textPrimary },
  rowActionBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  rowActionDeleteBtn: { backgroundColor: `${colors.destructive}44` },
  rowActionEdit: { fontSize: 16, color: colors.gold },
  rowActionDelete: { fontSize: 15 },
  skillPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  skillPillText: { fontFamily: fonts.display, fontSize: 14 },
  rowChevron: { fontFamily: fonts.display, fontSize: 24, color: colors.textSecondary, marginLeft: 8 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.textPrimary, marginBottom: 8 },
  emptyText: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    ...bevel.raised,
  },
  fabIcon: { fontFamily: fonts.display, fontSize: 32, color: colors.background, lineHeight: 36 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    padding: 20,
    ...bevel.raised,
  },
  modalTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.gold, marginBottom: 16 },
  modalLabel: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  modalInput: {
    backgroundColor: colors.surfaceSunken,
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...bevel.inset,
  },
  skillSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...bevel.inset,
  },
  skillSelectorText: { flex: 1, fontFamily: fonts.display, fontSize: 18 },
  skillSelectorPlaceholder: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary },
  skillSelectorChevron: { fontFamily: fonts.display, fontSize: 20, color: colors.textSecondary },
  skillList: {
    maxHeight: 180,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    overflow: 'scroll' as any,
  },
  skillOption: { paddingHorizontal: 14, paddingVertical: 8 },
  skillOptionText: { fontFamily: fonts.display, fontSize: 17, color: colors.textPrimary },

  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  cancelButtonText: { fontFamily: fonts.display, fontSize: 17, color: colors.textSecondary },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.gold,
    ...bevel.raised,
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.background },
});
