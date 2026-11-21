/**
 * The new version's Workout tab (PROD-019: a separate logger, no game effect), in the
 * UI kit. Lists the player's workouts; tap one to start it or see its progress. Share
 * a set of workouts as a code, or import someone else's.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Share, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useWorkout } from '../../context/WorkoutContext';
import { importSharedTemplates, shareTemplates } from '../../services/workoutService';
import { WorkoutStackParamList } from '../../navigation/WorkoutNavigator';
import { ActiveWorkoutBanner, useActiveWorkout } from './ActiveWorkoutBanner';
import {
  Body, ButtonRow, FRAMES, KitButton, KitField, KitModal, KitScreen, kitColors, kitFonts, NineSlice, Panel, Row, space, TAB_ICONS, type,
} from '../../game-ui';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'WorkoutTemplates'>;

function WorkoutIcon({ ticked }: { ticked?: boolean }) {
  return (
    <NineSlice frame={FRAMES.slot} style={styles.icon}>
      {ticked === undefined
        ? <Image source={TAB_ICONS.workout} style={styles.iconImage} accessibilityIgnoresInvertColors />
        : ticked ? <Text style={styles.tick}>✓</Text> : null}
    </NineSlice>
  );
}

export function KitWorkoutsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { templates, loading, createTemplate } = useWorkout();
  const { active, discard } = useActiveWorkout();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    try {
      setBusy(true);
      const id = await createTemplate(name);
      setCreating(false);
      setNewName('');
      // A new workout has no exercises yet: go straight to adding them.
      navigation.push('TemplateDetail', { templateId: id, templateName: name });
    } catch {
      Alert.alert('Couldn’t create the workout', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function makeCode() {
    if (!user || selected.size === 0) return;
    try {
      setBusy(true);
      setShareCode(await shareTemplates(user.uid, [...selected]));
    } catch (e: unknown) {
      Alert.alert('Couldn’t make a code', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!user || !importCode.trim()) return;
    try {
      setBusy(true);
      setImportError(null);
      const count = await importSharedTemplates(user.uid, importCode);
      setImporting(false);
      setImportCode('');
      Alert.alert('Imported', `${count} workout${count === 1 ? '' : 's'} added.`);
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'That code didn’t work.');
    } finally {
      setBusy(false);
    }
  }

  function endSharing() {
    setSharing(false);
    setSelected(new Set());
    setShareCode(null);
  }

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <KitScreen
      title="Workouts"
      footer={sharing ? (
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={endSharing} />
          <KitButton label={selected.size ? `Share ${selected.size}` : 'Pick workouts'} disabled={selected.size === 0 || busy} onPress={makeCode} />
        </ButtonRow>
      ) : undefined}
    >
      {active && !sharing && (
        <ActiveWorkoutBanner
          active={active}
          onDiscard={discard}
          onResume={() => navigation.push('ActiveSession', { templateId: active.templateId, templateName: active.templateName, backdateDate: active.backdateDate })}
        />
      )}
      <Panel title={sharing ? 'Pick workouts to share' : 'Your workouts'}>
        {loading && <ActivityIndicator color={kitColors.gold} />}
        {!loading && templates.length === 0 && <Body muted>No workouts yet. Make one, or import a friend’s with their code.</Body>}
        {templates.map((t) => (
          <Row
            key={t.id}
            left={<WorkoutIcon ticked={sharing ? selected.has(t.id) : undefined} />}
            title={t.name}
            onPress={() => (sharing ? toggle(t.id) : navigation.push('WorkoutMetrics', { templateId: t.id, templateName: t.name }))}
            accessibilityLabel={sharing ? `${t.name}, ${selected.has(t.id) ? 'selected' : 'not selected'}` : `Open ${t.name}`}
            right={sharing ? undefined : <Text style={styles.arrow}>›</Text>}
          />
        ))}
      </Panel>

      {!sharing && (
        <>
          <ButtonRow><KitButton label="New workout" onPress={() => setCreating(true)} /></ButtonRow>
          <ButtonRow>
            <KitButton kind="secondary" label="Share" disabled={templates.length === 0} onPress={() => setSharing(true)} />
            <KitButton kind="secondary" label="Import" onPress={() => { setImportError(null); setImporting(true); }} />
          </ButtonRow>
        </>
      )}

      <KitModal visible={creating} title="New workout" onClose={() => setCreating(false)}>
        <KitField placeholder="Name, e.g. Push day" value={newName} onChangeText={setNewName} maxLength={40} autoFocus autoCapitalize="words" onSubmitEditing={create} />
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={() => setCreating(false)} disabled={busy} />
          <KitButton label="Create" onPress={create} disabled={busy || !newName.trim()} />
        </ButtonRow>
      </KitModal>

      <KitModal visible={importing} title="Import workouts" onClose={() => setImporting(false)}>
        <KitField
          placeholder="Share code"
          value={importCode}
          onChangeText={(v) => setImportCode(v.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoFocus
          onSubmitEditing={doImport}
          inputStyle={styles.code}
          error={importError ?? undefined}
        />
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={() => setImporting(false)} disabled={busy} />
          <KitButton label="Import" onPress={doImport} disabled={busy || !importCode.trim()} />
        </ButtonRow>
      </KitModal>

      <KitModal visible={!!shareCode} title="Share code" onClose={endSharing}>
        <Text style={[type.readout, styles.codeBig]} selectable accessibilityLabel={`Share code ${shareCode?.split('').join(' ')}`}>{shareCode}</Text>
        <Body muted>Anyone with HabitScape can tap Import and enter this code to copy these workouts.</Body>
        <ButtonRow>
          <KitButton kind="secondary" label="Done" onPress={endSharing} />
          <KitButton label="Send" onPress={() => Share.share({ message: `My HabitScape workouts: import code ${shareCode}` })} />
        </ButtonRow>
      </KitModal>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  iconImage: { width: 30, height: 30 },
  tick: { fontFamily: kitFonts.text, fontSize: 30, lineHeight: 32, color: kitColors.green },
  arrow: { fontFamily: kitFonts.text, fontSize: 28, color: kitColors.gold, paddingHorizontal: space.xs },
  code: { fontSize: 30, letterSpacing: 6, textAlign: 'center' },
  codeBig: { textAlign: 'center', color: kitColors.gold, letterSpacing: 8 },
});
