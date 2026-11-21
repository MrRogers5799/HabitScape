/**
 * One workout in the new version: start it (or log a past day), see each exercise's
 * progress (volume line, best set, estimated one-rep max, PRs) and every past session,
 * whose sets can be corrected. Rename or delete the workout at the bottom.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useWorkout } from '../../context/WorkoutContext';
import { SetLog } from '../../types';
import { abandonWorkoutSession, getTemplateSessionHistory, subscribeToExercises, updateSetLog } from '../../services/workoutService';
import { exerciseProgress, formatVolume, groupByExercise, ProgressPoint, SessionEntry, totalVolume } from '../../utils/workoutProgress';
import { WorkoutStackParamList } from '../../navigation/WorkoutNavigator';
import { ActiveWorkoutBanner, useActiveWorkout } from './ActiveWorkoutBanner';
import {
  Body, ButtonRow, KitButton, KitField, KitModal, KitScreen, kitColors, kitFonts, Panel, Row, space, Tag, type,
} from '../../game-ui';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'WorkoutMetrics'>;

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** The volume line for one exercise; PR sessions are green dots, the latest a gold one. */
function VolumeLine({ points, width, height = 70 }: { points: ProgressPoint[]; width: number; height?: number }) {
  const values = points.map((p) => p.volume);
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const pad = 8;
  const xy = values.map((v, i) => ({
    x: points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * (width - pad * 2),
    y: pad + (height - pad * 2) * (1 - (v - min) / range),
  }));
  const d = xy.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  return (
    <Svg width={width} height={height} accessibilityLabel={`Volume over ${points.length} sessions`}>
      {points.length > 1 && <Path d={d} stroke={kitColors.gold} strokeWidth={3} fill="none" strokeLinejoin="round" />}
      {xy.map((c, i) => {
        const last = i === xy.length - 1;
        const pr = points[i].isPR;
        return <Circle key={i} cx={c.x} cy={c.y} r={pr || last ? 5 : 3} fill={pr ? kitColors.green : last ? kitColors.gold : kitColors.goldDeep} />;
      })}
    </Svg>
  );
}

