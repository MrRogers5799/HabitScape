/**
 * Today's habits on the Today tab (PROD-019, PROD-026): tick a habit to earn adventure
 * time. Each row shows the hours it earns (PROD-015: habits feed the adventure, not their
 * own skill levels), its progress for spread-out cadences, and its streak. Tapping a row
 * opens the habit's page (KitHabitScreen); "Edit habits" adds or removes them. The arrows step back up
 * to 14 days to tick a day you forgot (PROG-005); only days in the current week earn
 * adventure time (PROG-005; gameService.earnHoursForCompletion).
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useActivities } from '../../context/ActivitiesContext';
import { useAuth } from '../../context/AuthContext';
import { ACTIVITY_TEMPLATES } from '../../constants/activities';
import { Cadence, UserActivity } from '../../types';
import { formatHours, HOURS_PER_HABIT_XP } from '../../game';
import { habitAdventureXP } from '../../game/content/habitTiers';
import { weekIdFor } from '../../game/persistence';
import {
  beforeTracking, dayLabel, daysBack, habitProgress, latestCompletionOn, MAX_BACKFILL_DAYS,
} from '../../utils/habitProgress';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { ActivitySelectionWizard } from '../../components/ActivitySelectionWizard';
import {
  Body, ButtonRow, FRAMES, KitButton, kitColors, kitFonts, NineSlice, Panel, Row, space, Tag,
} from '../../game-ui';

const nameOf = (id: string) => ACTIVITY_TEMPLATES.find((t) => t.id === id)?.activityName ?? id;

function TickBox({ ticked, busy }: { ticked: boolean; busy: boolean }) {
  return (
    <NineSlice frame={FRAMES.slot} style={styles.tick}>
      {busy ? <ActivityIndicator size="small" color={kitColors.gold} /> : ticked ? <Text style={styles.tickMark}>✓</Text> : null}
    </NineSlice>
  );
}

/** "< Yesterday >": steps through the last 14 days. */
function DayStepper({ label, onBack, onForward, canBack, canForward }: {
  label: string; onBack: () => void; onForward: () => void; canBack: boolean; canForward: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <KitButton compact kind="secondary" label="‹" accessibilityLabel="Previous day" onPress={onBack} disabled={!canBack} />
      <Text style={styles.dayLabel} accessibilityLiveRegion="polite">{label}</Text>
      <KitButton compact kind="secondary" label="›" accessibilityLabel="Next day" onPress={onForward} disabled={!canForward} />
    </View>
  );
}

