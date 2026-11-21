/**
 * A workout's exercises in the new version: add, edit, reorder and remove them. Each
 * has a default number of sets and an optional rep range ("8-12", "5x5", "AMRAP").
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useWorkout } from '../../context/WorkoutContext';
import { TemplateExercise } from '../../types';
import { addExercise, deleteExercise, reorderExercises, subscribeToExercises, updateExercise } from '../../services/workoutService';
import { WorkoutStackParamList } from '../../navigation/WorkoutNavigator';
import {
  Body, ButtonRow, KitButton, KitField, KitModal, KitScreen, kitColors, Panel, Row, space, Tag, type,
} from '../../game-ui';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'TemplateDetail'>;

type Draft = { id?: string; name: string; sets: number; repRange: string };

export function KitExercisesScreen({ route, navigation }: Props) {
  const { templateId } = route.params;
  const { user } = useAuth();
  const { templates } = useWorkout();
  const name = templates.find((t) => t.id === templateId)?.name ?? route.params.templateName;
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToExercises(
      user.uid, templateId,
      (ex) => { setExercises(ex); setLoading(false); },
      () => { setLoading(false); Alert.alert('Couldn’t load the exercises', 'Please try again.'); },
    );
  }, [user, templateId]);

  async function save() {
    if (!user || !draft || !draft.name.trim()) return;
    try {
      setBusy(true);
      const repRange = draft.repRange.trim() || undefined;
      if (draft.id) await updateExercise(user.uid, templateId, draft.id, draft.name.trim(), draft.sets, repRange);
      else await addExercise(user.uid, templateId, draft.name.trim(), draft.sets, exercises.length, repRange);
      setDraft(null);
    } catch {
      Alert.alert('Couldn’t save the exercise', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!user || !draft?.id) return;
    try {
      setBusy(true);
      await deleteExercise(user.uid, templateId, draft.id);
      setConfirmRemove(false);
      setDraft(null);
    } catch {
      Alert.alert('Couldn’t remove the exercise', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, by: -1 | 1) {
    if (!user) return;
    const before = exercises;
    const next = [...exercises];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setExercises(next); // optimistic; put it back if the save fails
    await reorderExercises(user.uid, templateId, next).catch(() => setExercises(before));
  }

  return (
    <KitScreen title={name} onBack={() => navigation.goBack()}>
      <Panel title="Exercises" right={exercises.length ? <Tag label={String(exercises.length)} accessibilityLabel={`${exercises.length} exercises`} /> : undefined}>
        {loading && <ActivityIndicator color={kitColors.gold} />}
        {!loading && exercises.length === 0 && <Body muted>Add the exercises this workout uses, in the order you do them.</Body>}
        {exercises.map((ex, i) => (
          <Row
            key={ex.id}
            left={(
              <View style={styles.order}>
                <KitButton compact kind="secondary" label="▲" accessibilityLabel={`Move ${ex.name} up`} disabled={i === 0} onPress={() => move(i, -1)} />
                <KitButton compact kind="secondary" label="▼" accessibilityLabel={`Move ${ex.name} down`} disabled={i === exercises.length - 1} onPress={() => move(i, 1)} />
              </View>
            )}
            title={ex.name}
            detail={(
              <>
                <Tag label={`${ex.defaultSets} sets`} tone="gold" />
                {!!ex.repRange && <Tag label={ex.repRange} accessibilityLabel={`Reps ${ex.repRange}`} />}
              </>
            )}
            onPress={() => setDraft({ id: ex.id, name: ex.name, sets: ex.defaultSets, repRange: ex.repRange ?? '' })}
            accessibilityLabel={`Edit ${ex.name}`}
          />
        ))}
      </Panel>
      <ButtonRow><KitButton label="Add exercise" onPress={() => setDraft({ name: '', sets: 3, repRange: '' })} /></ButtonRow>

      <KitModal visible={!!draft && !confirmRemove} title={draft?.id ? 'Edit exercise' : 'Add exercise'} onClose={() => setDraft(null)}>
        {draft && (
          <>
            <KitField placeholder="Name, e.g. Barbell row" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} maxLength={50} autoFocus={!draft.id} autoCapitalize="words" />
            <KitField placeholder="Reps (optional), e.g. 8-12" value={draft.repRange} onChangeText={(t) => setDraft({ ...draft, repRange: t })} maxLength={20} />
            <View style={styles.stepper}>
              <KitButton compact kind="secondary" label="−" accessibilityLabel="One set fewer" disabled={draft.sets <= 1} onPress={() => setDraft({ ...draft, sets: draft.sets - 1 })} />
              <Text style={[type.readout, styles.sets]} accessibilityLabel={`${draft.sets} sets`}>{draft.sets}</Text>
              <KitButton compact kind="secondary" label="+" accessibilityLabel="One set more" disabled={draft.sets >= 20} onPress={() => setDraft({ ...draft, sets: draft.sets + 1 })} />
              <Text style={type.body}>sets</Text>
            </View>
            <ButtonRow>
              <KitButton kind="secondary" label="Cancel" onPress={() => setDraft(null)} disabled={busy} />
              <KitButton label="Save" onPress={save} disabled={busy || !draft.name.trim()} />
            </ButtonRow>
            {draft.id && <ButtonRow><KitButton kind="secondary" label="Remove exercise" onPress={() => setConfirmRemove(true)} disabled={busy} /></ButtonRow>}
          </>
        )}
      </KitModal>

      <KitModal visible={confirmRemove} title={`Remove ${draft?.name ?? 'exercise'}?`} onClose={() => setConfirmRemove(false)}>
        <Body>Past sessions keep their sets.</Body>
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={() => setConfirmRemove(false)} disabled={busy} />
          <KitButton label="Remove" onPress={remove} disabled={busy} />
        </ButtonRow>
      </KitModal>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  order: { gap: space.xxs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sets: { minWidth: 48, textAlign: 'center', color: kitColors.text },
});
