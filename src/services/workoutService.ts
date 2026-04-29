import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { WorkoutTemplate, TemplateExercise, WorkoutSession, SetLog, WeightUnit } from '../types';

// ─── Templates ────────────────────────────────────────────────────────────────

export function subscribeToWorkoutTemplates(
  userId: string,
  callback: (templates: WorkoutTemplate[]) => void
): Unsubscribe {
  const ref = collection(db, 'users', userId, 'workoutTemplates');
  return onSnapshot(ref, snapshot => {
    const templates: WorkoutTemplate[] = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        linkedSkillId: data.linkedSkillId ?? undefined,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
      };
    });
    templates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    callback(templates);
  });
}

export async function createWorkoutTemplate(
  userId: string,
  name: string,
  linkedSkillId?: string
): Promise<string> {
  const ref = doc(collection(db, 'users', userId, 'workoutTemplates'));
  await setDoc(ref, {
    name: name.trim(),
    linkedSkillId: linkedSkillId ?? null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateWorkoutTemplate(
  userId: string,
  templateId: string,
  name: string,
  linkedSkillId?: string
): Promise<void> {
  const ref = doc(db, 'users', userId, 'workoutTemplates', templateId);
  await setDoc(ref, { name: name.trim(), linkedSkillId: linkedSkillId ?? null, updatedAt: Timestamp.now() }, { merge: true });
}

/** Deletes the template and all its exercises in one batch. */
export async function deleteWorkoutTemplate(
  userId: string,
  templateId: string
): Promise<void> {
  const exercisesRef = collection(db, 'users', userId, 'workoutTemplates', templateId, 'exercises');
  const snap = await getDocs(exercisesRef);
  const batch = writeBatch(db);
  snap.forEach(ex => batch.delete(ex.ref));
  batch.delete(doc(db, 'users', userId, 'workoutTemplates', templateId));
  await batch.commit();
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export function subscribeToExercises(
  userId: string,
  templateId: string,
  callback: (exercises: TemplateExercise[]) => void
): Unsubscribe {
  const ref = collection(db, 'users', userId, 'workoutTemplates', templateId, 'exercises');
  const q = query(ref, orderBy('sortOrder', 'asc'));
  return onSnapshot(q, snapshot => {
    const exercises: TemplateExercise[] = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        templateId,
        name: data.name,
        defaultSets: data.defaultSets,
        repRange: data.repRange ?? undefined,
        sortOrder: data.sortOrder,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
      };
    });
    callback(exercises);
  });
}

export async function addExercise(
  userId: string,
  templateId: string,
  name: string,
  defaultSets: number,
  sortOrder: number,
  repRange?: string
): Promise<void> {
  const ref = doc(collection(db, 'users', userId, 'workoutTemplates', templateId, 'exercises'));
  await setDoc(ref, {
    name: name.trim(),
    defaultSets,
    repRange: repRange?.trim() || null,
    sortOrder,
    createdAt: Timestamp.now(),
  });
}

export async function updateExercise(
  userId: string,
  templateId: string,
  exerciseId: string,
  name: string,
  defaultSets: number,
  repRange?: string
): Promise<void> {
  const ref = doc(db, 'users', userId, 'workoutTemplates', templateId, 'exercises', exerciseId);
  await setDoc(ref, { name: name.trim(), defaultSets, repRange: repRange?.trim() || null }, { merge: true });
}

export async function deleteExercise(
  userId: string,
  templateId: string,
  exerciseId: string
): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'workoutTemplates', templateId, 'exercises', exerciseId));
}

/** One-time fetch of exercises for a template (stable snapshot for active sessions). */
export async function getExercises(
  userId: string,
  templateId: string
): Promise<TemplateExercise[]> {
  const ref = collection(db, 'users', userId, 'workoutTemplates', templateId, 'exercises');
  const q = query(ref, orderBy('sortOrder', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      templateId,
      name: data.name,
      defaultSets: data.defaultSets,
      repRange: data.repRange ?? undefined,
      sortOrder: data.sortOrder,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    };
  });
}

