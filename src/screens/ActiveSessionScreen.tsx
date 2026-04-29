import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
} from '../services/workoutService';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'ActiveSession'>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalSet {
  key: string;
  weight: string;
  reps: string;
  logged: boolean;
  setLogId?: string;
}

interface SessionExercise {
  exercise: TemplateExercise;
  sets: LocalSet[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSet(index: number): LocalSet {
  return { key: `s-${index}-${Date.now()}`, weight: '', reps: '', logged: false };
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
  isOnly,
  onWeightChange,
  onRepsChange,
  onToggle,
  onRemove,
}: {
  set: LocalSet;
  setNumber: number;
  unit: WeightUnit;
  isOnly: boolean;
  onWeightChange: (v: string) => void;
  onRepsChange: (v: string) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.setRow, set.logged && styles.setRowLogged]}>
      <Text style={[styles.setNumber, set.logged && styles.setNumberLogged]}>{setNumber}</Text>

      <TextInput
        style={[styles.numInput, styles.weightInput, set.logged && styles.numInputLogged]}
        value={set.weight}
        onChangeText={onWeightChange}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        returnKeyType="next"
        editable={!set.logged}
        selectTextOnFocus
      />
      <Text style={styles.unitLabel}>{unit}</Text>

      <Text style={styles.timesLabel}>×</Text>

      <TextInput
        style={[styles.numInput, styles.repsInput, set.logged && styles.numInputLogged]}
        value={set.reps}
        onChangeText={onRepsChange}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        returnKeyType="done"
        editable={!set.logged}
        selectTextOnFocus
      />
      <Text style={styles.repsLabel}>reps</Text>

