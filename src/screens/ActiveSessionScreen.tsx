import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutStackParamList } from '../navigation/WorkoutNavigator';
import { useAuth } from '../context/AuthContext';
import { TemplateExercise, WeightUnit } from '../types';
import {
  getExercises,
  createWorkoutSession,
  completeWorkoutSession,
  abandonWorkoutSession,
  logSet,
  deleteSetLog,
  getLastCompletedSessionSets,
  PrevSets,
} from '../services/workoutService';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<WorkoutStackParamList, 'ActiveSession'>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalSet {
  key: string;
  weight: string;
  reps: string;
  isDefault: boolean;
  setLogId?: string;
}

interface SessionExercise {
  exercise: TemplateExercise;
  sets: LocalSet[];
  completed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSet(index: number, isDefault: boolean): LocalSet {
  return { key: `s-${index}-${Date.now()}`, weight: '', reps: '', isDefault };
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  }
}

// ─── Set row ──────────────────────────────────────────────────────────────────

function SetRow({
  set,
  setNumber,
  unit,
  prevWeight,
  prevReps,
  onWeightChange,
  onRepsChange,
  onRemove,
}: {
  set: LocalSet;
  setNumber: number;
  unit: WeightUnit;
  prevWeight: string;
  prevReps: string;
  onWeightChange: (v: string) => void;
  onRepsChange: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setNumber}>{setNumber}</Text>

      <View style={styles.setCenter}>
        <TextInput
          style={[styles.numInput, styles.weightInput]}
          value={set.weight}
          onChangeText={onWeightChange}
          placeholder={prevWeight || '0'}
          placeholderTextColor={prevWeight ? `${colors.gold}bb` : colors.textMuted}
          keyboardType="decimal-pad"
          returnKeyType="next"
          selectTextOnFocus
        />
        <Text style={styles.unitLabel}>{unit}</Text>
        <Text style={styles.timesLabel}>×</Text>
        <TextInput
          style={[styles.numInput, styles.repsInput]}
          value={set.reps}
          onChangeText={onRepsChange}
          placeholder={prevReps || '0'}
          placeholderTextColor={prevReps ? `${colors.gold}bb` : colors.textMuted}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
        />
        <Text style={styles.repsLabel}>reps</Text>
      </View>

      {set.isDefault ? (
        <View style={styles.removeBtnSpacer} />
      ) : (
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
          <Text style={styles.removeBtnText}>−</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Completed exercise row (compact) ─────────────────────────────────────────

function CompletedCard({
  sessionExercise,
  onUndo,
}: {
  sessionExercise: SessionExercise;
  onUndo: () => void;
}) {
  const { exercise, sets } = sessionExercise;
  return (
    <View style={styles.completedCard}>
      <Text style={styles.completedCheck}>✓</Text>
      <Text style={styles.completedName} numberOfLines={1}>{exercise.name}</Text>
      <Text style={styles.completedMeta}>{sets.length} set{sets.length !== 1 ? 's' : ''}</Text>
      <TouchableOpacity style={styles.undoBtn} onPress={onUndo}>
        <Text style={styles.undoBtnText}>Undo</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  sessionExercise,
  unit,
  prevSets,
  onWeightChange,
  onRepsChange,
  onAddSet,
  onRemoveSet,
  onComplete,
  onFocus,
}: {
  sessionExercise: SessionExercise;
  unit: WeightUnit;
  prevSets: Array<{ weight: number | null; reps: number | null }>;
  onWeightChange: (setIndex: number, v: string) => void;
  onRepsChange: (setIndex: number, v: string) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onComplete: () => void;
  onFocus: () => void;
}) {
  const { exercise, sets } = sessionExercise;

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseCardHeader}>
        <TouchableOpacity style={styles.exerciseNameBtn} onPress={onFocus} activeOpacity={0.7}>
          <Text style={styles.exerciseCardName}>{exercise.name}</Text>
        </TouchableOpacity>
        <View style={styles.exerciseCardBadges}>
          {exercise.repRange ? (
            <View style={styles.repRangeBadge}>
              <Text style={styles.repRangeText}>{exercise.repRange}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.addSetBtnSmall} onPress={onAddSet}>
            <Text style={styles.addSetBtnSmallText}>+ Set</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sets.map((set, i) => (
        <SetRow
          key={set.key}
          set={set}
          setNumber={i + 1}
          unit={unit}
          prevWeight={prevSets[i]?.weight != null ? String(prevSets[i].weight) : ''}
          prevReps={prevSets[i]?.reps != null ? String(prevSets[i].reps) : ''}
          onWeightChange={v => onWeightChange(i, v)}
          onRepsChange={v => onRepsChange(i, v)}
          onRemove={() => onRemoveSet(i)}
        />
      ))}

      <TouchableOpacity style={styles.completeExerciseBtn} onPress={onComplete}>
        <Text style={styles.completeExerciseBtnText}>Complete Exercise</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function ActiveSessionScreen({ route, navigation }: Props) {
  const { templateId, templateName } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [unit, setUnit] = useState<WeightUnit>('lbs');
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [prevSets, setPrevSets] = useState<PrevSets>({});

  const startTimeRef = useRef(Date.now());

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function init() {
      try {
        const [exercises, sid, prev] = await Promise.all([
          getExercises(user!.uid, templateId),
          createWorkoutSession(user!.uid, templateId, templateName),
          getLastCompletedSessionSets(user!.uid, templateId).catch(() => ({} as PrevSets)),
        ]);
        if (cancelled) return;
        setSessionId(sid);
        setSessionExercises(
          exercises.map(ex => ({
            exercise: ex,
            sets: Array.from({ length: ex.defaultSets }, (_, i) => makeSet(i, true)),
            completed: false,
          }))
        );
        setPrevSets(prev);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Set state helpers ────────────────────────────────────────────────────

  const updateSet = useCallback((exIndex: number, setIndex: number, patch: Partial<LocalSet>) => {
    setSessionExercises(prev =>
      prev.map((se, ei) =>
        ei !== exIndex ? se : {
          ...se,
          sets: se.sets.map((s, si) => si !== setIndex ? s : { ...s, ...patch }),
        }
      )
    );
  }, []);

  function handleWeightChange(exIndex: number, setIndex: number, v: string) {
    updateSet(exIndex, setIndex, { weight: v });
  }

  function handleRepsChange(exIndex: number, setIndex: number, v: string) {
    updateSet(exIndex, setIndex, { reps: v });
  }

  function handleAddSet(exIndex: number) {
    setSessionExercises(prev =>
      prev.map((se, ei) =>
        ei !== exIndex ? se : { ...se, sets: [...se.sets, makeSet(se.sets.length, false)] }
      )
    );
  }

  async function handleRemoveSet(exIndex: number, setIndex: number) {
    if (!user || !sessionId) return;
    const set = sessionExercises[exIndex].sets[setIndex];
    if (set.setLogId) {
      await deleteSetLog(user.uid, sessionId, set.setLogId).catch(() => {});
    }
    setSessionExercises(prev =>
      prev.map((se, ei) =>
        ei !== exIndex ? se : { ...se, sets: se.sets.filter((_, si) => si !== setIndex) }
      )
    );
  }

  // ── Complete / Undo exercise ───────────────────────────────────────────────

  async function handleCompleteExercise(exIndex: number) {
    if (!user || !sessionId) return;
    const se = sessionExercises[exIndex];

    try {
      const results = await Promise.all(
        se.sets.map((set, i) => {
          const weight = set.weight ? parseFloat(set.weight) : null;
          const reps = set.reps ? parseInt(set.reps, 10) : null;
          return logSet(user.uid, sessionId, se.exercise.id, se.exercise.name, i + 1, reps, weight, unit)
            .then(id => ({ index: i, id }));
        })
      );

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSessionExercises(prev => {
        const next = [...prev];
        const updated: SessionExercise = {
          ...next[exIndex],
          completed: true,
          sets: next[exIndex].sets.map((s, i) => {
            const r = results.find(x => x.index === i);
            return r ? { ...s, setLogId: r.id } : s;
          }),
        };
        next.splice(exIndex, 1);
        next.push(updated);
        return next;
      });
    } catch {
      Alert.alert('Error', 'Could not save exercise. Please try again.');
    }
  }

  async function handleUndoExercise(exIndex: number) {
    if (!user || !sessionId) return;
    const se = sessionExercises[exIndex];

    await Promise.all(
      se.sets
        .filter(s => s.setLogId)
        .map(s => deleteSetLog(user.uid, sessionId, s.setLogId!).catch(() => {}))
    );

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSessionExercises(prev => {
      const next = [...prev];
      const restored: SessionExercise = {
        ...next[exIndex],
        completed: false,
        sets: next[exIndex].sets.map(s => ({ ...s, setLogId: undefined })),
      };
      next.splice(exIndex, 1);
      const firstCompleted = next.findIndex(e => e.completed);
      if (firstCompleted === -1) next.push(restored);
      else next.splice(firstCompleted, 0, restored);
      return next;
    });
  }

  // ── Focus exercise (bring to top) ─────────────────────────────────────────

  function handleFocus(exIndex: number) {
    if (exIndex === 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSessionExercises(prev => {
      const next = [...prev];
      const [item] = next.splice(exIndex, 1);
      next.unshift(item);
      return next;
    });
  }

  // ── Finish / abandon ──────────────────────────────────────────────────────

  const completedCount = sessionExercises.filter(se => se.completed).length;
  const totalLoggedSets = sessionExercises
    .filter(se => se.completed)
    .reduce((acc, se) => acc + se.sets.length, 0);

  async function handleFinish() {
    if (!user || !sessionId) return;
    setFinishing(true);
    try {
      await completeWorkoutSession(user.uid, sessionId);
      navigation.popToTop();
    } catch {
      setFinishing(false);
      Alert.alert('Error', 'Could not save session. Please try again.');
    }
  }

  function handleAbandon() {
    if (!user || !sessionId) { navigation.goBack(); return; }

    const doAbandon = async () => {
      await abandonWorkoutSession(user.uid, sessionId).catch(() => {});
      navigation.goBack();
    };

    if (completedCount === 0) {
      doAbandon();
    } else {
      confirmAction(
        'Abandon Workout',
        `You have ${completedCount} completed exercise${completedCount !== 1 ? 's' : ''}. Abandon and discard them?`,
        'Abandon',
        doAbandon
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text style={styles.loadingText}>Starting workout…</Text>
      </View>
    );
  }

  if (sessionExercises.length === 0) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>This template has no exercises.</Text>
        <TouchableOpacity style={styles.backBtnStandalone} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnStandaloneText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={styles.abandonBtn} onPress={handleAbandon}>
          <Text style={styles.abandonBtnText}>✕ End</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{templateName}</Text>
        </View>

        <View style={styles.unitToggle}>
          {(['lbs', 'kg'] as WeightUnit[]).map(u => (
            <TouchableOpacity
              key={u}
              style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
              onPress={() => setUnit(u)}
            >
              <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Exercise list */}
      <FlatList
        data={sessionExercises}
        keyExtractor={item => item.exercise.id}
        renderItem={({ item, index }) =>
          item.completed ? (
            <CompletedCard
              sessionExercise={item}
              onUndo={() => handleUndoExercise(index)}
            />
          ) : (
            <ExerciseCard
              sessionExercise={item}
              unit={unit}
              prevSets={prevSets[item.exercise.name] ?? []}
              onWeightChange={(si, v) => handleWeightChange(index, si, v)}
              onRepsChange={(si, v) => handleRepsChange(index, si, v)}
              onAddSet={() => handleAddSet(index)}
              onRemoveSet={si => handleRemoveSet(index, si)}
              onComplete={() => handleCompleteExercise(index)}
              onFocus={() => handleFocus(index)}
            />
          )
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerRow}>
          <View style={styles.timerChip}>
            <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.finishBtn, (finishing || completedCount === 0) && styles.finishBtnDisabled]}
            onPress={handleFinish}
            disabled={finishing || completedCount === 0}
          >
            {finishing
              ? <ActivityIndicator color={colors.background} />
              : <Text style={styles.finishBtnText}>
                  Finish Workout
                  {completedCount > 0 ? ` · ${completedCount} ex, ${totalLoggedSets} sets` : ''}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary, marginTop: 12 },
  emptyText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary, marginBottom: 20 },
  backBtnStandalone: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.surface, ...bevel.raised },
  backBtnStandaloneText: { fontFamily: fonts.display, fontSize: 18, color: colors.gold },

  // Header
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...bevel.raised,
  },
  abandonBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${colors.destructive}55`,
    ...bevel.raised,
    borderTopColor: `${colors.destructive}99`,
    borderLeftColor: `${colors.destructive}99`,
  },
  abandonBtnText: { fontFamily: fonts.display, fontSize: 15, color: colors.textPrimary },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: fonts.heading, fontSize: 11, color: colors.gold },
  unitToggle: { flexDirection: 'row', ...bevel.inset, overflow: 'hidden' },
  unitBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceSunken },
  unitBtnActive: { backgroundColor: colors.gold },
  unitBtnText: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },
  unitBtnTextActive: { color: colors.background, fontWeight: '700' },

  // List
  listContent: { paddingTop: 6, paddingHorizontal: 12, paddingBottom: 20 },

  // Exercise card
  exerciseCard: {
    backgroundColor: colors.surface,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...bevel.raised,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  exerciseNameBtn: { flex: 1, marginRight: 8 },
  exerciseCardName: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary },
  exerciseCardBadges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  repRangeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: `${colors.gold}22`,
    borderWidth: 1,
    borderColor: `${colors.gold}66`,
  },
  repRangeText: { fontFamily: fonts.display, fontSize: 13, color: colors.gold },

  // Compact "+ Set" in header
  addSetBtnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  addSetBtnSmallText: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary },

  // Complete exercise button — mirrors the "Done" activity badge style
  completeExerciseBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.success,
    ...bevel.green,
  },
  completeExerciseBtnText: { fontFamily: fonts.display, fontSize: 16, color: colors.successText },

  // Completed compact card
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.success}22`,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: `${colors.success}55`,
    gap: 8,
  },
  completedCheck: { fontFamily: fonts.display, fontSize: 16, color: colors.successText ?? colors.gold },
  completedName: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary, flex: 1 },
  completedMeta: { fontFamily: fonts.display, fontSize: 13, color: colors.textMuted },
  undoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  undoBtnText: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary },

  // Set row — flat with subtle separator; no inset bevel on the row itself
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 6,
  },
  setNumber: { fontFamily: fonts.display, fontSize: 15, color: colors.textMuted, width: 22, textAlign: 'center' },
  setCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  numInput: {
    backgroundColor: colors.background,
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    ...bevel.inset,
  },
  weightInput: { width: 68 },
  repsInput: { width: 52 },
  unitLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.textSecondary, width: 26 },
  timesLabel: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary },
  repsLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.textSecondary },
  removeBtn: {
    width: 28,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${colors.destructive}44`,
    ...bevel.inset,
  },
  removeBtnText: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary, lineHeight: 22 },
  removeBtnSpacer: { width: 28 },

  // Footer
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  footerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  timerChip: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  timerText: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },
  finishBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.gold,
    ...bevel.raised,
  },
  finishBtnDisabled: { opacity: 0.4 },
  finishBtnText: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.background },
});