function SessionDetail({ entry, userId, onSetUpdated, onDelete }: {
  entry: SessionEntry; userId: string;
  onSetUpdated: (setId: string, weight: number | null, reps: number | null) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState<SetLog | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function save() {
    if (!editing) return;
    const w = weight ? parseFloat(weight) : null;
    const r = reps ? parseInt(reps, 10) : null;
    try {
      setBusy(true);
      await updateSetLog(userId, entry.session.id, editing.id, w, r);
      onSetUpdated(editing.id, w, r);
      setEditing(null);
    } catch {
      Alert.alert('Couldn’t save that set', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.detail}>
      {groupByExercise(entry.sets).map(([name, sets]) => (
        <View key={name} style={styles.exGroup}>
          <View style={styles.exHeader}>
            <Text style={[type.bodyBold, styles.flex]}>{name}</Text>
            <Tag label={`${formatVolume(totalVolume(sets))} ${sets[0].unit}`} tone="gold" />
          </View>
          {sets.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => { setEditing(s); setWeight(s.weight != null ? String(s.weight) : ''); setReps(s.reps != null ? String(s.reps) : ''); }}
              accessibilityRole="button"
              accessibilityLabel={`Set ${s.setNumber}: ${s.weight ?? 'no'} ${s.unit} for ${s.reps ?? 'no'} reps. Edit`}
              style={styles.setLine}
            >
              <Text style={styles.setNum}>{s.setNumber}</Text>
              <Text style={[type.body, styles.flex]}>{s.weight ?? '–'} {s.unit} × {s.reps ?? '–'}</Text>
              <Text style={styles.edit}>✎</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <ButtonRow><KitButton kind="secondary" label="Delete session" onPress={() => setConfirming(true)} /></ButtonRow>

      <KitModal visible={!!editing} title={editing ? `${editing.exerciseName}, set ${editing.setNumber}` : 'Set'} onClose={() => setEditing(null)}>
        <View style={styles.setEdit}>
          <View style={styles.flex}><KitField value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Weight" selectTextOnFocus autoFocus inputStyle={styles.center} /></View>
          <Text style={type.body}>{editing?.unit} ×</Text>
          <View style={styles.flex}><KitField value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="Reps" selectTextOnFocus inputStyle={styles.center} /></View>
        </View>
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={() => setEditing(null)} disabled={busy} />
          <KitButton label="Save" onPress={save} disabled={busy} />
        </ButtonRow>
      </KitModal>
      <KitModal visible={confirming} title="Delete this session?" onClose={() => setConfirming(false)}>
        <Body>Its sets are removed from your history. This can’t be undone.</Body>
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={() => setConfirming(false)} />
          <KitButton label="Delete" onPress={() => { setConfirming(false); onDelete(); }} />
        </ButtonRow>
      </KitModal>
    </View>
  );
}

export function KitWorkoutScreen({ route, navigation }: Props) {
  const { templateId } = route.params;
  const { user } = useAuth();
  const { templates, updateTemplate, deleteTemplate } = useWorkout();
  const { active, discard } = useActiveWorkout();
  const { width } = useWindowDimensions();
  const name = templates.find((t) => t.id === templateId)?.name ?? route.params.templateName;

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<SessionEntry[]>([]);
  const [hasExercises, setHasExercises] = useState<boolean | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'past' | 'rename' | 'delete' | 'busy'>(null);
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTemplateSessionHistory(user.uid, templateId)
      .then(setHistory)
      .catch(() => Alert.alert('Couldn’t load this workout’s history', 'Please try again.'))
      .finally(() => setLoading(false));
    return subscribeToExercises(user.uid, templateId, (ex) => setHasExercises(ex.length > 0), () => setHasExercises(false));
  }, [user, templateId]);

  const progress = useMemo(() => exerciseProgress(history), [history]);
  const newestFirst = useMemo(() => [...history].filter((h) => h.session.completedAt).reverse(), [history]);
  const unit = history[0]?.sets[0]?.unit ?? 'lbs';
  const allVolume = history.reduce((sum, h) => sum + totalVolume(h.sets), 0);
  const pastDays = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(12, 0, 0, 0);
    return d;
  }), []);
  // Panel inner width: screen minus gutters, panel frame and padding.
  const chartWidth = width - space.gutter * 2 - 52;

  const resume = () => active && navigation.push('ActiveSession', { templateId: active.templateId, templateName: active.templateName, backdateDate: active.backdateDate });
  // One session at a time: this workout's own saved session resumes; another one has to be finished or discarded first.
  const start = (backdateDate?: string) => {
    if (active && active.templateId !== templateId) return setModal('busy');
    if (active) return resume();
    navigation.push('ActiveSession', { templateId, templateName: name, backdateDate });
  };
  const liveHere = active?.templateId === templateId;

  async function rename() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      setBusy(true);
      const linked = templates.find((t) => t.id === templateId)?.linkedSkillId;
      await updateTemplate(templateId, trimmed, linked); // keeps any skill link from the live app
      setModal(null);
    } catch {
      Alert.alert('Couldn’t rename', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      setBusy(true);
      await deleteTemplate(templateId);
      navigation.popToTop();
    } catch {
      setBusy(false);
      Alert.alert('Couldn’t delete', 'Please try again.');
    }
  }

  async function deleteSession(sessionId: string) {
    if (!user) return;
    try {
      await abandonWorkoutSession(user.uid, sessionId);
      setHistory((prev) => prev.filter((h) => h.session.id !== sessionId));
      setOpen(null);
    } catch {
      Alert.alert('Couldn’t delete the session', 'Please try again.');
    }
  }

  return (
    <KitScreen title={name} onBack={() => navigation.goBack()}>
      {active && <ActiveWorkoutBanner active={active} onResume={resume} onDiscard={discard} />}

      {hasExercises === false ? (
        <Panel title="No exercises yet">
          <ButtonRow><KitButton label="Add exercises" onPress={() => navigation.push('TemplateDetail', { templateId, templateName: name })} /></ButtonRow>
        </Panel>
      ) : (
        <>
          {!liveHere && <ButtonRow><KitButton label="Start workout" onPress={() => start()} disabled={hasExercises !== true} /></ButtonRow>}
          <ButtonRow>
            <KitButton kind="secondary" label="Log a past day" onPress={() => (active ? setModal('busy') : setModal('past'))} disabled={hasExercises !== true} />
            <KitButton kind="secondary" label="Exercises" onPress={() => navigation.push('TemplateDetail', { templateId, templateName: name })} />
          </ButtonRow>
        </>
      )}

      {loading && <ActivityIndicator color={kitColors.gold} />}

      {!loading && newestFirst.length > 0 && (
        <Panel title="Totals">
          <View style={styles.tags}>
            <Tag label={`${newestFirst.length} sessions`} tone="gold" />
            <Tag label={`${formatVolume(allVolume)} ${unit} lifted`} />
            <Tag label={`Last ${shortDate(newestFirst[0].session.completedAt!)}`} />
          </View>
        </Panel>
      )}

      {progress.length > 0 && (
        <Panel title="Progress">
          {progress.map((ep) => {
            const latest = ep.points[ep.points.length - 1];
            const delta = ep.points.length > 1 ? latest.volume - ep.points[0].volume : 0;
            const prs = ep.points.filter((p) => p.isPR).length;
            return (
              <View key={ep.name} style={styles.progress}>
                <View style={styles.exHeader}>
                  <Text style={[type.bodyBold, styles.flex]}>{ep.name}</Text>
                  {latest.isPR && <Tag label="PR!" tone="green" accessibilityLabel="Personal record last session" />}
                </View>
                <View style={styles.tags}>
                  <Tag label={`${formatVolume(latest.volume)} ${ep.unit}`} tone="gold" accessibilityLabel={`Last volume ${formatVolume(latest.volume)} ${ep.unit}`} />
                  {delta !== 0 && <Tag label={`${delta > 0 ? '+' : ''}${formatVolume(delta)}`} tone={delta > 0 ? 'green' : 'red'} accessibilityLabel={`${delta > 0 ? 'Up' : 'Down'} ${formatVolume(Math.abs(delta))} since the first session`} />}
                  <Tag label={`Best ${latest.maxWeight}`} accessibilityLabel={`Heaviest set ${latest.maxWeight} ${ep.unit}`} />
                  <Tag label={`1RM ${latest.est1RM}`} accessibilityLabel={`Estimated one-rep max ${latest.est1RM} ${ep.unit}`} />
                  {prs > 0 && <Tag label={`${prs} PR${prs === 1 ? '' : 's'}`} tone="green" />}
                </View>
                {ep.points.length >= 2 && (
                  <>
                    <VolumeLine points={ep.points} width={chartWidth} />
                    <View style={styles.axis}>
                      <Text style={type.caption}>{shortDate(ep.points[0].date)}</Text>
                      <Text style={type.caption}>{shortDate(latest.date)}</Text>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </Panel>
      )}

      {newestFirst.length > 0 && (
        <Panel title="History">
          {newestFirst.map((h) => {
            const isOpen = open === h.session.id;
            const exCount = groupByExercise(h.sets).length;
            const minutes = Math.round((h.session.completedAt!.getTime() - h.session.startedAt.getTime()) / 60000);
            return (
              <View key={h.session.id}>
                <Row
                  title={h.session.completedAt!.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  detail={(
                    <>
                      <Tag label={`${exCount} ex`} accessibilityLabel={`${exCount} exercises`} />
                      <Tag label={`${formatVolume(totalVolume(h.sets))} ${h.sets[0]?.unit ?? unit}`} tone="gold" />
                      {minutes > 0 && <Tag label={`${minutes}m`} accessibilityLabel={`${minutes} minutes`} />}
                    </>
                  )}
                  right={<Text style={styles.arrow}>{isOpen ? '▴' : '▾'}</Text>}
                  onPress={() => setOpen(isOpen ? null : h.session.id)}
                  accessibilityLabel={`${isOpen ? 'Hide' : 'Show'} the session on ${shortDate(h.session.completedAt!)}`}
                />
                {isOpen && user && (
                  <SessionDetail
                    entry={h}
                    userId={user.uid}
                    onDelete={() => deleteSession(h.session.id)}
                    onSetUpdated={(setId, w, r) => setHistory((prev) => prev.map((e) => (e.session.id !== h.session.id ? e : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, weight: w, reps: r } : s)) })))}
                  />
                )}
              </View>
            );
          })}
        </Panel>
      )}

      {!loading && newestFirst.length === 0 && hasExercises && <Body muted>Finish a session to see your progress here.</Body>}

      <Panel title="Manage">
        <ButtonRow>
          <KitButton kind="secondary" label="Rename" onPress={() => { setNameInput(name); setModal('rename'); }} />
          <KitButton kind="secondary" label="Delete" onPress={() => setModal('delete')} />
        </ButtonRow>
      </Panel>

      <KitModal visible={modal === 'past'} title="Log a past day" onClose={() => setModal(null)}>
        <ScrollView style={styles.list}>
          {pastDays.map((d, i) => (
            <Pressable key={i} onPress={() => { setModal(null); start(d.toISOString()); }} accessibilityRole="button" style={styles.listRow}>
              <Text style={type.body}>{i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ButtonRow><KitButton kind="secondary" label="Cancel" onPress={() => setModal(null)} /></ButtonRow>
      </KitModal>

      <KitModal visible={modal === 'busy'} title="A workout is already going" onClose={() => setModal(null)}>
        <Body>{`Finish or discard ${active?.templateName ?? 'it'} before starting another.`}</Body>
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={() => setModal(null)} />
          <KitButton label="Go to it" onPress={() => { setModal(null); resume(); }} />
        </ButtonRow>
      </KitModal>

      <KitModal visible={modal === 'rename'} title="Rename workout" onClose={() => setModal(null)}>
        <KitField value={nameInput} onChangeText={setNameInput} maxLength={40} autoFocus autoCapitalize="words" placeholder="Name" />
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={() => setModal(null)} disabled={busy} />
          <KitButton label="Save" onPress={rename} disabled={busy || !nameInput.trim()} />
        </ButtonRow>
      </KitModal>

      <KitModal visible={modal === 'delete'} title={`Delete ${name}?`} onClose={() => setModal(null)}>
        <Body>The workout and its exercises are removed. Sessions you already logged stay in your history.</Body>
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={() => setModal(null)} disabled={busy} />
          <KitButton label="Delete" onPress={remove} disabled={busy} />
        </ButtonRow>
      </KitModal>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  progress: { gap: space.xs, paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: kitColors.divider },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  arrow: { fontFamily: kitFonts.text, fontSize: 26, color: kitColors.gold, paddingHorizontal: space.xs },
  detail: { gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.xs },
  exGroup: { gap: space.xxs },
  setLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 },
  setNum: { fontFamily: kitFonts.text, fontSize: 20, color: kitColors.textMuted, width: 22, textAlign: 'center' },
  edit: { fontFamily: kitFonts.text, fontSize: 22, color: kitColors.gold },
  setEdit: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { maxHeight: 420 },
  listRow: { paddingVertical: space.sm },
});
