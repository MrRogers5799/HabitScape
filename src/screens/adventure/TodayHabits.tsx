/**
 * Today's habits on the Today tab (PROD-019, PROD-026): tick a habit to earn adventure
 * time. Each row shows the hours it earns (PROD-015: habits feed the adventure, not their
 * own skill levels), its progress for spread-out cadences, and its streak. Tapping a row
 * opens the habit's history; "Edit habits" adds or removes them.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useActivities } from '../../context/ActivitiesContext';
import { useAuth } from '../../context/AuthContext';
import { ACTIVITY_TEMPLATES } from '../../constants/activities';
import { Cadence, UserActivity } from '../../types';
import { formatHours, HOURS_PER_HABIT_XP } from '../../game';
import { habitAdventureXP } from '../../game/content/habitTiers';
import { habitProgress, latestCompletionToday } from '../../utils/habitProgress';
import { HabitDetailModal } from '../../components/HabitDetailModal';
import { ActivitySelectionWizard } from '../../components/ActivitySelectionWizard';
import {
  Body, ButtonRow, FRAMES, KitButton, kitColors, kitFonts, NineSlice, Panel, Row, Tag,
} from '../../game-ui';

const nameOf = (id: string) => ACTIVITY_TEMPLATES.find((t) => t.id === id)?.activityName ?? id;

function TickBox({ ticked, busy }: { ticked: boolean; busy: boolean }) {
  return (
    <NineSlice frame={FRAMES.slot} style={styles.tick}>
      {busy ? <ActivityIndicator size="small" color={kitColors.gold} /> : ticked ? <Text style={styles.tickMark}>✓</Text> : null}
    </NineSlice>
  );
}

export function TodayHabits() {
  const { userActivities, completions, completeActivity, undoCompletion, addActivity, removeActivity, loading } = useActivities();
  const { user } = useAuth();
  const weekStartDay: 0 | 1 = user?.weekStartDay ?? 1;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserActivity | null>(null);
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // Still to do first, then the ones settled for today; names alphabetical within each.
  const rows = useMemo(() => {
    const now = new Date();
    return userActivities
      .map((a) => ({ activity: a, progress: habitProgress(a, completions, now, weekStartDay) }))
      .sort((x, y) => Number(x.progress.settled) - Number(y.progress.settled) || nameOf(x.activity.id).localeCompare(nameOf(y.activity.id)));
  }, [userActivities, completions, weekStartDay]);
  const settledCount = rows.filter((r) => r.progress.settled).length;

  async function toggle(activity: UserActivity, doneToday: boolean, settled: boolean) {
    if (busyId) return;
    try {
      setBusyId(activity.id);
      if (doneToday) {
        const c = latestCompletionToday(completions, activity.id, new Date());
        if (c) await undoCompletion(c.id);
      } else if (!settled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await completeActivity(activity.id);
      }
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function edit(fn: () => Promise<unknown>) {
    try {
      setEditBusy(true);
      await fn();
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <Panel title="Today's habits" right={rows.length > 0 ? <Tag label={`${settledCount}/${rows.length}`} tone={settledCount === rows.length ? 'green' : 'text'} accessibilityLabel={`${settledCount} of ${rows.length} done`} /> : undefined}>
      {rows.length === 0 && !loading && <Body muted>Add a habit to start earning adventure time.</Body>}
      {rows.map(({ activity, progress }) => {
        const hours = habitAdventureXP(activity.id) * HOURS_PER_HABIT_XP;
        const name = nameOf(activity.id);
        const streak = activity.currentStreak ?? 0;
        return (
          <Row
            key={activity.id}
            dim={progress.settled && !progress.doneToday}
            onPress={() => setDetail(activity)}
            accessibilityLabel={`${name}. ${progress.doneToday ? 'Done today' : progress.settled ? 'Done for now' : 'Not done'}. Opens its history`}
            left={(
              <Pressable
                onPress={() => toggle(activity, progress.doneToday, progress.settled)}
                disabled={!!busyId || (progress.settled && !progress.doneToday)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: progress.doneToday, disabled: progress.settled && !progress.doneToday }}
                accessibilityLabel={progress.doneToday ? `Undo ${name}` : `Done: ${name}`}
                hitSlop={8}
              >
                <TickBox ticked={progress.doneToday} busy={busyId === activity.id} />
              </Pressable>
            )}
            title={name}
            detail={(
              <>
                <Tag label={`+${formatHours(hours)}`} tone="gold" accessibilityLabel={`Earns about ${formatHours(hours)} of adventure time`} />
                {progress.multi && <Tag label={`${progress.count}/${progress.target}`} tone={progress.count >= progress.target ? 'green' : 'text'} accessibilityLabel={`${progress.count} of ${progress.target} this period`} />}
                {streak > 0 && <Tag label={`Streak ${streak}`} />}
              </>
            )}
          />
        );
      })}
      <ButtonRow>
        <KitButton kind="secondary" label={rows.length ? 'Edit habits' : 'Add habits'} onPress={() => setEditing(true)} />
      </ButtonRow>

      <HabitDetailModal activity={detail} completions={completions} onClose={() => setDetail(null)} />
      <ActivitySelectionWizard
        visible={editing}
        onClose={() => setEditing(false)}
        selectedActivities={userActivities}
        onActivityAdded={(id: string, cadence: Cadence) => edit(() => addActivity(id, cadence))}
        onActivityRemoved={(id: string) => edit(() => removeActivity(id))}
        loading={editBusy}
        mode="manage"
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  tick: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tickMark: { fontFamily: kitFonts.text, fontSize: 30, lineHeight: 32, color: kitColors.green },
});

