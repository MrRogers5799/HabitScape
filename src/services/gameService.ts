/**
 * Adventure (beta) game layer: Firestore reads and writes (PROD-018, PLAT-008).
 *
 * The rules live in src/game (pure, tested); this file only loads and saves them.
 * Every change runs in a transaction that reads the adventurer and its active trip,
 * applies a pure function, and saves with `rev` raised by one (the security rules
 * require that, so a stale device can't overwrite newer progress).
 *
 * Layout: users/{uid}/game/adventurer and users/{uid}/trips/{tripId}.
 */
import { collection, doc, onSnapshot, runTransaction, serverTimestamp, Unsubscribe, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  advanceTrip, callBack, clawBackForDebt, earnFromHabit, emptyReport, fillOrder, GameState, LegPlan, newAdventurer,
  queueLegs, queueRunning, removeQueuedLeg, reportHasNews, resizeQueuedLeg, TimeGrant, Trip, TripReport, untickHabit, applyLamp,
} from '../game';
import { ADVENTURER_DOC, fromAdventurerDoc, fromTripDoc, mergeReports, toAdventurerDoc, toTripDoc, weekIdFor } from '../game/persistence';
import { habitAdventureXP } from '../game/content/habitTiers';
import { setCompletionTimeGrant } from './firestoreService';

const adventurerRef = (uid: string) => doc(db, 'users', uid, 'game', ADVENTURER_DOC);
const tripRef = (uid: string, tripId: string) => doc(db, 'users', uid, 'trips', tripId);

export interface ActiveTrip {
  /** The adventurer's queue (PROG-045). */
  trip: Trip;
  /** What the queue has produced since the player last looked (the log, PROG-045). */
  report: TripReport;
  /** When the player last cleared the log of a finished queue. */
  seenMs: number | null;
}

export interface GameSnapshot {
  state: GameState;
  rev: number;
  activeTrip: ActiveTrip | null;
}

/** What a change returns: the new state, and the active trip (or null to clear it). */
export interface GameChange<T = void> {
  state: GameState;
  activeTrip: ActiveTrip | null;
  result: T;
}

/**
 * Runs a change against the latest saved game in a transaction and saves the result.
 * `weekId` is the user's current week (see weekIdFor) so adventure time rolls over correctly.
 */
export async function updateGame<T>(uid: string, weekId: string, change: (g: GameSnapshot) => GameChange<T>): Promise<T> {
  return runTransaction(db, async (tx) => {
    const advSnap = await tx.get(adventurerRef(uid));
    if (!advSnap.exists()) throw new Error('Adventure not started');
    const loaded = fromAdventurerDoc(advSnap.data(), weekId);
    let activeTrip: ActiveTrip | null = null;
    if (loaded.activeTripId) {
      const tripSnap = await tx.get(tripRef(uid, loaded.activeTripId));
      if (tripSnap.exists()) activeTrip = fromTripDoc(loaded.activeTripId, tripSnap.data());
    }
    const out = change({ state: loaded.state, rev: loaded.rev, activeTrip });
    const nextTripId = out.activeTrip?.trip.id ?? null;
    tx.set(adventurerRef(uid), { ...toAdventurerDoc(out.state, nextTripId, loaded.rev + 1), updatedAt: serverTimestamp() });
    if (out.activeTrip) {
      tx.set(tripRef(uid, out.activeTrip.trip.id), {
        ...toTripDoc(out.activeTrip.trip, out.activeTrip.report, out.activeTrip.seenMs),
        updatedAt: serverTimestamp(),
      });
    }
    return out.result;
  });
}

/** Opts the player in: creates a fresh adventurer if there isn't one and marks the profile. */
export async function joinAdventureBeta(uid: string, weekId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(adventurerRef(uid));
    if (!snap.exists()) {
      tx.set(adventurerRef(uid), { ...toAdventurerDoc(newAdventurer(weekId), null, 0), updatedAt: serverTimestamp() });
    }
  });
  await updateDoc(doc(db, 'users', uid), { adventureBeta: true });
}

/** Live updates of the adventurer document (the active trip is read on demand). */
export function subscribeToAdventurer(uid: string, weekId: string, onChange: (s: { state: GameState; activeTripId: string | null; rev: number } | null) => void): Unsubscribe {
  return onSnapshot(adventurerRef(uid), (snap) => onChange(snap.exists() ? fromAdventurerDoc(snap.data(), weekId) : null));
}

