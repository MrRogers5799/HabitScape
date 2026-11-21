/**
 * The workout session in progress, saved on the phone as the player types, so it survives
 * leaving the screen, switching apps or the app being closed. It stays until the player
 * finishes or discards it (owner request, 2026-11-20). One per account. The session's
 * Firestore document and finished exercises' sets are already saved as they happen; this
 * keeps everything else: typed weights and reps, extra sets, order, unit and start time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TemplateExercise, WeightUnit } from '../types';

export interface DraftSet { key: string; weight: string; reps: string; isDefault: boolean; setLogId?: string }
export interface DraftExercise { exercise: TemplateExercise; sets: DraftSet[]; completed: boolean }

export interface ActiveWorkout {
  sessionId: string;
  templateId: string;
  templateName: string;
  /** ISO date when logging a past day; absent for a live session. */
  backdateDate?: string;
  /** When the session started (ms), for the timer. */
  startedAt: number;
  unit: WeightUnit;
  items: DraftExercise[];
}

const key = (uid: string) => `habitscape.activeWorkout.${uid}`;

/** A stored value back into a session, or null if it's missing or not one (older format, corrupt). */
export function parseActiveWorkout(raw: string | null): ActiveWorkout | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const ok = v && typeof v.sessionId === 'string' && typeof v.templateId === 'string' && typeof v.templateName === 'string'
      && typeof v.startedAt === 'number' && (v.unit === 'lbs' || v.unit === 'kg') && Array.isArray(v.items)
      && v.items.every((i: DraftExercise) => i && i.exercise && typeof i.exercise.id === 'string' && Array.isArray(i.sets));
    if (!ok) return null;
    // Firestore Timestamps don't survive JSON; the screens only need the exercise's plain fields.
    return v as ActiveWorkout;
  } catch {
    return null;
  }
}

export async function loadActiveWorkout(uid: string): Promise<ActiveWorkout | null> {
  try {
    return parseActiveWorkout(await AsyncStorage.getItem(key(uid)));
  } catch {
    return null;
  }
}

export async function saveActiveWorkout(uid: string, w: ActiveWorkout): Promise<void> {
  await AsyncStorage.setItem(key(uid), JSON.stringify(w)).catch(() => {});
}

export async function clearActiveWorkout(uid: string): Promise<void> {
  await AsyncStorage.removeItem(key(uid)).catch(() => {});
}

/** "12:05" for a live session; "Nov 18" for a past day being logged. */
export function activeWorkoutClock(w: Pick<ActiveWorkout, 'startedAt' | 'backdateDate'>, nowMs: number): string {
  if (w.backdateDate) return new Date(w.backdateDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const s = Math.max(0, Math.floor((nowMs - w.startedAt) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
