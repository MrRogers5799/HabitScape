/**
 * How far a habit is through its current period (day, week or month), and whether it can
 * be ticked again today. Same rules as the live Activities screen: completions count once
 * per day, and an Nx/week or 2x/month habit can be ticked at most once a day.
 */
import { CADENCE_CONFIG } from '../constants/cadences';
import { ActivityCompletion, Cadence } from '../types';

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export function startOfWeek(d: Date, weekStartDay: 0 | 1 = 1): Date {
  const back = weekStartDay === 1 ? (d.getDay() === 0 ? 6 : d.getDay() - 1) : d.getDay();
  const start = startOfDay(d);
  start.setDate(start.getDate() - back);
  return start;
}

/** Cadences that allow more than one tick per period but only one per day. */
const SPREAD_OUT: Cadence[] = ['6x/week', '5x/week', '4x/week', '3x/week', '2x/week', '2x/month'];

export interface HabitProgress {
  /** Days ticked so far this period. */
  count: number;
  /** Ticks the period asks for. */
  target: number;
  /** Ticked today. */
  doneToday: boolean;
  /** Nothing more to tick today: the period is met, or a spread-out habit was already ticked today. */
  settled: boolean;
  /** Shows as "count/target" rather than a single tick. */
  multi: boolean;
}

function daysTicked(completions: ActivityCompletion[], activityId: string, from: Date, to: Date): number {
  const days = new Set<number>();
  for (const c of completions) {
    if (c.activityId !== activityId) continue;
    const at = new Date(c.completedAt);
    if (at >= from && at <= to) days.add(startOfDay(at).getTime());
  }
  return days.size;
}

export function habitProgress(
  activity: { id: string; cadence: Cadence },
  completions: ActivityCompletion[],
  now: Date,
  weekStartDay: 0 | 1 = 1,
): HabitProgress {
  const end = endOfDay(now);
  const { cadence } = activity;
  let from: Date;
  let target = 1;
  if (cadence === 'daily') from = startOfDay(now);
  else if (cadence === 'monthly') from = startOfMonth(now);
  else if (cadence === '2x/month') { from = startOfMonth(now); target = 2; }
  else if (cadence === 'weekly') from = startOfWeek(now, weekStartDay);
  else { from = startOfWeek(now, weekStartDay); target = CADENCE_CONFIG[cadence].timesPerWeek; }

  const count = daysTicked(completions, activity.id, from, end);
  const doneToday = daysTicked(completions, activity.id, startOfDay(now), end) > 0;
  const multi = SPREAD_OUT.includes(cadence);
  return { count, target, doneToday, settled: count >= target || (multi && doneToday), multi };
}

/** A habit's newest completion on the given day, for undoing a tick. */
export function latestCompletionOn(completions: ActivityCompletion[], activityId: string, day: Date): ActivityCompletion | undefined {
  const from = startOfDay(day);
  const to = endOfDay(day);
  return completions
    .filter((c) => c.activityId === activityId && new Date(c.completedAt) >= from && new Date(c.completedAt) <= to)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
}

/** How many days back a habit can be ticked (PROG-005), on the live Activities screen and on Today. */
export const MAX_BACKFILL_DAYS = 14;

/** The start of the day `back` days before `now`. */
export function daysBack(now: Date, back: number): Date {
  const d = startOfDay(now);
  d.setDate(d.getDate() - back);
  return d;
}

/** "Today", "Yesterday", otherwise e.g. "Wed, Nov 18". */
export function dayLabel(day: Date, now: Date): string {
  const back = Math.round((startOfDay(now).getTime() - startOfDay(day).getTime()) / 86_400_000);
  if (back === 0) return 'Today';
  if (back === 1) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** The habit wasn't being tracked yet on that day, so it can't be ticked (PROG-005). */
export function beforeTracking(selectedAt: Date | undefined, day: Date): boolean {
  return !!selectedAt && startOfDay(day) < startOfDay(new Date(selectedAt));
}
