import { beforeTracking, dayLabel, daysBack, habitProgress, latestCompletionOn, startOfWeek } from '../utils/habitProgress';
import { ActivityCompletion } from '../types';

// Wednesday 2026-11-18, mid-afternoon local time.
const NOW = new Date(2026, 10, 18, 15, 0);
const at = (day: number, hour = 12) => new Date(2026, 10, day, hour);
const tick = (activityId: string, d: Date, id = `${activityId}-${d.getTime()}`): ActivityCompletion =>
  ({ id, activityId, skillId: 'Strength', completedAt: d, xpEarned: 100 }) as ActivityCompletion;

describe('habitProgress', () => {
  it('daily: settled once ticked today, not by yesterday', () => {
    const habit = { id: 'walk', cadence: 'daily' as const };
    expect(habitProgress(habit, [tick('walk', at(17))], NOW).settled).toBe(false);
    const p = habitProgress(habit, [tick('walk', at(18, 9))], NOW);
    expect(p).toMatchObject({ count: 1, target: 1, doneToday: true, settled: true, multi: false });
  });

  it('3x/week: counts days this week (Monday start) and settles for the day once ticked', () => {
    const habit = { id: 'lift', cadence: '3x/week' as const };
    // Sunday the 15th is last week; Monday the 16th counts.
    const p = habitProgress(habit, [tick('lift', at(15)), tick('lift', at(16))], NOW);
    expect(p).toMatchObject({ count: 1, target: 3, doneToday: false, settled: false, multi: true });
    const q = habitProgress(habit, [tick('lift', at(16)), tick('lift', at(18, 8))], NOW);
    expect(q).toMatchObject({ count: 2, doneToday: true, settled: true });
  });

  it('two ticks on the same day count once', () => {
    const habit = { id: 'lift', cadence: '2x/week' as const };
    const p = habitProgress(habit, [tick('lift', at(18, 8)), tick('lift', at(18, 14))], NOW);
    expect(p.count).toBe(1);
  });

  it('a Sunday week start includes Sunday', () => {
    expect(startOfWeek(NOW, 0).getDate()).toBe(15);
    expect(startOfWeek(NOW, 1).getDate()).toBe(16);
    const habit = { id: 'swim', cadence: 'weekly' as const };
    expect(habitProgress(habit, [tick('swim', at(15))], NOW, 0).settled).toBe(true);
    expect(habitProgress(habit, [tick('swim', at(15))], NOW, 1).settled).toBe(false);
  });

  it('monthly and 2x/month count from the 1st', () => {
    expect(habitProgress({ id: 'm', cadence: 'monthly' }, [tick('m', at(2))], NOW).settled).toBe(true);
    const p = habitProgress({ id: 'b', cadence: '2x/month' }, [tick('b', at(2))], NOW);
    expect(p).toMatchObject({ count: 1, target: 2, settled: false });
  });

  it('ignores other habits', () => {
    expect(habitProgress({ id: 'walk', cadence: 'daily' }, [tick('run', at(18))], NOW).count).toBe(0);
  });
});

describe('latestCompletionOn', () => {
  it('returns the newest of today’s ticks for that habit', () => {
    const list = [tick('walk', at(18, 8), 'a'), tick('walk', at(18, 13), 'b'), tick('walk', at(17), 'c')];
    expect(latestCompletionOn(list, 'walk', NOW)?.id).toBe('b');
    expect(latestCompletionOn(list, 'run', NOW)).toBeUndefined();
  });
});

describe('past days', () => {
  it('latestCompletionOn finds a past day’s tick', () => {
    const list = [tick('walk', at(16), 'old'), tick('walk', at(18), 'today')];
    expect(latestCompletionOn(list, 'walk', at(16, 0))?.id).toBe('old');
    expect(latestCompletionOn(list, 'walk', at(17, 0))).toBeUndefined();
  });

  it('daysBack steps back whole days from the start of today', () => {
    expect(daysBack(NOW, 0)).toEqual(new Date(2026, 10, 18));
    expect(daysBack(NOW, 3)).toEqual(new Date(2026, 10, 15));
    expect(daysBack(NOW, 18)).toEqual(new Date(2026, 9, 31));
  });

  it('dayLabel says Today and Yesterday, then the date', () => {
    expect(dayLabel(daysBack(NOW, 0), NOW)).toBe('Today');
    expect(dayLabel(daysBack(NOW, 1), NOW)).toBe('Yesterday');
    const label = dayLabel(daysBack(NOW, 2), NOW);
    expect(label).not.toMatch(/Today|Yesterday/);
    expect(label).toContain('16');
  });

  it('progress on a past day counts up to that day only', () => {
    const list = [tick('w', at(16)), tick('w', at(18))];
    const p = habitProgress({ id: 'w', cadence: '3x/week' }, list, at(17));
    expect(p).toMatchObject({ count: 1, doneToday: false, settled: false });
  });

  it('beforeTracking locks days before the habit was added', () => {
    expect(beforeTracking(at(17, 9), at(16, 0))).toBe(true);
    expect(beforeTracking(at(17, 9), at(17, 0))).toBe(false);
    expect(beforeTracking(undefined, at(1, 0))).toBe(false);
  });
});
