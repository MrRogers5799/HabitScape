import { UserActivity, ActivityCompletion } from '../types';
import { CADENCE_CONFIG } from '../constants/cadences';

export function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const daysFromMonday = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]; // "2026-04-21"
}

export interface StreakUpdate {
  activityId: string;
  currentStreak: number;
  longestStreak: number;
  lastStreakCheckWeek: string;
}

/**
 * Computes the streak update for a single activity.
 * Returns null if no Firestore write is needed (already up to date).
 *
 * Logic:
 * - Monthly activities are excluded (can't maintain a weekly streak).
 * - On the first week boundary crossed since lastStreakCheckWeek, we look
 *   at how many unique days had a completion during the just-ended week.
 * - If unique days >= timesPerWeek target → streak continues.
 * - If < target, or more than one week was skipped → streak resets to 0.
 */
export function computeStreakUpdate(
  activity: UserActivity,
  completions: ActivityCompletion[]
): StreakUpdate | null {
  if (activity.cadence === 'monthly') return null;

  const thisWeekMonday = getWeekMonday(new Date());
  const thisWeekStr = toDateStr(thisWeekMonday);

  // Already evaluated this week — nothing to do
  if (activity.lastStreakCheckWeek === thisWeekStr) return null;

  const currentStreak = activity.currentStreak ?? 0;
  const longestStreak = activity.longestStreak ?? 0;

  // First time we've seen this activity — initialise, no streak yet
  if (!activity.lastStreakCheckWeek) {
    return { activityId: activity.id, currentStreak: 0, longestStreak, lastStreakCheckWeek: thisWeekStr };
  }

  const lastCheckMonday = new Date(activity.lastStreakCheckWeek + 'T00:00:00');
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksPassed = Math.round(
    (thisWeekMonday.getTime() - lastCheckMonday.getTime()) / msPerWeek
  );

  let newStreak: number;

  if (weeksPassed > 1) {
    // Skipped one or more complete weeks — streak is broken
    newStreak = 0;
  } else {
    // Evaluate the week that just ended
    const weekEnd = new Date(lastCheckMonday.getTime() + msPerWeek);
    const target = CADENCE_CONFIG[activity.cadence].timesPerWeek;

    const uniqueDays = new Set<string>();
    completions.forEach(c => {
      if (c.activityId !== activity.id) return;
      const d = new Date(c.completedAt);
      if (d >= lastCheckMonday && d < weekEnd) {
        uniqueDays.add(toDateStr(d));
      }
    });

    newStreak = uniqueDays.size >= target ? currentStreak + 1 : 0;
  }

  const newLongest = Math.max(newStreak, longestStreak);

  return {
    activityId: activity.id,
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastStreakCheckWeek: thisWeekStr,
  };
}

/**
 * Returns all activities that need a streak update this session.
 */
export function computeAllStreakUpdates(
  activities: UserActivity[],
  completions: ActivityCompletion[]
): StreakUpdate[] {
  const updates: StreakUpdate[] = [];
  for (const activity of activities) {
    const update = computeStreakUpdate(activity, completions);
    if (update) updates.push(update);
  }
  return updates;
}
