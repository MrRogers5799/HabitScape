/**
 * One habit, in the new version's kit (PROD-024/025), opened from Today's habits. Kept
 * from the live habit page: the streak, best streak, times done, hit rate and the month
 * calendar. Dropped (PROD-029, one home per thing): the weekly XP chart and the list of
 * every completion, which repeat the calendar, and habit XP, which doesn't level skills
 * in the new version (PROD-015); the adventure time it earned shows instead. Ticking and
 * undoing stay on Today; adding and removing habits stay in Edit habits.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useActivities } from '../../context/ActivitiesContext';
import { useAuth } from '../../context/AuthContext';
import { ACTIVITY_TEMPLATES } from '../../constants/activities';
import { CADENCE_CONFIG } from '../../constants/cadences';
import { buildMonthCalendar, calculateCompletionRate, CalendarDay } from '../../components/HabitDetailModal';
import { formatHours } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { Body, KitButton, KitScreen, kitColors, kitFonts, Panel, space, Tag, type } from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Habit'>;

const DAYS_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAYS_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function Stat({ label, value, tone = 'text' }: { label: string; value: string; tone?: 'text' | 'gold' }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type.number, { color: tone === 'gold' ? kitColors.gold : kitColors.text }]}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

function DayCell({ day }: { day: CalendarDay }) {
  if (!day.date) return <View style={styles.cell} />;
  const faint = day.isPreTracking || (day.isFuture && !day.isToday);
  return (
    <View
      style={[styles.cell, styles.cellBox, day.completed && styles.cellDone, day.isMissed && styles.cellMissed, day.isToday && styles.cellToday, faint && styles.cellFaint]}
      accessible
      accessibilityLabel={`${day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${day.completed ? 'done' : day.isMissed ? 'missed' : faint ? 'not tracked' : 'not done'}`}
    >
      <Text style={[styles.cellText, day.completed && styles.cellTextDone]}>{day.date.getDate()}</Text>
    </View>
  );
}

export function KitHabitScreen({ navigation, route }: Props) {
  const { userActivities, completions } = useActivities();
  const { user } = useAuth();
  const weekStartDay: 0 | 1 = user?.weekStartDay ?? 1;
  const now = new Date();
  const [cal, setCal] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const activity = userActivities.find((a) => a.id === route.params.activityId);

  const mine = useMemo(() => completions.filter((c) => c.activityId === route.params.activityId), [completions, route.params.activityId]);
  if (!activity) return null;

  const template = ACTIVITY_TEMPLATES.find((t) => t.id === activity.id);
  const name = template?.activityName ?? activity.id;
  const cadence = CADENCE_CONFIG[activity.cadence];
  const timesPerWeek = cadence?.timesPerWeek ?? 1;
  const rate = calculateCompletionRate(completions, activity.id, activity.cadence, timesPerWeek, activity.selectedAt, weekStartDay);
  const earned = mine.reduce((h, c) => h + (c.timeGrant?.weekHours ?? 0), 0);
  const since = activity.selectedAt ? new Date(activity.selectedAt) : null;
  const trackingStart = new Date(since ?? now);
  trackingStart.setHours(0, 0, 0, 0);
  const weeks = buildMonthCalendar(cal.y, cal.m, completions, activity.id, activity.cadence, timesPerWeek, trackingStart, weekStartDay);
  const atNow = cal.y === now.getFullYear() && cal.m === now.getMonth();
  const step = (d: number) => setCal(({ y, m }) => {
    const t = new Date(y, m + d, 1);
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const monthLabel = new Date(cal.y, cal.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <KitScreen title={name} onBack={() => navigation.goBack()}>
      <Panel>
        <View style={styles.tags}>
          <Tag label={cadence?.label ?? activity.cadence} tone="gold" />
          {since && <Tag label={`Since ${since.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`} />}
        </View>
        {template?.description ? <Body muted>{template.description}</Body> : null}
        <View style={styles.stats}>
          <Stat label="Streak" value={String(activity.currentStreak ?? 0)} tone="gold" />
          <Stat label="Best" value={String(activity.longestStreak ?? 0)} />
          <Stat label="Done" value={String(mine.length)} />
          <Stat label="Rate" value={rate === null ? '–' : `${rate}%`} />
          <Stat label="Time" value={formatHours(earned)} />
        </View>
      </Panel>

      <Panel>
        <View style={styles.monthRow}>
          <KitButton compact kind="secondary" label="‹" accessibilityLabel="Previous month" onPress={() => step(-1)} />
          <Text style={styles.month}>{monthLabel}</Text>
          <KitButton compact kind="secondary" label="›" accessibilityLabel="Next month" disabled={atNow} onPress={() => step(1)} />
        </View>
        <View style={styles.week}>
          {(weekStartDay === 1 ? DAYS_MON : DAYS_SUN).map((d, i) => <Text key={i} style={[styles.cell, styles.dayHead]}>{d}</Text>)}
        </View>
        {weeks.map((w, i) => <View key={i} style={styles.week}>{w.map((d, j) => <DayCell key={j} day={d} />)}</View>)}
      </Panel>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  stats: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: space.xs },
  stat: { alignItems: 'center', minWidth: 52 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // VT323, since the label holds the year.
  month: { flex: 1, textAlign: 'center', fontFamily: kitFonts.text, fontSize: 24, lineHeight: 26, color: kitColors.gold },
  week: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayHead: { aspectRatio: undefined, textAlign: 'center', fontFamily: kitFonts.text, fontSize: 18, color: kitColors.textMuted },
  cellBox: { backgroundColor: kitColors.slotFill, borderWidth: 2, borderColor: kitColors.divider },
  cellDone: { backgroundColor: kitColors.greenDeep, borderColor: kitColors.green },
  cellMissed: { borderColor: '#7a3a2e' },
  cellToday: { borderColor: kitColors.gold },
  cellFaint: { opacity: 0.3 },
  cellText: { fontFamily: kitFonts.text, fontSize: 18, lineHeight: 20, color: kitColors.textMuted },
  cellTextDone: { color: kitColors.text },
});
