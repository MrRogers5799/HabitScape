/**
 * Workout progress maths, shared by the workout screens: volume, estimated one-rep
 * max (Epley) and personal records per exercise across a workout's sessions.
 */
import { SetLog, WorkoutSession } from '../types';

export type SessionEntry = { session: WorkoutSession; sets: SetLog[] };

export type ProgressPoint = {
  date: Date;
  /** Σ(weight × reps) across the exercise's sets that session. */
  volume: number;
  /** Heaviest single set. */
  maxWeight: number;
  /** Epley: the best weight × (1 + reps / 30) among the sets. */
  est1RM: number;
  /** Volume beat every earlier session of this exercise. */
  isPR: boolean;
};

export type ExerciseProgress = { name: string; unit: string; points: ProgressPoint[] };

/** 950 → "950", 12,400 → "12.4k", 2,300,000 → "2.3M". */
export function formatVolume(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(Math.round(v));
}

export const setVolume = (s: Pick<SetLog, 'weight' | 'reps'>) => (s.weight ?? 0) * (s.reps ?? 0);
export const totalVolume = (sets: Pick<SetLog, 'weight' | 'reps'>[]) => sets.reduce((sum, s) => sum + setVolume(s), 0);

export function est1RM(sets: Pick<SetLog, 'weight' | 'reps'>[]): number {
  let best = 0;
  for (const s of sets) {
    if (!s.weight || !s.reps || s.reps <= 0) continue;
    best = Math.max(best, s.weight * (1 + s.reps / 30));
  }
  return Math.round(best);
}

/** Sets grouped by exercise name, in the order they first appear. */
export function groupByExercise(sets: SetLog[]): [string, SetLog[]][] {
  const map = new Map<string, SetLog[]>();
  for (const s of sets) {
    if (!map.has(s.exerciseName)) map.set(s.exerciseName, []);
    map.get(s.exerciseName)!.push(s);
  }
  return [...map.entries()];
}

/** Per-exercise progress, oldest session first; `history` must be oldest first too. */
export function exerciseProgress(history: SessionEntry[]): ExerciseProgress[] {
  const map = new Map<string, ExerciseProgress>();
  for (const { session, sets } of history) {
    if (!session.completedAt) continue;
    for (const [name, exSets] of groupByExercise(sets)) {
      if (!map.has(name)) map.set(name, { name, unit: exSets[0].unit, points: [] });
      const ep = map.get(name)!;
      const volume = totalVolume(exSets);
      const best = ep.points.reduce((m, p) => Math.max(m, p.volume), -Infinity);
      ep.points.push({
        date: session.completedAt,
        volume,
        maxWeight: Math.max(0, ...exSets.map((s) => s.weight ?? 0)),
        est1RM: est1RM(exSets),
        isPR: ep.points.length > 0 && volume > best,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