/** Batch-writes the sortOrder of every exercise to match the given array's index. */
export async function reorderExercises(
  userId: string,
  templateId: string,
  exercises: TemplateExercise[]
): Promise<void> {
  const batch = writeBatch(db);
  exercises.forEach((ex, i) => {
    const ref = doc(db, 'users', userId, 'workoutTemplates', templateId, 'exercises', ex.id);
    batch.update(ref, { sortOrder: i });
  });
  await batch.commit();
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createWorkoutSession(
  userId: string,
  templateId: string,
  templateName: string
): Promise<string> {
  const ref = doc(collection(db, 'users', userId, 'workoutSessions'));
  await setDoc(ref, {
    templateId,
    templateName,
    startedAt: Timestamp.now(),
    completedAt: null,
  });
  return ref.id;
}

export async function completeWorkoutSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const ref = doc(db, 'users', userId, 'workoutSessions', sessionId);
  await setDoc(ref, { completedAt: Timestamp.now() }, { merge: true });
}

/** Deletes all set logs and the session document — used when abandoning mid-session. */
export async function abandonWorkoutSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const setsRef = collection(db, 'users', userId, 'workoutSessions', sessionId, 'sets');
  const snap = await getDocs(setsRef);
  const batch = writeBatch(db);
  snap.forEach(s => batch.delete(s.ref));
  batch.delete(doc(db, 'users', userId, 'workoutSessions', sessionId));
  await batch.commit();
}

// ─── Set logs ─────────────────────────────────────────────────────────────────

export async function logSet(
  userId: string,
  sessionId: string,
  exerciseId: string,
  exerciseName: string,
  setNumber: number,
  reps: number | null,
  weight: number | null,
  unit: WeightUnit
): Promise<string> {
  const ref = doc(collection(db, 'users', userId, 'workoutSessions', sessionId, 'sets'));
  await setDoc(ref, {
    exerciseId,
    exerciseName,
    setNumber,
    reps,
    weight,
    unit,
    completedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function deleteSetLog(
  userId: string,
  sessionId: string,
  setLogId: string
): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'workoutSessions', sessionId, 'sets', setLogId));
}

// ─── Share / Import ───────────────────────────────────────────────────────────

function generateShareCode(): string {
  // Avoids ambiguous chars (0/O, 1/I/L)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Bundles one or more templates (with their exercises) into a single
 * top-level `sharedTemplates/{code}` document that anyone can read.
 * Returns the 6-character share code.
 */
export async function shareTemplates(
  userId: string,
  templateIds: string[]
): Promise<string> {
  const snapshots = await Promise.all(
    templateIds.map(async tid => {
      const tSnap = await getDoc(doc(db, 'users', userId, 'workoutTemplates', tid));
      if (!tSnap.exists()) return null;
      const data = tSnap.data();
      const exercises = await getExercises(userId, tid);
      return {
        name: data.name,
        linkedSkillId: data.linkedSkillId ?? null,
        exercises: exercises.map(e => ({
          name: e.name,
          defaultSets: e.defaultSets,
          repRange: e.repRange ?? null,
          sortOrder: e.sortOrder,
        })),
      };
    })
  );

  const templates = snapshots.filter(Boolean);
  if (templates.length === 0) throw new Error('No valid templates to share');

  const code = generateShareCode();
  await setDoc(doc(db, 'sharedTemplates', code), {
    templates,
    createdAt: Timestamp.now(),
    createdBy: userId,
  });
  return code;
}

/**
 * Reads a share bundle and copies every template + exercises into
 * the recipient's account. Returns the number of templates imported.
 */
export async function importSharedTemplates(
  userId: string,
  code: string
): Promise<number> {
  const snap = await getDoc(doc(db, 'sharedTemplates', code.trim().toUpperCase()));
  if (!snap.exists()) throw new Error('Code not found. Check the code and try again.');

  const { templates } = snap.data() as { templates: any[] };

  for (const tmpl of templates) {
    const newId = await createWorkoutTemplate(userId, tmpl.name, tmpl.linkedSkillId ?? undefined);
    if (tmpl.exercises?.length) {
      const batch = writeBatch(db);
      (tmpl.exercises as any[]).forEach(ex => {
        const ref = doc(collection(db, 'users', userId, 'workoutTemplates', newId, 'exercises'));
        batch.set(ref, {
          name: ex.name,
          defaultSets: ex.defaultSets,
          repRange: ex.repRange ?? null,
          sortOrder: ex.sortOrder,
          createdAt: Timestamp.now(),
        });
      });
      await batch.commit();
    }
  }

  return templates.length;
}