/** A habit was completed: earn adventure time (PROG-022). Returns the grant to store on the completion. */
export function earnHours(uid: string, weekId: string, habitXP: number) {
  return updateGame(uid, weekId, (g) => {
    const earned = earnFromHabit(g.state.time, habitXP, weekId);
    return { state: { ...g.state, time: earned.time }, activeTrip: g.activeTrip, result: { ...earned.grant, weekId, spilledHours: earned.spilledHours } };
  });
}

/** A habit was unticked: take its grant back, clawing unstarted trip time if that leaves debt (PROG-025). */
export function untickHours(uid: string, weekId: string, grant: TimeGrant & { weekId: string }) {
  return updateGame(uid, weekId, (g) => {
    let state: GameState = { ...g.state, time: untickHabit(g.state.time, grant, grant.weekId) };
    let activeTrip = g.activeTrip;
    let clawedHours = 0;
    if (state.time.bankHours < 0 && activeTrip && !activeTrip.trip.done) {
      const res = clawBackForDebt(state, activeTrip.trip);
      state = res.state;
      clawedHours = res.clawedHours;
      activeTrip = { ...activeTrip, trip: res.trip };
    }
    return { state, activeTrip, result: { clawedHours, debtHours: Math.min(0, state.time.bankHours) } };
  });
}

/** Brings a running queue up to date inside a change, merging what it produced into the log. */
function caughtUp(g: GameSnapshot, nowMs: number, affinityAt?: (ms: number) => ReadonlySet<string>): { state: GameState; activeTrip: ActiveTrip | null } {
  if (!g.activeTrip || !queueRunning(g.activeTrip.trip)) return { state: g.state, activeTrip: g.activeTrip };
  const res = advanceTrip(g.state, g.activeTrip.trip, nowMs, affinityAt);
  return { state: res.state, activeTrip: { ...g.activeTrip, trip: res.trip, report: mergeReports(g.activeTrip.report, res.report) } };
}

/**
 * Adds blocks to the adventurer's queue (PROG-045): to the end if it's running, or as a
 * new queue starting now. A finished queue's unread log carries over into the new one.
 */
export function queueBlocks(uid: string, weekId: string, legs: LegPlan[], nowMs: number, affinityAt?: (ms: number) => ReadonlySet<string>) {
  const newId = doc(collection(db, 'users', uid, 'trips')).id;
  return updateGame(uid, weekId, (g) => {
    const cur = caughtUp(g, nowMs, affinityAt);
    const res = queueLegs(cur.state, cur.activeTrip?.trip ?? null, legs, newId, nowMs);
    const carried = cur.activeTrip && reportHasNews(cur.activeTrip.report) && (res.appended || cur.activeTrip.seenMs === null)
      ? cur.activeTrip.report : emptyReport();
    return { state: res.state, activeTrip: { trip: res.trip, report: carried, seenMs: null }, result: res.trip.id };
  });
}

/** Removes a block that hasn't started; its time goes back to the bank. */
export function removeBlock(uid: string, weekId: string, index: number, nowMs: number, affinityAt?: (ms: number) => ReadonlySet<string>) {
  return updateGame(uid, weekId, (g) => {
    const cur = caughtUp(g, nowMs, affinityAt);
    if (!cur.activeTrip || !queueRunning(cur.activeTrip.trip)) throw new Error('Nothing is queued');
    const res = removeQueuedLeg(cur.state, cur.activeTrip.trip, index);
    return { state: res.state, activeTrip: { ...cur.activeTrip, trip: res.trip }, result: undefined };
  });
}

/** Resizes a block that hasn't started: hours for gathering and fights, a count for a work order. */
export function resizeBlock(
  uid: string, weekId: string, index: number, size: { hours?: number; count?: number }, nowMs: number,
  affinityAt?: (ms: number) => ReadonlySet<string>,
) {
  return updateGame(uid, weekId, (g) => {
    const cur = caughtUp(g, nowMs, affinityAt);
    if (!cur.activeTrip || !queueRunning(cur.activeTrip.trip)) throw new Error('Nothing is queued');
    const res = resizeQueuedLeg(cur.state, cur.activeTrip.trip, index, size);
    return { state: res.state, activeTrip: { ...cur.activeTrip, trip: res.trip }, result: undefined };
  });
}

