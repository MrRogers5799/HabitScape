/**
 * "Workout in progress" with Resume and Discard, shown wherever a saved session should
 * be easy to get back to (Workout list, a workout's page, Today). See services/activeWorkout.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { abandonWorkoutSession } from '../../services/workoutService';
import { ActiveWorkout, activeWorkoutClock, clearActiveWorkout, loadActiveWorkout } from '../../services/activeWorkout';
import { Body, ButtonRow, KitButton, KitModal, Panel, space, TAB_ICONS, Tag } from '../../game-ui';

/** The saved session, reloaded each time the screen comes into focus. */
export function useActiveWorkout() {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const reload = useCallback(() => {
    if (!user) return;
    loadActiveWorkout(user.uid).then(setActive);
  }, [user]);
  useFocusEffect(reload);
  const discard = useCallback(async () => {
    if (!user || !active) return;
    await abandonWorkoutSession(user.uid, active.sessionId).catch(() => {});
    await clearActiveWorkout(user.uid);
    setActive(null);
  }, [user, active]);
  return { active, reload, discard };
}

export function ActiveWorkoutBanner({ active, onResume, onDiscard }: {
  active: ActiveWorkout; onResume: () => void; onDiscard: () => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const done = active.items.filter((i) => i.completed).length;
  const clock = activeWorkoutClock(active, now);
  return (
    <Panel title="Workout in progress" icon={TAB_ICONS.workout} right={<Tag label={clock} tone="gold" accessibilityLabel={active.backdateDate ? `Logging for ${clock}` : `${clock} elapsed`} />}>
      <View style={styles.tags}>
        <Tag label={active.templateName} />
        <Tag label={`${done}/${active.items.length} done`} tone={done ? 'green' : 'text'} accessibilityLabel={`${done} of ${active.items.length} exercises done`} />
      </View>
      <ButtonRow>
        <KitButton kind="secondary" label="Discard" onPress={() => setConfirming(true)} />
        <KitButton label="Resume" onPress={onResume} />
      </ButtonRow>
      <KitModal visible={confirming} title="Discard this workout?" onClose={() => setConfirming(false)}>
        <Body>Everything logged in this session is thrown away.</Body>
        <ButtonRow>
          <KitButton kind="secondary" label="Keep it" onPress={() => setConfirming(false)} />
          <KitButton label="Discard" onPress={async () => { setConfirming(false); await onDiscard(); }} />
        </ButtonRow>
      </KitModal>
    </Panel>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