      <TouchableOpacity
        style={[styles.logBtn, set.logged && styles.logBtnLogged]}
        onPress={onToggle}
      >
        <Text style={[styles.logBtnText, set.logged && styles.logBtnTextLogged]}>✓</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.removeBtn, isOnly && styles.removeBtnDisabled]}
        onPress={onRemove}
        disabled={isOnly}
      >
        <Text style={styles.removeBtnText}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  sessionExercise,
  unit,
  onWeightChange,
  onRepsChange,
  onToggleSet,
  onAddSet,
  onRemoveSet,
}: {
  sessionExercise: SessionExercise;
  unit: WeightUnit;
  onWeightChange: (setIndex: number, v: string) => void;
  onRepsChange: (setIndex: number, v: string) => void;
  onToggleSet: (setIndex: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
}) {
  const { exercise, sets } = sessionExercise;
  const loggedCount = sets.filter(s => s.logged).length;

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseCardHeader}>
        <Text style={styles.exerciseCardName}>{exercise.name}</Text>
        <View style={styles.exerciseCardBadges}>
          {exercise.repRange ? (
            <View style={styles.repRangeBadge}>
              <Text style={styles.repRangeText}>{exercise.repRange}</Text>
            </View>
          ) : null}
          <View style={[styles.progressBadge, loggedCount === sets.length && loggedCount > 0 && styles.progressBadgeDone]}>
            <Text style={styles.progressBadgeText}>{loggedCount}/{sets.length}</Text>
          </View>
        </View>
      </View>

      {sets.map((set, i) => (
        <SetRow
          key={set.key}
          set={set}
          setNumber={i + 1}
          unit={unit}
          isOnly={sets.length === 1}
          onWeightChange={v => onWeightChange(i, v)}
          onRepsChange={v => onRepsChange(i, v)}
          onToggle={() => onToggleSet(i)}
          onRemove={() => onRemoveSet(i)}
        />
      ))}

      <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet}>
        <Text style={styles.addSetBtnText}>+ Add Set</Text>
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

  const startTimeRef = useRef(Date.now());

  // ── Init: create session + load exercises ─────────────────────────────────

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function init() {
      try {
        const [exercises, sid] = await Promise.all([
          getExercises(user!.uid, templateId),
          createWorkoutSession(user!.uid, templateId, templateName),
        ]);
        if (cancelled) return;
        setSessionId(sid);
        setSessionExercises(
          exercises.map(ex => ({
            exercise: ex,
            sets: Array.from({ length: ex.defaultSets }, (_, i) => makeSet(i)),
          }))
        );
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

  async function handleToggleSet(exIndex: number, setIndex: number) {
    if (!user || !sessionId) return;
    const se = sessionExercises[exIndex];
    const set = se.sets[setIndex];

    if (set.logged) {
      // Unlog — delete from Firestore
      updateSet(exIndex, setIndex, { logged: false, setLogId: undefined });
      if (set.setLogId) {
        await deleteSetLog(user.uid, sessionId, set.setLogId).catch(() => {
          updateSet(exIndex, setIndex, { logged: true, setLogId: set.setLogId }); // revert
        });
      }
    } else {
      // Log — save to Firestore
      const weight = set.weight ? parseFloat(set.weight) : null;
      const reps = set.reps ? parseInt(set.reps, 10) : null;
      updateSet(exIndex, setIndex, { logged: true }); // optimistic
      try {
        const id = await logSet(
          user.uid, sessionId,
          se.exercise.id, se.exercise.name,
          setIndex + 1, reps, weight, unit
        );
        updateSet(exIndex, setIndex, { setLogId: id });
      } catch {
        updateSet(exIndex, setIndex, { logged: false }); // revert
        Alert.alert('Error', 'Could not save set.');
      }
    }
  }

  function handleAddSet(exIndex: number) {
    setSessionExercises(prev =>
      prev.map((se, ei) =>
        ei !== exIndex ? se : { ...se, sets: [...se.sets, makeSet(se.sets.length)] }
      )
    );
  }

  async function handleRemoveSet(exIndex: number, setIndex: number) {
    if (!user || !sessionId) return;
    const set = sessionExercises[exIndex].sets[setIndex];
    // If logged, delete from Firestore first
    if (set.logged && set.setLogId) {
      await deleteSetLog(user.uid, sessionId, set.setLogId).catch(() => {});
    }
    setSessionExercises(prev =>
      prev.map((se, ei) =>
        ei !== exIndex ? se : { ...se, sets: se.sets.filter((_, si) => si !== setIndex) }
      )
    );
  }

  // ── Finish / abandon ──────────────────────────────────────────────────────

  const totalLogged = sessionExercises.reduce((acc, se) => acc + se.sets.filter(s => s.logged).length, 0);

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

    if (totalLogged === 0) {
      doAbandon();
    } else {
      confirmAction(
        'Abandon Workout',
        `You have ${totalLogged} logged set${totalLogged !== 1 ? 's' : ''}. Abandon and discard them?`,
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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.abandonBtn} onPress={handleAbandon}>
          <Text style={styles.abandonBtnText}>✕ End</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{templateName}</Text>
          <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
        </View>

        {/* kg / lbs toggle */}
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
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <ExerciseCard
            sessionExercise={item}
            unit={unit}
            onWeightChange={(si, v) => handleWeightChange(index, si, v)}
            onRepsChange={(si, v) => handleRepsChange(index, si, v)}
            onToggleSet={si => handleToggleSet(index, si)}
            onAddSet={() => handleAddSet(index)}
            onRemoveSet={si => handleRemoveSet(index, si)}
          />
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.finishBtn, (finishing || totalLogged === 0) && styles.finishBtnDisabled]}
          onPress={handleFinish}
          disabled={finishing || totalLogged === 0}
        >
          {finishing
            ? <ActivityIndicator color={colors.background} />
            : <Text style={styles.finishBtnText}>
                Finish Workout {totalLogged > 0 ? `· ${totalLogged} set${totalLogged !== 1 ? 's' : ''}` : ''}
              </Text>
          }
        </TouchableOpacity>
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
    paddingHorizontal: 14,
    paddingBottom: 12,
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
  timerText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary, marginTop: 2 },
  unitToggle: { flexDirection: 'row', ...bevel.inset, overflow: 'hidden' },
  unitBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceSunken },
  unitBtnActive: { backgroundColor: colors.gold },
  unitBtnText: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },
  unitBtnTextActive: { color: colors.background, fontWeight: '700' },

  // List
  listContent: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 20 },

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
  exerciseCardName: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary, flex: 1, marginRight: 8 },
  exerciseCardBadges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  repRangeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: `${colors.gold}22`,
    borderWidth: 1,
    borderColor: `${colors.gold}66`,
  },
  repRangeText: { fontFamily: fonts.display, fontSize: 13, color: colors.gold },
  progressBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBadgeDone: { backgroundColor: `${colors.success}55`, borderColor: colors.success },
  progressBadgeText: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary },

  // Set row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
    gap: 6,
  },
  setRowLogged: { backgroundColor: `${colors.success}33` },
  setNumber: { fontFamily: fonts.display, fontSize: 16, color: colors.textMuted, width: 20, textAlign: 'center' },
  setNumberLogged: { color: colors.successText },
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
  numInputLogged: { color: colors.textSecondary },
  weightInput: { width: 70 },
  repsInput: { width: 52 },
  unitLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.textSecondary, width: 26 },
  timesLabel: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary },
  repsLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.textSecondary, flex: 1 },
  logBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  logBtnLogged: { backgroundColor: colors.success, ...bevel.raised },
  logBtnText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary },
  logBtnTextLogged: { color: colors.successText, fontWeight: '900' },
  removeBtn: {
    width: 30,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${colors.destructive}44`,
    ...bevel.inset,
  },
  removeBtnDisabled: { opacity: 0.2 },
  removeBtnText: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary, lineHeight: 22 },

  addSetBtn: {
    marginTop: 6,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  addSetBtnText: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },

  // Footer
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  finishBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.gold,
    ...bevel.raised,
  },
  finishBtnDisabled: { opacity: 0.4 },
  finishBtnText: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.background },
});
