import { UserActivity, ActivityCompletion } from '../types';
import { CADENCE_CONFIG } from '../constants/cadences';

export function getWeekStart(date: Date, weekStartDay: 0 | 1 = 1): Date {
  const d = new Date(date);
  const daysFromStart = weekStartDay === 1
    ? (d.getDay() === 0 ? 6 : d.getDay() - 1)  // Monday-based
    : d.getDay();                                  // Sunday-based
  d.setDate(d.getDate() - daysFromStart);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Kept for backward compatibility — callers that haven't migrated yet
export function getWeekMonday(date: Date): Date {
  return getWeekStart(date, 1);
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

const STREAK_VERSION = 2;

// ── longest-streak helpers ────────────────────────────────────────────────────

function longestDailyStreak(activityId: string, allCompletions: ActivityCompletion[]): number {
  const uniqueDays = [...new Set(
    allCompletions
      .filter(c => c.activityId === activityId)
      .map(c => toDateStr(new Date(c.completedAt)))
  )].sort(); // ascending

  if (uniqueDays.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1] + 'T00:00:00');
    const curr = new Date(uniqueDays[i] + 'T00:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      longest = Math.max(longest, ++current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function longestNxWeekStreak(activity: UserActivity, allCompletions: ActivityCompletion[], weekStartDay: 0 | 1 = 1): number {
  const target = CADENCE_CONFIG[activity.cadence].timesPerWeek;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const activityCompletions = allCompletions.filter(c => c.activityId === activity.id);
  if (activityCompletions.length === 0) return 0;

  const earliestDate = activityCompletions.reduce<Date>(
    (min, c) => { const d = new Date(c.completedAt); return d < min ? d : min; },
    new Date(activityCompletions[0].completedAt)
  );
  const thisWeekMonday = getWeekStart(new Date(), weekStartDay);

  let longest = 0;
  let current = 0;
  let weekStart = getWeekStart(earliestDate, weekStartDay);

  while (weekStart <= thisWeekMonday) {
    const weekEnd = new Date(weekStart.getTime() + msPerWeek);
    const count = activityCompletions.filter(c => {
      const d = new Date(c.completedAt);
      return d >= weekStart && d < weekEnd;
    }).length;

    const isCurrentWeek = weekStart.getTime() === thisWeekMonday.getTime();

    if (isCurrentWeek) {
      current += count;
      longest = Math.max(longest, current);
    } else if (count >= target) {
      current += count;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }

    weekStart = new Date(weekStart.getTime() + msPerWeek);
  }

  return longest;
}

export interface StreakUpdate {
  activityId: string;
  currentStreak: number;
  longestStreak: number;
  lastStreakCheckDate?: string;  // daily: date of last completion
  lastStreakCheckWeek?: string;  // non-daily: Monday of last evaluated week
  streakVersion?: number;
}

/**
 * Called immediately on each completion. Increments the streak for the activity.
 *
 * Daily: increments once per day. When lastStreakCheckDate is not yet set (first run
 * on an existing account), computes the streak from full completion history so a race
 * with the app-load backfill doesn't produce a wrong value of 1.
 *
 * Non-daily (not monthly): increments on every completion regardless of day.
 *   Week-level validation (reset if target missed) happens separately in computeStreakResets.
 */
export function computeCompletionStreakUpdate(
  activity: UserActivity,
  allCompletions: ActivityCompletion[],
  weekStartDay: 0 | 1 = 1
): StreakUpdate | null {
  if (activity.cadence === 'monthly') return null;

  const today = toDateStr(new Date());
  const currentStreak = activity.currentStreak ?? 0;
  const longestStreak = activity.longestStreak ?? 0;

  if (activity.cadence === 'daily') {
    const lastDate = activity.lastStreakCheckDate;
    if (lastDate === today && currentStreak > 0) return null; // already incremented today

    if (!lastDate) {
      // Not initialized yet — compute from full history plus today's completion being logged now
      const existingDates = allCompletions
        .filter(c => c.activityId === activity.id)
        .map(c => toDateStr(new Date(c.completedAt)));
      existingDates.push(today);
      const uniqueDays = [...new Set(existingDates)].sort().reverse();

      let streak = 0;
      const d = new Date(today + 'T00:00:00');
      for (const day of uniqueDays) {
        if (day === toDateStr(d)) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }

      const newLongest = Math.max(streak, longestStreak);
      return {
        activityId: activity.id,
        currentStreak: streak,
        longestStreak: newLongest,
        lastStreakCheckDate: today,
        streakVersion: STREAK_VERSION,
      };
    }

    const yesterday = getYesterdayStr();
    const newStreak = lastDate === yesterday ? currentStreak + 1 : 1;
    const newLongest = Math.max(newStreak, longestStreak);

    return {
      activityId: activity.id,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastStreakCheckDate: today,
      streakVersion: STREAK_VERSION,
    };
  }

  // Non-daily, non-monthly: always increment on completion
  const newStreak = currentStreak + 1;
  const newLongest = Math.max(newStreak, longestStreak);

  return {
    activityId: activity.id,
    currentStreak: newStreak,
    longestStreak: newLongest,
    streakVersion: STREAK_VERSION,
    // lastStreakCheckWeek is intentionally not touched here — managed by computeStreakResets
  };
}

/**
 * Called immediately after an undo. Recomputes both currentStreak and longestStreak
 * from the remaining completions so that undoing a completion that was the structural
 * basis of a streak correctly lowers the displayed best.
 *
 * Daily: walks back consecutive days from the most recent remaining completion.
 * Non-daily: walks back week by week from this week, then recomputes longest from history.
 */
export function computeUndoStreakUpdate(
  activity: UserActivity,
  remainingCompletions: ActivityCompletion[],
  weekStartDay: 0 | 1 = 1
): StreakUpdate | null {
  if (activity.cadence === 'monthly') return null;

  if (activity.cadence === 'daily') {
    const yesterday = getYesterdayStr();
    const activityCompletions = remainingCompletions.filter(c => c.activityId === activity.id);
    const uniqueDays = [...new Set(
      activityCompletions.map(c => toDateStr(new Date(c.completedAt)))
    )].sort().reverse();

    if (uniqueDays.length === 0) {
      return {
        activityId: activity.id,
        currentStreak: 0,
        longestStreak: 0,
        lastStreakCheckDate: undefined,
      };
    }

    const mostRecent = uniqueDays[0];
    let streak = 0;

    if (mostRecent >= yesterday) {
      const d = new Date(mostRecent + 'T00:00:00');
      for (const day of uniqueDays) {
        if (day === toDateStr(d)) { streak++; d.setDate(d.getDate() - 1); }
        else break;
      }
    }

    return {
      activityId: activity.id,
      currentStreak: streak,
      longestStreak: longestDailyStreak(activity.id, remainingCompletions),
      lastStreakCheckDate: mostRecent,
    };
  }

  // Non-daily: recompute current streak from remaining completions' week walk.
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const target = CADENCE_CONFIG[activity.cadence].timesPerWeek;
  const thisWeekMonday = getWeekStart(new Date(), weekStartDay);
  let currentStreak = 0;
  let weekStart = new Date(thisWeekMonday);

  for (let i = 0; i < 104; i++) {
    const weekEnd = new Date(weekStart.getTime() + msPerWeek);
    const count = remainingCompletions.filter(c => {
      if (c.activityId !== activity.id) return false;
      const d = new Date(c.completedAt);
      return d >= weekStart && d < weekEnd;
    }).length;

    if (i === 0) { currentStreak += count; }
    else { if (count < target) break; currentStreak += count; }

    weekStart = new Date(weekStart.getTime() - msPerWeek);
  }

  return {
    activityId: activity.id,
    currentStreak,
    longestStreak: longestNxWeekStreak(activity, remainingCompletions, weekStartDay),
    lastStreakCheckWeek: toDateStr(thisWeekMonday),
  };
}

/**
 * Recomputes both currentStreak and longestStreak for one activity from its full
 * completion history. Used after a backfill write so the streak reflects the newly
 * inserted past completion without waiting for the next app-load computeStreakResets.
 *
 * Pass `allCompletions` with the backfilled entry already included (optimistic).
 * Returns null for monthly (no streak tracking).
 */
export function recomputeStreakFromHistory(
  activity: UserActivity,
  allCompletions: ActivityCompletion[],
  weekStartDay: 0 | 1 = 1
): StreakUpdate | null {
  if (activity.cadence === 'monthly') return null;

  const yesterday = getYesterdayStr();
  const thisWeekMonday = getWeekStart(new Date(), weekStartDay);
  const thisWeekStr = toDateStr(thisWeekMonday);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  if (activity.cadence === 'daily') {
    const uniqueDays = [...new Set(
      allCompletions
        .filter(c => c.activityId === activity.id)
        .map(c => toDateStr(new Date(c.completedAt)))
    )].sort().reverse(); // descending for current-streak walk

    if (uniqueDays.length === 0) {
      return { activityId: activity.id, currentStreak: 0, longestStreak: 0, lastStreakCheckDate: undefined };
    }

    const mostRecent = uniqueDays[0];
    let currentStreak = 0;

    if (mostRecent >= yesterday) {
      const d = new Date(mostRecent + 'T00:00:00');
      for (const day of uniqueDays) {
        if (day === toDateStr(d)) { currentStreak++; d.setDate(d.getDate() - 1); }
        else break;
      }
    }

    return {
      activityId: activity.id,
      currentStreak,
      longestStreak: longestDailyStreak(activity.id, allCompletions),
      lastStreakCheckDate: mostRecent,
      streakVersion: STREAK_VERSION,
    };
  }

  // Nx/week: walk back from this week to compute currentStreak.
  const target = CADENCE_CONFIG[activity.cadence].timesPerWeek;
  let currentStreak = 0;
  let weekStart = new Date(thisWeekMonday); // recomputeStreakFromHistory

  for (let i = 0; i < 104; i++) {
    const weekEnd = new Date(weekStart.getTime() + msPerWeek);
    const count = allCompletions.filter(c => {
      if (c.activityId !== activity.id) return false;
      const d = new Date(c.completedAt);
      return d >= weekStart && d < weekEnd;
    }).length;

    if (i === 0) {
      currentStreak += count;
    } else {
      if (count < target) break;
      currentStreak += count;
    }

    weekStart = new Date(weekStart.getTime() - msPerWeek);
  }

  return {
    activityId: activity.id,
    currentStreak,
    longestStreak: longestNxWeekStreak(activity, allCompletions, weekStartDay),
    lastStreakCheckWeek: thisWeekStr,
    streakVersion: STREAK_VERSION,
  };
}

/**
 * Called on app load. Detects missed days (daily) and missed weekly targets (non-daily).
 * Only returns updates where a Firestore write is actually needed.
 *
 * Daily: resets streak to 0 if lastStreakCheckDate is before yesterday and streak > 0.
 * Non-daily: at each week boundary, checks whether the just-ended week met the target.
 *   If not met → reset to 0. Either way, advances lastStreakCheckWeek to this week.
 */
export function computeStreakResets(
  activities: UserActivity[],
  completions: ActivityCompletion[],
  weekStartDay: 0 | 1 = 1
): StreakUpdate[] {
  const updates: StreakUpdate[] = [];
  const yesterday = getYesterdayStr();
  const thisWeekMonday = getWeekStart(new Date(), weekStartDay);
  const thisWeekStr = toDateStr(thisWeekMonday);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  for (const activity of activities) {
    if (activity.cadence === 'monthly') continue;

    const currentStreak = activity.currentStreak ?? 0;
    const longestStreak = activity.longestStreak ?? 0;

    if (activity.cadence === 'daily') {
      const lastDate = activity.lastStreakCheckDate;
      const needsMigration = (activity.streakVersion ?? 0) < STREAK_VERSION;

      if (!lastDate || needsMigration) {
        // Not yet initialized, or initialized by an older/buggy version — recompute from completions
        const uniqueDays = [...new Set(
          completions
            .filter(c => c.activityId === activity.id)
            .map(c => toDateStr(new Date(c.completedAt)))
        )].sort().reverse(); // most recent first

        if (uniqueDays.length === 0) {
          if (needsMigration) {
            updates.push({
              activityId: activity.id,
              currentStreak: 0,
              longestStreak,
              streakVersion: STREAK_VERSION,
            });
          }
          continue;
        }

        const mostRecent = uniqueDays[0];

        if (mostRecent < yesterday) {
          updates.push({
            activityId: activity.id,
            currentStreak: 0,
            longestStreak,
            lastStreakCheckDate: mostRecent,
            streakVersion: STREAK_VERSION,
          });
          continue;
        }

        let backfillStreak = 0;
        const d = new Date(mostRecent + 'T00:00:00');
        for (const day of uniqueDays) {
          if (day === toDateStr(d)) {
            backfillStreak++;
            d.setDate(d.getDate() - 1);
          } else {
            break;
          }
        }

        const newLongest = Math.max(backfillStreak, longestStreak);
        updates.push({
          activityId: activity.id,
          currentStreak: backfillStreak,
          longestStreak: newLongest,
          lastStreakCheckDate: mostRecent,
          streakVersion: STREAK_VERSION,
        });
        continue;
      }

      // Reset if last completion was before yesterday and streak is positive
      if (currentStreak > 0 && lastDate < yesterday) {
        updates.push({
          activityId: activity.id,
          currentStreak: 0,
          longestStreak,
          // don't update lastStreakCheckDate — let the next completion set it
        });
      }
      continue;
    }

    // Non-daily: evaluate week boundaries
    const lastCheckWeek = activity.lastStreakCheckWeek;
    const needsMigrationNonDaily = (activity.streakVersion ?? 0) < STREAK_VERSION;

    if (lastCheckWeek === thisWeekStr && !needsMigrationNonDaily) continue; // already evaluated this week

    if (!lastCheckWeek || needsMigrationNonDaily) {
      // Not yet initialized, or initialized by an older/buggy version — backfill from completions
      const target = CADENCE_CONFIG[activity.cadence].timesPerWeek;
      let backfillStreak = 0;
      let weekStart = new Date(thisWeekMonday);

      for (let i = 0; i < 104; i++) { // walk back up to 2 years
        const weekEnd = new Date(weekStart.getTime() + msPerWeek);
        const count = completions.filter(c => {
          if (c.activityId !== activity.id) return false;
          const d = new Date(c.completedAt);
          return d >= weekStart && d < weekEnd;
        }).length;

        if (i === 0) {
          // Current week isn't over yet — count completions but don't validate against target
          backfillStreak += count;
        } else {
          if (count < target) break;
          backfillStreak += count;
        }

        weekStart = new Date(weekStart.getTime() - msPerWeek);
      }

      const newLongest = Math.max(backfillStreak, longestNxWeekStreak(activity, completions, weekStartDay));
      updates.push({
        activityId: activity.id,
        currentStreak: backfillStreak,
        longestStreak: newLongest,
        lastStreakCheckWeek: thisWeekStr,
        streakVersion: STREAK_VERSION,
      });
      continue;
    }

    const lastCheckMonday = new Date(lastCheckWeek + 'T00:00:00');
    const weeksPassed = Math.round(
      (thisWeekMonday.getTime() - lastCheckMonday.getTime()) / msPerWeek
    );

    if (weeksPassed > 1) {
      // One or more full weeks skipped — streak broken
      updates.push({
        activityId: activity.id,
        currentStreak: 0,
        longestStreak,
        lastStreakCheckWeek: thisWeekStr,
      });
      continue;
    }

    // weeksPassed === 1: evaluate the week that just ended
    const weekStart = lastCheckMonday;
    const weekEnd = new Date(lastCheckMonday.getTime() + msPerWeek);
    const target = CADENCE_CONFIG[activity.cadence].timesPerWeek;

    const completionsInWeek = completions.filter(c => {
      if (c.activityId !== activity.id) return false;
      const d = new Date(c.completedAt);
      return d >= weekStart && d < weekEnd;
    }).length;

    const newStreak = completionsInWeek >= target ? currentStreak : 0;

    updates.push({
      activityId: activity.id,
      currentStreak: newStreak,
      longestStreak,
      lastStreakCheckWeek: thisWeekStr,
    });
  }

  return updates;
}
