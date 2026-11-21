import { habitProgress, latestCompletionToday, startOfWeek } from '../utils/habitProgress';
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

describe('latestCompletionToday', () => {
  it('returns the newest of today’s ticks for that habit', () => {
    const list = [tick('walk', at(18, 8), 'a'), tick('walk', at(18, 13), 'b'), tick('walk', at(17), 'c')];
    expect(latestCompletionToday(list, 'walk', NOW)?.id).toBe('b');
    expect(latestCompletionToday(list, 'run', NOW)).toBeUndefined();
  });
});
