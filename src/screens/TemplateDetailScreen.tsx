import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
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
import { useAuth } from '../context/AuthContext';
import { TemplateExercise } from '../types';
import {
  subscribeToExercises,
  addExercise,
  updateExercise,
  deleteExercise,
  reorderExercises,
} from '../services/workoutService';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'TemplateDetail'>;

// ─── Sets stepper ─────────────────────────────────────────────────────────────

function SetsStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepperBtn}
        onPress={() => onChange(Math.max(1, value - 1))}
      >
        <Text style={styles.stepperBtnText}>−</Text>
      </TouchableOpacity>
      <View style={styles.stepperValue}>
        <Text style={styles.stepperValueText}>{value}</Text>
        <Text style={styles.stepperValueLabel}>sets</Text>
      </View>
      <TouchableOpacity
        style={styles.stepperBtn}
        onPress={() => onChange(Math.min(20, value + 1))}
      >
        <Text style={styles.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add / Edit exercise modal ────────────────────────────────────────────────

interface ExerciseModalProps {
  visible: boolean;
  initial?: { name: string; defaultSets: number; repRange?: string };
  onSave: (name: string, defaultSets: number, repRange?: string) => Promise<void>;
  onClose: () => void;
}

function ExerciseModal({ visible, initial, onSave, onClose }: ExerciseModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sets, setSets] = useState(initial?.defaultSets ?? 3);
  const [repRange, setRepRange] = useState(initial?.repRange ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setSets(initial?.defaultSets ?? 3);
      setRepRange(initial?.repRange ?? '');
      setSaving(false);
    }
  }, [visible]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), sets, repRange.trim() || undefined);
      onClose();
    } catch {
      setSaving(false);
      Alert.alert('Error', 'Could not save exercise. Please try again.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{initial ? 'Edit Exercise' : 'Add Exercise'}</Text>

          <Text style={styles.modalLabel}>Exercise Name</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Barbell Row"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            maxLength={50}
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.modalLabel}>Rep Range <Text style={styles.modalLabelOptional}>(optional)</Text></Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. 8-12, 5x5, AMRAP"
            placeholderTextColor={colors.textSecondary}
            value={repRange}
            onChangeText={setRepRange}
            maxLength={20}
            returnKeyType="done"
          />

          <Text style={styles.modalLabel}>Default Sets</Text>
          <SetsStepper value={sets} onChange={setSets} />

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

// ─── Exercise row ─────────────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: {
  exercise: TemplateExercise;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.exerciseRow}>
      {/* Reorder arrows */}
      <View style={styles.reorderCol}>
        <TouchableOpacity
          style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
          onPress={onMoveUp}
          disabled={isFirst}
        >
          <Text style={[styles.arrowBtnText, isFirst && styles.arrowBtnTextDisabled]}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
          onPress={onMoveDown}
          disabled={isLast}
        >
          <Text style={[styles.arrowBtnText, isLast && styles.arrowBtnTextDisabled]}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Name + sets */}
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <View style={styles.exerciseMeta}>
          <Text style={styles.exerciseSets}>{exercise.defaultSets} sets</Text>
          {exercise.repRange ? (
            <View style={styles.repRangeBadge}>
              <Text style={styles.repRangeText}>{exercise.repRange}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
        <Text style={styles.actionBtnText}>✎</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete}>
        <Text style={styles.deleteBtnText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function TemplateDetailScreen({ route, navigation }: Props) {
  const { templateId, templateName } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateExercise | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToExercises(
      user.uid,
      templateId,
      ex => { setExercises(ex); setLoadingExercises(false); },
      (e: Error) => { setLoadingExercises(false); Alert.alert('Could not load exercises', e?.message ?? String(e)); }
    );
    return unsub;
  }, [user?.uid, templateId]);

  async function handleAddExercise(name: string, defaultSets: number, repRange?: string) {
    if (!user) return;
    await addExercise(user.uid, templateId, name, defaultSets, exercises.length, repRange);
  }

  async function handleUpdateExercise(exerciseId: string, name: string, defaultSets: number, repRange?: string) {
    if (!user) return;
    await updateExercise(user.uid, templateId, exerciseId, name, defaultSets, repRange);
  }

  function handleDeleteExercise(exercise: TemplateExercise) {
    confirmAction('Remove Exercise', `Remove "${exercise.name}"?`, async () => {
      if (!user) return;
      await deleteExercise(user.uid, templateId, exercise.id).catch(() =>
        Alert.alert('Error', 'Could not remove exercise.')
      );
    });
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    if (!user) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...exercises];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setExercises(reordered); // optimistic
    await reorderExercises(user.uid, templateId, reordered).catch(() => {
      setExercises(exercises); // revert on failure
    });
  }


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{templateName}</Text>
      </View>

      {loadingExercises ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={ex => ex.id}
          renderItem={({ item, index }) => (
            <ExerciseRow
              exercise={item}
              isFirst={index === 0}
              isLast={index === exercises.length - 1}
              onMoveUp={() => handleMove(index, 'up')}
              onMoveDown={() => handleMove(index, 'down')}
              onEdit={() => setEditTarget(item)}
              onDelete={() => handleDeleteExercise(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => navigation.push('ActiveSession', { templateId, templateName })}
            >
              <Text style={styles.startButtonText}>▶  Start Workout</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No exercises yet. Tap + to add one.</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Add modal */}
      <ExerciseModal
        visible={addModalVisible}
        onSave={handleAddExercise}
        onClose={() => setAddModalVisible(false)}
      />

      {/* Edit modal */}
      {editTarget && (
        <ExerciseModal
          visible={!!editTarget}
          initial={{ name: editTarget.name, defaultSets: editTarget.defaultSets, repRange: editTarget.repRange }}
          onSave={(name, sets, repRange) => handleUpdateExercise(editTarget.id, name, sets, repRange)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: colors.surface,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...bevel.raised,
  },
  backButton: { paddingRight: 4 },
  backButtonText: { fontFamily: fonts.display, fontSize: 20, color: colors.gold },
  headerTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 13, color: colors.gold },
  startButton: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.gold,
    ...bevel.raised,
  },
  startButtonText: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.background },

  listContent: { paddingTop: 4, paddingBottom: 100 },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  reorderCol: { marginRight: 8, gap: 2 },
  arrowBtn: {
    width: 28,
    height: 24,
    backgroundColor: colors.surfaceSunken,
    justifyContent: 'center',
    alignItems: 'center',
    ...bevel.inset,
  },
  arrowBtnDisabled: { opacity: 0.25 },
  arrowBtnText: { fontFamily: fonts.display, fontSize: 13, color: colors.textPrimary },
  arrowBtnTextDisabled: { color: colors.textMuted },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary },
  exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  exerciseSets: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },
  repRangeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: `${colors.gold}22`,
    borderWidth: 1,
    borderColor: `${colors.gold}66`,
  },
  repRangeText: { fontFamily: fonts.display, fontSize: 13, color: colors.gold },
  actionBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  actionBtnText: { fontSize: 16, color: colors.gold },
  deleteBtn: { backgroundColor: `${colors.destructive}44` },
  deleteBtnText: { fontSize: 16 },

  emptyState: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary },

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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { backgroundColor: colors.surface, padding: 20, ...bevel.raised },
  modalTitle: { fontFamily: fonts.heading, fontSize: 13, color: colors.gold, marginBottom: 12 },
  modalLabel: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  modalLabelOptional: { fontFamily: fonts.display, fontSize: 13, color: colors.textMuted },
  modalInput: {
    backgroundColor: colors.surfaceSunken,
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...bevel.inset,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.surfaceSunken,
    justifyContent: 'center',
    alignItems: 'center',
    ...bevel.inset,
  },
  stepperBtnText: { fontFamily: fonts.display, fontSize: 24, color: colors.gold, lineHeight: 28 },
  stepperValue: { flex: 1, alignItems: 'center' },
  stepperValueText: { fontFamily: fonts.heading, fontSize: 28, color: colors.textPrimary },
  stepperValueLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.textSecondary },

  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelButton: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.surfaceSunken, ...bevel.inset },
  cancelButtonText: { fontFamily: fonts.display, fontSize: 17, color: colors.textSecondary },
  saveButton: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.gold, ...bevel.raised },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.background },
});
