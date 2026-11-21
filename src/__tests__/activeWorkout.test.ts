import { activeWorkoutClock, ActiveWorkout, parseActiveWorkout } from '../services/activeWorkout';

// babel-jest hoists this above the import.
jest.mock('@react-native-async-storage/async-storage', () => ({}));

const workout: ActiveWorkout = {
  sessionId: 's1', templateId: 't1', templateName: 'Push', startedAt: 1_000_000, unit: 'kg',
  items: [{
    exercise: { id: 'e1', templateId: 't1', name: 'Bench', defaultSets: 3, order: 0 } as unknown as ActiveWorkout['items'][0]['exercise'],
    sets: [{ key: 'a', weight: '60', reps: '8', isDefault: true }],
    completed: false,
  }],
};

describe('parseActiveWorkout', () => {
  it('round-trips a saved session', () => {
    expect(parseActiveWorkout(JSON.stringify(workout))).toEqual(workout);
  });
  it('rejects missing, corrupt or wrong-shaped values', () => {
    expect(parseActiveWorkout(null)).toBeNull();
    expect(parseActiveWorkout('{not json')).toBeNull();
    expect(parseActiveWorkout(JSON.stringify({ ...workout, unit: 'stone' }))).toBeNull();
    expect(parseActiveWorkout(JSON.stringify({ ...workout, items: [{ sets: [] }] }))).toBeNull();
    expect(parseActiveWorkout(JSON.stringify({ ...workout, startedAt: 'yesterday' }))).toBeNull();
  });
});

describe('activeWorkoutClock', () => {
  it('counts up from the start', () => {
    expect(activeWorkoutClock(workout, 1_000_000 + 65_000)).toBe('1:05');
    expect(activeWorkoutClock(workout, 1_000_000 + 3_725_000)).toBe('1:02:05');
    expect(activeWorkoutClock(workout, 0)).toBe('0:00');
  });
  it('shows the day when logging a past day', () => {
    expect(activeWorkoutClock({ ...workout, backdateDate: new Date(2026, 10, 18, 12).toISOString() }, 0)).toMatch(/18/);
  });
});
