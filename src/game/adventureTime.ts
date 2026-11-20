/**
 * Adventure time (PROG-022): habits earn hours, capped per week, banked, and
 * paid back first when in debt (PROG-025).
 */
import { BANK_HOURS_CAP, HOURS_PER_HABIT_XP, WEEKLY_HOURS_CAP } from './rules';
import { AdventureTime, TimeGrant } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Starts a new week's count when the caller's week id has moved on. */
function forWeek(time: AdventureTime, weekId: string): AdventureTime {
  return time.weekId === weekId ? time : { ...time, weekId, weekEarnedHours: 0 };
}

/**
 * A habit was completed. Returns the new time and exactly what was granted, so
 * unticking can take back the same amount. Hours past the weekly cap aren't earned;
 * hours past the bank cap spill.
 */
export function earnFromHabit(
  time: AdventureTime,
  habitXP: number,
  weekId: string,
): { time: AdventureTime; grant: TimeGrant; spilledHours: number } {
  const t = forWeek(time, weekId);
  const raw = Math.max(0, habitXP) * HOURS_PER_HABIT_XP;
  const weekHours = round2(Math.max(0, Math.min(raw, WEEKLY_HOURS_CAP - t.weekEarnedHours)));
  const bankHours = round2(Math.max(0, Math.min(weekHours, BANK_HOURS_CAP - t.bankHours)));
  return {
    time: { ...t, weekEarnedHours: round2(t.weekEarnedHours + weekHours), bankHours: round2(t.bankHours + bankHours) },
    grant: { weekHours, bankHours },
    spilledHours: round2(weekHours - bankHours),
  };
}

/**
 * A habit was unticked: take back what it granted. The bank may go negative;
 * the caller then claws back unstarted trip time (see clawBackForDebt in trips.ts).
 */
export function untickHabit(time: AdventureTime, grant: TimeGrant, grantWeekId: string): AdventureTime {
  const sameWeek = time.weekId === grantWeekId;
  return {
    ...time,
    bankHours: round2(time.bankHours - grant.bankHours),
    weekEarnedHours: sameWeek ? round2(Math.max(0, time.weekEarnedHours - grant.weekHours)) : time.weekEarnedHours,
  };
}

export const isInDebt = (time: AdventureTime) => time.bankHours < 0;
