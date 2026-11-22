/**
 * Turning game state into Firestore documents and back (PLAT-007, PLAT-008).
 *
 * Layout under users/{uid}:
 *   game/adventurer   one document: levels, bank, adventure time, quests, kill counts, lamps, active trip id
 *   trips/{tripId}    one document per queue (PROG-045): its blocks and progress, plus the running log of what it produced
 *
 * Kept pure (no Firebase imports) so it's tested with Jest. `rev` goes up by one on
 * every save; the security rules reject a save that doesn't, so a stale device can't
 * overwrite newer progress.
 */
import { newAdventurer } from './adventurer';
import { GAME_SKILLS, GameSkill, GameState, Trip, TripReport } from './types';
import { emptyReport } from './trips';

export const GAME_SCHEMA_VERSION = 1;
export const ADVENTURER_DOC = 'adventurer';

export interface AdventurerDoc {
  schemaVersion: number;
  rev: number;
  xp: Record<string, number>;
  bank: Record<string, number>;
  time: { bankHours: number; weekId: string; weekEarnedHours: number };
  quests: Record<string, true>;
  kills: Record<string, number>;
  dryKills: Record<string, number>;
  lamps: number[];
  /** Village orders filled today (PROG-044). */
  ordersFilled: Record<string, true>;
  activeTripId: string | null;
}

export interface TripDoc {
  schemaVersion: number;
  startMs: number;
  legs: Trip['legs'];
  nextChunk: number;
  done: boolean;
  finishedMs: number | null;
  /** Everything the trip has produced so far, for the "Welcome back" screen. */
  report: TripReport;
  /** When the player dismissed the return screen; null until then. */
  seenMs: number | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numbers = (v: unknown): Record<string, number> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === 'number' && Number.isFinite(n))) as Record<string, number> : {};

/** Drops zero counts so the bank stays small. */
const compact = (bank: Record<string, number>) => Object.fromEntries(Object.entries(bank).filter(([, n]) => n !== 0));

export function toAdventurerDoc(state: GameState, activeTripId: string | null, rev: number): AdventurerDoc {
  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    rev,
    xp: { ...state.xp },
    bank: compact(state.bank),
    time: { ...state.time },
    quests: { ...state.quests },
    kills: { ...state.kills },
    dryKills: { ...state.dryKills },
    lamps: [...state.lamps],
    ordersFilled: { ...state.ordersFilled },
    activeTripId,
  };
}

/**
 * Reads an adventurer document, filling anything missing with a new adventurer's
 * defaults, so older documents keep loading after new fields are added.
 */
export function fromAdventurerDoc(data: unknown, weekId: string): { state: GameState; activeTripId: string | null; rev: number } {
  const d = isRecord(data) ? data : {};
  const fresh = newAdventurer(weekId);
  const xp = { ...fresh.xp };
  const storedXp = numbers(d.xp);
  for (const s of GAME_SKILLS) if (typeof storedXp[s] === 'number') xp[s as GameSkill] = storedXp[s];
  const time = isRecord(d.time) ? d.time : {};
  return {
    state: {
      xp,
      bank: isRecord(d.bank) ? numbers(d.bank) : fresh.bank,
      time: {
        bankHours: typeof time.bankHours === 'number' ? time.bankHours : 0,
        weekId: typeof time.weekId === 'string' ? time.weekId : weekId,
        weekEarnedHours: typeof time.weekEarnedHours === 'number' ? time.weekEarnedHours : 0,
      },
      quests: isRecord(d.quests) ? (Object.fromEntries(Object.keys(d.quests).map((k) => [k, true])) as Record<string, true>) : {},
      kills: numbers(d.kills),
      dryKills: numbers(d.dryKills),
      lamps: Array.isArray(d.lamps) ? d.lamps.filter((n): n is number => typeof n === 'number') : [],
      ordersFilled: isRecord(d.ordersFilled) ? (Object.fromEntries(Object.keys(d.ordersFilled).map((k) => [k, true])) as Record<string, true>) : {},
    },
    activeTripId: typeof d.activeTripId === 'string' ? d.activeTripId : null,
    rev: typeof d.rev === 'number' ? d.rev : 0,
  };
}

export function toTripDoc(trip: Trip, report: TripReport, seenMs: number | null = null): TripDoc {
  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    startMs: trip.startMs,
    legs: trip.legs.map((l) => ({ ...l })),
    nextChunk: trip.nextChunk,
    done: trip.done,
    finishedMs: trip.finishedMs ?? null,
    report,
    seenMs,
  };
}

export function fromTripDoc(id: string, data: unknown): { trip: Trip; report: TripReport; seenMs: number | null } {
  const d = isRecord(data) ? data : {};
  const trip: Trip = {
    id,
    startMs: typeof d.startMs === 'number' ? d.startMs : 0,
    legs: Array.isArray(d.legs) ? (d.legs as Trip['legs']).map((l) => ({ ...l })) : [],
    nextChunk: typeof d.nextChunk === 'number' ? d.nextChunk : 0,
    done: d.done === true,
  };
  if (typeof d.finishedMs === 'number') trip.finishedMs = d.finishedMs;
  return {
    trip,
    report: mergeReports(emptyReport(), isRecord(d.report) ? (d.report as Partial<TripReport>) : {}),
    seenMs: typeof d.seenMs === 'number' ? d.seenMs : null,
  };
}

const addBags = (a: Record<string, number>, b: Record<string, number> = {}) => {
  const out = { ...a };
  for (const [k, n] of Object.entries(b)) out[k] = (out[k] ?? 0) + n;
  return out;
};

/** Adds a newly resolved stretch of a trip to what it had produced before. */
export function mergeReports(a: TripReport, b: Partial<TripReport>): TripReport {
  return {
    xp: addBags(a.xp as Record<string, number>, b.xp as Record<string, number>),
    gained: addBags(a.gained, b.gained),
    used: addBags(a.used, b.used),
    burnt: addBags(a.burnt, b.burnt),
    kills: addBags(a.kills, b.kills),
    attempts: addBags(a.attempts, b.attempts),
    found: [...a.found, ...(b.found ?? [])],
    questsCompleted: [...a.questsCompleted, ...(b.questsCompleted ?? [])],
    refundedHours: Math.round((a.refundedHours + (b.refundedHours ?? 0)) * 10000) / 10000,
    levelUps: [...a.levelUps, ...(b.levelUps ?? [])],
    notes: [...a.notes, ...(b.notes ?? [])],
  };
}

/**
 * The week id adventure time counts against: the date the user's week started,
 * in their local time (PROG-006). Example: '2026-11-16' for a Monday week start.
 */
export function weekIdFor(ms: number, weekStartDay: 0 | 1): string {
  const d = new Date(ms);
  const back = (d.getDay() - weekStartDay + 7) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/** The player's local date, e.g. '2026-11-21': village boards change with it (PROG-044). */
export function dayIdFor(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