export function TodayHabits() {
  const {
    userActivities, completions, completeActivity, completeActivityForDate, undoCompletion, addActivity, removeActivity, loading,
  } = useActivities();
  const { user } = useAuth();
  const weekStartDay: 0 | 1 = user?.weekStartDay ?? 1;
  const [busyId, setBusyId] = useState<string | null>(null);
  // Days back from today; an offset rather than a date so "today" stays right past midnight.
  const [back, setBack] = useState(0);
  const now = new Date();
  const day = daysBack(now, back);
  const isToday = back === 0;
  // Ticks on days before this week don't earn adventure time (gameService.earnHoursForCompletion).
  const earnsTime = weekIdFor(day.getTime(), weekStartDay) === weekIdFor(now.getTime(), weekStartDay);
  const navigation = useNavigation<NativeStackNavigationProp<AdventureStackParamList>>();
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // Still to do first, then the ones settled (or not tracked yet) for that day; names
  // alphabetical within each. A past day's progress counts up to that day, as on the live
  // Activities screen.
  const dayMs = day.getTime();
  const rows = useMemo(() => {
    const d = new Date(dayMs);
    return userActivities
      .map((a) => ({ activity: a, progress: habitProgress(a, completions, d, weekStartDay), locked: beforeTracking(a.selectedAt, d) }))
      .sort((x, y) => Number(x.progress.settled || x.locked) - Number(y.progress.settled || y.locked) || nameOf(x.activity.id).localeCompare(nameOf(y.activity.id)));
  }, [userActivities, completions, weekStartDay, dayMs]);
  const tracked = rows.filter((r) => !r.locked);
  const settledCount = tracked.filter((r) => r.progress.settled).length;

  async function toggle(activity: UserActivity, doneToday: boolean, settled: boolean) {
    if (busyId) return;
    try {
      setBusyId(activity.id);
      if (doneToday) {
        const c = latestCompletionOn(completions, activity.id, day);
        if (c) await undoCompletion(c.id);
      } else if (!settled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (isToday) {
          await completeActivity(activity.id);
        } else {
          // Midday, as the live screen does, so the tick sits squarely on that day.
          const at = new Date(day);
          at.setHours(12, 0, 0, 0);
          await completeActivityForDate(activity.id, at);
        }
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
    <Panel
      title={isToday ? "Today's habits" : 'Past day'}
      right={tracked.length > 0 ? <Tag label={`${settledCount}/${tracked.length}`} tone={settledCount === tracked.length ? 'green' : 'text'} accessibilityLabel={`${settledCount} of ${tracked.length} done`} /> : undefined}
    >
      {rows.length > 0 && (
        <DayStepper
          label={dayLabel(day, now)}
          canBack={back < MAX_BACKFILL_DAYS}
          canForward={back > 0}
          onBack={() => setBack((b) => Math.min(MAX_BACKFILL_DAYS, b + 1))}
          onForward={() => setBack((b) => Math.max(0, b - 1))}
        />
      )}
      {!isToday && rows.length > 0 && (
        <Body muted>{earnsTime
          ? 'Forgot to tick something? Ticks on this day still earn adventure time this week.'
          : 'Ticks here keep your history and streaks, but days before this week don’t earn adventure time.'}
        </Body>
      )}
      {rows.length === 0 && !loading && <Body muted>Add a habit to start earning adventure time.</Body>}
      {rows.map(({ activity, progress, locked }) => {
        const hours = habitAdventureXP(activity.id) * HOURS_PER_HABIT_XP;
        const name = nameOf(activity.id);
        const streak = activity.currentStreak ?? 0;
        const cantTick = locked || (progress.settled && !progress.doneToday);
        const state = locked ? 'Not tracked yet on this day'
          : progress.doneToday ? (isToday ? 'Done today' : 'Done that day')
          : progress.settled ? 'Done for now' : 'Not done';
        return (
          <Row
            key={activity.id}
            dim={cantTick}
            onPress={() => navigation.navigate('Habit', { activityId: activity.id })}
            accessibilityLabel={`${name}. ${state}. Opens its page`}
            left={(
              <Pressable
                onPress={() => toggle(activity, progress.doneToday, progress.settled)}
                disabled={!!busyId || cantTick}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: progress.doneToday, disabled: cantTick }}
                accessibilityLabel={progress.doneToday ? `Undo ${name}` : `Done: ${name}`}
                hitSlop={8}
              >
                <TickBox ticked={progress.doneToday} busy={busyId === activity.id} />
              </Pressable>
            )}
            title={name}
            detail={locked ? <Tag label="Not tracked yet" /> : (
              <>
                {earnsTime && <Tag label={`+${formatHours(hours)}`} tone="gold" accessibilityLabel={`Earns about ${formatHours(hours)} of adventure time`} />}
                {progress.multi && <Tag label={`${progress.count}/${progress.target}`} tone={progress.count >= progress.target ? 'green' : 'text'} accessibilityLabel={`${progress.count} of ${progress.target} this period`} />}
                {isToday && streak > 0 && <Tag label={`Streak ${streak}`} />}
              </>
            )}
          />
        );
      })}
      <ButtonRow>
        <KitButton kind="secondary" label={rows.length ? 'Edit habits' : 'Add habits'} onPress={() => setEditing(true)} />
      </ButtonRow>

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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // VT323, since the label can hold a date's numbers.
  dayLabel: { flex: 1, textAlign: 'center', fontFamily: kitFonts.text, fontSize: 24, lineHeight: 26, color: kitColors.gold },
});