/** Fills a village order from the bank (PROG-044); `dayId` is the player's local date. */
export function fillVillageOrder(uid: string, weekId: string, regionId: string, orderId: string, dayId: string) {
  return updateGame(uid, weekId, (g) => ({ state: fillOrder(g.state, regionId, orderId, dayId), activeTrip: g.activeTrip, result: undefined }));
}

/**
 * Brings the active trip up to date (call when the app opens or comes to the foreground).
 * `affinityAt` says which skills get the affinity bonus at a moment.
 */
export function resolveActiveTrip(uid: string, weekId: string, nowMs: number, affinityAt?: (ms: number) => ReadonlySet<string>) {
  return updateGame(uid, weekId, (g) => {
    if (!g.activeTrip || g.activeTrip.trip.done) return { state: g.state, activeTrip: g.activeTrip, result: g.activeTrip };
    const res = advanceTrip(g.state, g.activeTrip.trip, nowMs, affinityAt);
    const activeTrip = { ...g.activeTrip, trip: res.trip, report: mergeReports(g.activeTrip.report, res.report) };
    return { state: res.state, activeTrip, result: activeTrip };
  });
}

/** Calls the adventurer home early; unworked hours go back to the bank. */
export function callBackTrip(uid: string, weekId: string, nowMs: number, affinityAt?: (ms: number) => ReadonlySet<string>) {
  return updateGame(uid, weekId, (g) => {
    if (!g.activeTrip || g.activeTrip.trip.done) return { state: g.state, activeTrip: g.activeTrip, result: g.activeTrip };
    const res = callBack(g.state, g.activeTrip.trip, nowMs, affinityAt);
    const activeTrip = { ...g.activeTrip, trip: res.trip, report: mergeReports(g.activeTrip.report, res.report) };
    return { state: res.state, activeTrip, result: activeTrip };
  });
}

/** The player read the log (PROG-045): it starts again empty; a finished queue is marked seen. */
export function dismissReturn(uid: string, weekId: string, nowMs: number) {
  return updateGame(uid, weekId, (g) => {
    if (!g.activeTrip) return { state: g.state, activeTrip: g.activeTrip, result: undefined };
    return {
      state: g.state,
      activeTrip: { ...g.activeTrip, report: emptyReport(), seenMs: g.activeTrip.trip.done ? nowMs : null },
      result: undefined,
    };
  });
}

// ---------- Habits → adventure time (PROG-022, PROG-025, PROG-041) ----------

/**
 * Earns adventure time for a habit completion and stores the grant on the completion.
 * Backfills into an earlier week earn nothing in the beta (that week's cap is closed).
 * Never throws: a failure here mustn't undo the habit itself.
 */
export async function earnHoursForCompletion(
  uid: string, weekStartDay: 0 | 1, activityId: string, completionId: string, completedAtMs: number, nowMs: number,
): Promise<void> {
  try {
    const weekId = weekIdFor(nowMs, weekStartDay);
    if (weekIdFor(completedAtMs, weekStartDay) !== weekId) return;
    const grant = await earnHours(uid, weekId, habitAdventureXP(activityId));
    await setCompletionTimeGrant(uid, completionId, { weekHours: grant.weekHours, bankHours: grant.bankHours, weekId: grant.weekId });
  } catch (err) {
    console.error('Adventure time not earned:', err);
  }
}

/** Takes back a completion's adventure time when the habit is unticked. Never throws. */
export async function untickHoursForCompletion(
  uid: string, weekStartDay: 0 | 1, grant: { weekHours: number; bankHours: number; weekId: string } | undefined, nowMs: number,
): Promise<void> {
  if (!grant) return;
  try {
    await untickHours(uid, weekIdFor(nowMs, weekStartDay), grant);
  } catch (err) {
    console.error('Adventure time not taken back:', err);
  }
}

/** Live updates of one trip document. */
export function subscribeToTrip(uid: string, tripId: string, onChange: (t: ActiveTrip | null) => void): Unsubscribe {
  return onSnapshot(tripRef(uid, tripId), (snap) => onChange(snap.exists() ? fromTripDoc(tripId, snap.data()) : null));
}

/** Puts a quest's XP lamp into a skill of the player's choice. */
export function applyLampOn(uid: string, weekId: string, lampIndex: number, skill: Parameters<typeof applyLamp>[2]) {
  return updateGame(uid, weekId, (g) => ({ state: applyLamp(g.state, lampIndex, skill), activeTrip: g.activeTrip, result: undefined }));
}
