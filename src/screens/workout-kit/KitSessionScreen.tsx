/**
 * A live workout session in the new version: one card per exercise with weight × reps
 * per set (last session's numbers as hints), done exercises drop to the bottom, and
 * Finish saves the session. The session is saved on the phone as you go
 * (services/activeWorkout): Back, switching apps or closing the app leaves it running,
 * to resume from the banner, until you Finish or Discard it (owner request, 2026-11-20).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { WeightUnit } from '../../types';
import { activeWorkoutClock, clearActiveWorkout, DraftExercise, DraftSet, loadActiveWorkout, saveActiveWorkout } from '../../services/activeWorkout';
import {
  abandonWorkoutSession, completeWorkoutSession, createWorkoutSession, deleteSetLog, getExercises, getLastCompletedSessionSets, logSet, PrevSets,
} from '../../services/workoutService';
import { WorkoutStackParamList } from '../../navigation/WorkoutNavigator';
import {
  Body, ButtonRow, Choice, KitButton, KitField, KitModal, KitScreen, kitColors, kitFonts, Panel, Row, space, Tag, type,
} from '../../game-ui';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'ActiveSession'>;

type LocalSet = DraftSet;
type SessionExercise = DraftExercise;

// Keys must stay unique across restores, so they include the time as well as a counter.
let keySeq = 0;
const makeSet = (isDefault: boolean): LocalSet => ({ key: `set-${Date.now()}-${keySeq++}`, weight: '', reps: '', isDefault });

function ExerciseCard({ se, unit, prev, onChange, onAddSet, onRemoveSet, onComplete }: {
  se: SessionExercise; unit: WeightUnit; prev: { weight: number | null; reps: number | null }[];
  onChange: (setIndex: number, patch: Partial<LocalSet>) => void;
  onAddSet: () => void; onRemoveSet: (setIndex: number) => void; onComplete: () => void;
}) {
  const { exercise, sets } = se;
  return (
    <Panel title={exercise.name} right={exercise.repRange ? <Tag label={exercise.repRange} accessibilityLabel={`Reps ${exercise.repRange}`} /> : undefined}>
      {sets.map((s, i) => {
        const hintW = prev[i]?.weight != null ? String(prev[i].weight) : '';
        const hintR = prev[i]?.reps != null ? String(prev[i].reps) : '';
        const above = i > 0 ? sets[i - 1] : null;
        return (
          <View key={s.key} style={styles.setRow}>
            <Text style={styles.setNum}>{i + 1}</Text>
            <View style={styles.num}>
              <KitField
                value={s.weight} onChangeText={(v) => onChange(i, { weight: v })} keyboardType="decimal-pad"
                placeholder={hintW || unit} inputStyle={styles.numInput}
                accessibilityLabel={`Set ${i + 1} weight in ${unit}${hintW ? `, last time ${hintW}` : ''}`}
              />
            </View>
            <Text style={styles.times}>×</Text>
            <View style={styles.num}>
              <KitField
                value={s.reps} onChangeText={(v) => onChange(i, { reps: v })} keyboardType="number-pad"
                placeholder={hintR || 'reps'} inputStyle={styles.numInput}
                accessibilityLabel={`Set ${i + 1} reps${hintR ? `, last time ${hintR}` : ''}`}
              />
            </View>
            {above && (above.weight || above.reps) ? (
              <Pressable onPress={() => onChange(i, { weight: above.weight, reps: above.reps })} accessibilityRole="button" accessibilityLabel={`Copy set ${i} into set ${i + 1}`} hitSlop={6} style={styles.mini}>
                <Text style={styles.miniText}>⇣</Text>
              </Pressable>
            ) : <View style={styles.mini} />}
            {!s.isDefault ? (
              <Pressable onPress={() => onRemoveSet(i)} accessibilityRole="button" accessibilityLabel={`Remove set ${i + 1}`} hitSlop={6} style={styles.mini}>
                <Text style={[styles.miniText, { color: kitColors.red }]}>✕</Text>
              </Pressable>
            ) : <View style={styles.mini} />}
          </View>
        );
      })}
      <ButtonRow>
        <KitButton kind="secondary" label="Add set" onPress={onAddSet} />
        <KitButton label="Done" onPress={onComplete} />
      </ButtonRow>
    </Panel>
  );
}

export function KitSessionScreen({ route, navigation }: Props) {
  const { templateId, templateName, backdateDate } = route.params;
  const backdate = backdateDate ? new Date(backdateDate) : undefined;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<SessionExercise[]>([]);
  const [prev, setPrev] = useState<PrevSets>({});
  const [unit, setUnit] = useState<WeightUnit>('lbs');
  const [now, setNow] = useState(Date.now());
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const started = useRef(Date.now());
  const savedBackdate = useRef<string | undefined>(backdateDate);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const lastSets = getLastCompletedSessionSets(user.uid, templateId).catch(() => ({} as PrevSets));
        // Resume this workout's saved session if there is one; otherwise start a new one.
        const saved = await loadActiveWorkout(user.uid);
        if (saved && saved.templateId === templateId) {
          if (cancelled) return;
          started.current = saved.startedAt;
          savedBackdate.current = saved.backdateDate;
          setSessionId(saved.sessionId);
          setItems(saved.items);
          setUnit(saved.unit);
          setPrev(await lastSets);
          return;
        }
        const [exercises, sid, last] = await Promise.all([
          getExercises(user.uid, templateId),
          createWorkoutSession(user.uid, templateId, templateName, backdate),
          lastSets,
        ]);
        if (cancelled) return;
        started.current = Date.now();
        setSessionId(sid);
        setItems(exercises.map((exercise) => ({ exercise, completed: false, sets: Array.from({ length: exercise.defaultSets }, () => makeSet(true)) })));
        setPrev(last);
      } catch {
        if (!cancelled) Alert.alert('Couldn’t start the workout', 'Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Start once per open; `backdate` is derived from the route and stable for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, templateId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Save after every change, so nothing typed is lost if the app goes away.
  useEffect(() => {
    if (!user || !sessionId || loading) return;
    saveActiveWorkout(user.uid, {
      sessionId, templateId, templateName, backdateDate: savedBackdate.current, startedAt: started.current, unit, items,
    });
  }, [user, sessionId, loading, templateId, templateName, unit, items]);

  const patchSet = useCallback((ei: number, si: number, patch: Partial<LocalSet>) => {
    setItems((p) => p.map((se, i) => (i !== ei ? se : { ...se, sets: se.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) })));
  }, []);

  async function removeSet(ei: number, si: number) {
    const s = items[ei].sets[si];
    if (user && sessionId && s.setLogId) await deleteSetLog(user.uid, sessionId, s.setLogId).catch(() => {});
    setItems((p) => p.map((se, i) => (i !== ei ? se : { ...se, sets: se.sets.filter((_, j) => j !== si) })));
  }

  async function complete(ei: number) {
    if (!user || !sessionId) return;
    const se = items[ei];
    try {
      const ids = await Promise.all(se.sets.map((s, i) =>
        logSet(user.uid, sessionId, se.exercise.id, se.exercise.name, i + 1, s.reps ? parseInt(s.reps, 10) : null, s.weight ? parseFloat(s.weight) : null, unit, savedBackdate.current ? new Date(savedBackdate.current) : undefined)));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems((p) => {
        const next = [...p];
        const [done] = next.splice(ei, 1);
        next.push({ ...done, completed: true, sets: done.sets.map((s, i) => ({ ...s, setLogId: ids[i] })) });
        return next;
      });
    } catch {
      Alert.alert('Couldn’t save that exercise', 'Please try again.');
    }
  }

  async function undo(ei: number) {
    if (!user || !sessionId) return;
    const se = items[ei];
    await Promise.all(se.sets.filter((s) => s.setLogId).map((s) => deleteSetLog(user.uid, sessionId, s.setLogId!).catch(() => {})));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((p) => {
      const next = [...p];
      const [back] = next.splice(ei, 1);
      const firstDone = next.findIndex((e) => e.completed);
      next.splice(firstDone === -1 ? next.length : firstDone, 0, { ...back, completed: false, sets: back.sets.map((s) => ({ ...s, setLogId: undefined })) });
      return next;
    });
  }

  const doneCount = items.filter((e) => e.completed).length;
  const doneSets = items.filter((e) => e.completed).reduce((n, e) => n + e.sets.length, 0);

  async function finish() {
    if (!user || !sessionId) return;
    try {
      setFinishing(true);
      await completeWorkoutSession(user.uid, sessionId, savedBackdate.current ? new Date(savedBackdate.current) : undefined);
      await clearActiveWorkout(user.uid);
      // Land on this workout's page to see the new session in its history. A reset, not
      // popToTop: resumed from Today after a restart, this screen can be the stack's only one.
      navigation.reset({ index: 1, routes: [{ name: 'WorkoutTemplates' }, { name: 'WorkoutMetrics', params: { templateId, templateName } }] });
    } catch {
      setFinishing(false);
      Alert.alert('Couldn’t save the session', 'Please try again.');
    }
  }

  async function discard() {
    setConfirmDiscard(false);
    if (user && sessionId) {
      await abandonWorkoutSession(user.uid, sessionId).catch(() => {});
      await clearActiveWorkout(user.uid);
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'WorkoutTemplates' }] });
  }

  const logDay = savedBackdate.current ? new Date(savedBackdate.current) : undefined;
  const clock = activeWorkoutClock({ startedAt: started.current, backdateDate: savedBackdate.current }, now);

  if (loading) {
    return <KitScreen title={templateName}><ActivityIndicator color={kitColors.gold} /></KitScreen>;
  }

  return (
    <KitScreen
      title={templateName}
      // Back leaves the session running; it's saved and resumes from the banner.
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'WorkoutTemplates' }] }))}
      footer={(
        <View style={styles.footer}>
          <Tag label={clock} tone="gold" accessibilityLabel={logDay ? `Logging for ${logDay.toDateString()}` : `${clock} elapsed`} />
          {/* Directly in the row: KitButton's flex fills the width. Wrapped in a column it collapsed to no height. */}
          {doneSets > 0 && <Tag label={`${doneSets} sets`} tone="green" accessibilityLabel={`${doneSets} sets logged`} />}
          {/* No numbers inside the button: Pixelify's small digits misread (PROD-025 note). */}
          <KitButton label={finishing ? 'Saving…' : 'Finish'} onPress={finish} disabled={finishing || doneCount === 0} />
        </View>
      )}
    >
      <Choice options={[{ label: 'lbs', value: 'lbs' as WeightUnit }, { label: 'kg', value: 'kg' as WeightUnit }]} value={unit} onChange={setUnit} />
      {items.length === 0 && (
        <Panel title="No exercises">
          <Body muted>Add exercises to this workout first.</Body>
          <ButtonRow><KitButton kind="secondary" label="Go back" onPress={discard} /></ButtonRow>
        </Panel>
      )}
      {items.map((se, i) => (se.completed ? (
        <Row
          key={se.exercise.id}
          left={<Text style={styles.check}>✓</Text>}
          title={se.exercise.name}
          detail={<Tag label={`${se.sets.length} sets`} tone="green" />}
          right={<KitButton compact kind="secondary" label="Undo" accessibilityLabel={`Undo ${se.exercise.name}`} onPress={() => undo(i)} />}
        />
      ) : (
        <ExerciseCard
          key={se.exercise.id}
          se={se}
          unit={unit}
          prev={prev[se.exercise.name] ?? []}
          onChange={(si, p) => patchSet(i, si, p)}
          onAddSet={() => setItems((p) => p.map((e, j) => (j !== i ? e : { ...e, sets: [...e.sets, makeSet(false)] })))}
          onRemoveSet={(si) => removeSet(i, si)}
          onComplete={() => complete(i)}
        />
      )))}

      {items.length > 0 && <ButtonRow><KitButton kind="secondary" label="Discard workout" onPress={() => setConfirmDiscard(true)} /></ButtonRow>}

      <KitModal visible={confirmDiscard} title="Discard this workout?" onClose={() => setConfirmDiscard(false)}>
        <Body>{doneCount ? `${doneCount} finished exercise${doneCount === 1 ? '' : 's'} and everything typed will be thrown away.` : 'Everything typed will be thrown away.'}</Body>
        <ButtonRow>
          <KitButton kind="secondary" label="Keep going" onPress={() => setConfirmDiscard(false)} />
          <KitButton label="Discard" onPress={discard} />
        </ButtonRow>
      </KitModal>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  setNum: { fontFamily: kitFonts.text, fontSize: 22, color: kitColors.textMuted, width: 20, textAlign: 'center' },
  num: { flex: 1 },
  numInput: { textAlign: 'center' },
  times: { ...type.body, color: kitColors.textMuted },
  mini: { width: 26, alignItems: 'center' },
  miniText: { fontFamily: kitFonts.text, fontSize: 26, color: kitColors.gold },
  check: { fontFamily: kitFonts.text, fontSize: 30, color: kitColors.green },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
