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
// 2x/month streaks were judged weekly (target 0.5) before v3; bumping only this
// cadence's version recomputes those once without touching other cadences.
const MONTH_PERIOD_VERSION = 3;

// ── streak periods ────────────────────────────────────────────────────────────
// Non-daily cadences are judged per period: a week for Nx/week and weekly, a
// calendar month for 2x/month. `lastStreakCheckWeek` stores the start date of
// the last evaluated period (a week start, or the 1st of a month).

function usesMonthPeriod(cadence: UserActivity['cadence']): boolean {
  return cadence === '2x/month';
}

function versionFor(cadence: UserActivity['cadence']): number {
  return usesMonthPeriod(cadence) ? MONTH_PERIOD_VERSION : STREAK_VERSION;
}

function periodStart(date: Date, cadence: UserActivity['cadence'], weekStartDay: 0 | 1): Date {
  if (usesMonthPeriod(cadence)) return new Date(date.getFullYear(), date.getMonth(), 1);
  return getWeekStart(date, weekStartDay);
}

function shiftPeriod(start: Date, cadence: UserActivity['cadence'], n: number): Date {
  if (usesMonthPeriod(cadence)) return new Date(start.getFullYear(), start.getMonth() + n, 1);
  const d = new Date(start);
  d.setDate(d.getDate() + 7 * n);
  return d;
}

function periodsBetween(from: Date, to: Date, cadence: UserActivity['cadence']): number {
  if (usesMonthPeriod(cadence)) {
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  }
  return Math.round((to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function periodTarget(cadence: UserActivity['cadence']): number {
  if (usesMonthPeriod(cadence)) return 2;
  return CADENCE_CONFIG[cadence].timesPerWeek;
}

function countInPeriod(
  activityId: string,
  completions: ActivityCompletion[],
  start: Date,
  cadence: UserActivity['cadence']
): number {
  const end = shiftPeriod(start, cadence, 1);
  return completions.filter(c => {
    if (c.activityId !== activityId) return false;
    const d = new Date(c.completedAt);
    return d >= start && d < end;
  }).length;
}

/**
 * Current streak for a non-daily activity: completions in the current (unfinished)
 * period, plus every earlier consecutive period that met its target.
 */
function walkBackPeriodStreak(
  activity: UserActivity,
  completions: ActivityCompletion[],
  weekStartDay: 0 | 1
): number {
  const target = periodTarget(activity.cadence);
  const maxPeriods = usesMonthPeriod(activity.cadence) ? 24 : 104; // ~2 years
  let start = periodStart(new Date(), activity.cadence, weekStartDay);
  let streak = 0;
  for (let i = 0; i < maxPeriods; i++) {
    const count = countInPeriod(activity.id, completions, start, activity.cadence);
    if (i === 0) streak += count; // current period isn't over yet
    else if (count < target) break;
    else streak += count;
    start = shiftPeriod(start, activity.cadence, -1);
  }
  return streak;
}

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
  const target = periodTarget(activity.cadence);
  const activityCompletions = allCompletions.filter(c => c.activityId === activity.id);
  if (activityCompletions.length === 0) return 0;

  const earliestDate = activityCompletions.reduce<Date>(
    (min, c) => { const d = new Date(c.completedAt); return d < min ? d : min; },
    new Date(activityCompletions[0].completedAt)
  );
  const currentPeriod = periodStart(new Date(), activity.cadence, weekStartDay);

  let longest = 0;
  let current = 0;
  let start = periodStart(earliestDate, activity.cadence, weekStartDay);

  while (start <= currentPeriod) {
    const count = countInPeriod(activity.id, activityCompletions, start, activity.cadence);
    const isCurrent = start.getTime() === currentPeriod.getTime();

    if (isCurrent || count >= target) {
      current += count;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }

    start = shiftPeriod(start, activity.cadence, 1);
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

  // Non-daily: recompute the current streak by walking back period by period.
  return {
    activityId: activity.id,
    currentStreak: walkBackPeriodStreak(activity, remainingCompletions, weekStartDay),
    longestStreak: longestNxWeekStreak(activity, remainingCompletions, weekStartDay),
    lastStreakCheckWeek: toDateStr(periodStart(new Date(), activity.cadence, weekStartDay)),
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

  // Non-daily: walk back period by period (weeks, or months for 2x/month).
  return {
    activityId: activity.id,
    currentStreak: walkBackPeriodStreak(activity, allCompletions, weekStartDay),
    longestStreak: longestNxWeekStreak(activity, allCompletions, weekStartDay),
    lastStreakCheckWeek: toDateStr(periodStart(new Date(), activity.cadence, weekStartDay)),
    streakVersion: versionFor(activity.cadence),
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

    // Non-daily: evaluate period boundaries (weeks, or calendar months for 2x/month)
    const lastCheck = activity.lastStreakCheckWeek;
    const currentPeriod = periodStart(new Date(), activity.cadence, weekStartDay);
    const currentPeriodStr = toDateStr(currentPeriod);
    const needsMigrationNonDaily = (activity.streakVersion ?? 0) < versionFor(activity.cadence);

    if (lastCheck === currentPeriodStr && !needsMigrationNonDaily) continue; // already evaluated

    if (!lastCheck || needsMigrationNonDaily) {
      // Not yet initialized, or written by an older/buggy version: rebuild from completions
      const backfillStreak = walkBackPeriodStreak(activity, completions, weekStartDay);
      const newLongest = Math.max(backfillStreak, longestNxWeekStreak(activity, completions, weekStartDay));
      updates.push({
        activityId: activity.id,
        currentStreak: backfillStreak,
        longestStreak: newLongest,
        lastStreakCheckWeek: currentPeriodStr,
        streakVersion: versionFor(activity.cadence),
      });
      continue;
    }

    const lastPeriod = new Date(lastCheck + 'T00:00:00');
    const periodsPassed = periodsBetween(lastPeriod, currentPeriod, activity.cadence);

    if (periodsPassed > 1) {
      // One or more full periods skipped: streak broken
      updates.push({
        activityId: activity.id,
        currentStreak: 0,
        longestStreak,
        lastStreakCheckWeek: currentPeriodStr,
      });
      continue;
    }

    // periodsPassed === 1: evaluate the period that just ended
    const countInLast = countInPeriod(activity.id, completions, lastPeriod, activity.cadence);
    const newStreak = countInLast >= periodTarget(activity.cadence) ? currentStreak : 0;

    updates.push({
      activityId: activity.id,
      currentStreak: newStreak,
      longestStreak,
      lastStreakCheckWeek: currentPeriodStr,
    });
  }

  return updates;
}
