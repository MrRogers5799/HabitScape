import { est1RM, exerciseProgress, formatVolume, groupByExercise, SessionEntry, totalVolume } from '../utils/workoutProgress';
import { SetLog, WorkoutSession } from '../types';

const set = (exerciseName: string, weight: number | null, reps: number | null, n = 1): SetLog => ({
  id: `${exerciseName}-${n}-${weight}-${reps}`, sessionId: 's', exerciseId: exerciseName, exerciseName,
  setNumber: n, weight, reps, unit: 'lbs', completedAt: new Date(2026, 10, 1),
});
const session = (day: number, completed = true): WorkoutSession => ({
  id: `s${day}`, templateId: 't', templateName: 'Push', startedAt: new Date(2026, 10, day, 10),
  completedAt: completed ? new Date(2026, 10, day, 11) : null,
});

describe('formatVolume', () => {
  it('shortens thousands and millions', () => {
    expect(formatVolume(950)).toBe('950');
    expect(formatVolume(12400)).toBe('12.4k');
    expect(formatVolume(2_300_000)).toBe('2.3M');
    expect(formatVolume(-1500)).toBe('-1.5k');
  });
});

describe('volume and est1RM', () => {
  it('ignores sets with no weight or reps', () => {
    const sets = [set('Bench', 100, 10), set('Bench', null, 8), set('Bench', 120, null)];
    expect(totalVolume(sets)).toBe(1000);
    expect(est1RM(sets)).toBe(133); // 100 × (1 + 10/30)
  });
  it('is 0 with nothing logged', () => {
    expect(est1RM([])).toBe(0);
  });
});

describe('groupByExercise', () => {
  it('keeps first-seen order', () => {
    const groups = groupByExercise([set('Row', 50, 10), set('Bench', 100, 5), set('Row', 55, 8, 2)]);
    expect(groups.map(([n, s]) => [n, s.length])).toEqual([['Row', 2], ['Bench', 1]]);
  });
});

describe('exerciseProgress', () => {
  const history: SessionEntry[] = [
    { session: session(1), sets: [set('Bench', 100, 10)] },
    { session: session(3), sets: [set('Bench', 100, 8), set('Squat', 150, 5)] },
    { session: session(4, false), sets: [set('Bench', 200, 10)] }, // abandoned: skipped
    { session: session(5), sets: [set('Bench', 110, 10)] },
  ];
  const progress = exerciseProgress(history);

  it('sorts exercises by name and skips unfinished sessions', () => {
    expect(progress.map((p) => p.name)).toEqual(['Bench', 'Squat']);
    expect(progress[0].points.map((p) => p.volume)).toEqual([1000, 800, 1100]);
  });

  it('marks a PR only when volume beats every earlier session', () => {
    expect(progress[0].points.map((p) => p.isPR)).toEqual([false, false, true]);
    expect(progress[1].points[0].isPR).toBe(false);
  });

  it('records max weight and est1RM per session', () => {
    expect(progress[0].points[2]).toMatchObject({ maxWeight: 110, est1RM: 147 });
  });
});
