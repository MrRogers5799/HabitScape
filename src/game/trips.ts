/**
 * The adventurer's queue (PROG-011, PROG-023, PROG-045): blocks worked one after
 * another in real time. A block (a "leg" in the code) is a method (gathering,
 * processing, burying), a fight (`fight-<creature>`) or a quest (`quest-<quest>`).
 * Gathering and fights run in half hours; crafting blocks are work orders that take
 * the minutes their items need (PROG-043). Blocks can be added to the end while the
 * queue runs, and unstarted blocks removed or resized.
 *
 * Queues resolve lazily: call advanceTrip with the current time whenever the app
 * opens, and it works out the steps that have finished since last time. Results are
 * deterministic (seeded per queue and step), so resolving in one go or in many small
 * steps gives the same outcome.
 */
import { addRewardXP, bestTool, burnChance, levelOf, toolMultiplier } from './adventurer';
import { attemptsPerHour, bestFood, defence, offence, pickLoadout, winChance } from './combat';
import { CREATURES, ITEMS, METHODS, QUESTS, REGIONS, SKILL_PETS } from './content/valley';
import { fillOrder } from './orders';
import { chunkRng, stochasticRound } from './rng';
import { AFFINITY_BONUS, CHUNK_HOURS, MAX_QUEUE_BLOCKS, PET_XP } from './rules';
import { Creature, GameSkill, GameState, Leg, LegPlan, MeleeFocus, Method, Quest, QuestRequirement, Trip, TripReport } from './types';

/** Hours are kept to four places: crafting blocks come in whole minutes (1/60 h). */
const round4 = (n: number) => Math.round(n * 10000) / 10000;
/** Every block is a whole number of minutes, so time converts to ms through minutes (no rounding drift). */
const hoursToMs = (h: number) => Math.round(h * 60) * 60 * 1000;

// ---------- Activities ----------

export type Activity =
  | { kind: 'method'; method: Method }
  | { kind: 'fight'; creature: Creature }
  | { kind: 'quest'; quest: Quest };

export const fightId = (creatureId: string) => `fight-${creatureId}`;
export const questId = (id: string) => `quest-${id}`;

export function activityOf(id: string): Activity | null {
  if (METHODS[id]) return { kind: 'method', method: METHODS[id] };
  if (id.startsWith('fight-') && CREATURES[id.slice(6)]) return { kind: 'fight', creature: CREATURES[id.slice(6)] };
  if (id.startsWith('quest-') && QUESTS[id.slice(6)]) return { kind: 'quest', quest: QUESTS[id.slice(6)] };
  return null;
}

// ---------- Planning ----------

export type PlanProblem =
  | 'no-legs' | 'queue-full' | 'bad-length' | 'unknown-activity' | 'wrong-region'
  | 'region-locked' | 'level-too-low' | 'no-tool' | 'not-enough-time' | 'in-debt'
  | 'quest-done' | 'quest-requirements' | 'quest-length' | 'needs-quest';

export function requirementMet(state: GameState, r: QuestRequirement): boolean {
  switch (r.kind) {
    case 'skill': return levelOf(state, r.skill) >= r.level;
    case 'kills': return (state.kills[r.creature] ?? 0) >= r.count;
    case 'item': return (state.bank[r.item] ?? 0) >= r.count;
    case 'quest': return !!state.quests[r.quest];
  }
}

/** Actions a crafting method can make from the bank right now. */
export function canMakeFrom(bank: Record<string, number>, method: Method): number {
  if (method.kind !== 'process') return 0;
  return Math.min(...Object.entries(method.inputs).map(([id, n]) => Math.floor((bank[id] ?? 0) / n)));
}

/** A work order's length (PROG-043): the whole minutes `count` items take at `perHour`. At least a minute. */
export function craftHours(perHour: number, count: number): number {
  if (count <= 0 || perHour <= 0) return 0;
  return round4(Math.max(1, Math.ceil((count / perHour) * 60)) / 60);
}

/** A crafting work order: a processing method planned by count (PROG-043). */
export const isWorkOrder = (leg: LegPlan): boolean => leg.count !== undefined;

/** Fills in a work order's hours from its count; other blocks are returned as they are. */
export function normaliseLeg(state: GameState, leg: LegPlan): LegPlan {
  if (!isWorkOrder(leg)) return leg;
  const act = activityOf(leg.activityId);
  if (act?.kind !== 'method' || act.method.kind !== 'process') return leg;
  return { ...leg, hours: craftHours(effectiveRate(state, act.method, leg.regionId), leg.count!) };
}

/** Checks one block against the adventurer as they are now. */
export function checkLeg(state: GameState, leg: LegPlan): PlanProblem | null {
  const act = activityOf(leg.activityId);
  if (!act) return 'unknown-activity';
  const regions = act.kind === 'method' ? act.method.regions : act.kind === 'fight' ? [act.creature.region] : [act.quest.region];
  if (!regions.includes(leg.regionId)) return 'wrong-region';
  const gate = REGIONS[leg.regionId]?.questGate;
  if (gate && !state.quests[gate]) return 'region-locked';
  if (isWorkOrder(leg)) {
    if (act.kind !== 'method' || act.method.kind !== 'process' || !Number.isInteger(leg.count) || leg.count! <= 0) return 'bad-length';
  } else if (!Number.isInteger(leg.hours * 2) || leg.hours <= 0) return 'bad-length';
  if (act.kind === 'method') {
    const level = levelOf(state, act.method.skill);
    if (level < act.method.level) return 'level-too-low';
    if (act.method.kind === 'gather' && !bestTool(state, act.method.tool, level)) return 'no-tool';
    if (act.method.quest && !state.quests[act.method.quest]) return 'needs-quest';
  }
  if (act.kind === 'quest') {
    if (state.quests[act.quest.id]) return 'quest-done';
    if (leg.hours !== act.quest.hours) return 'quest-length';
    if (!act.quest.requirements.every((r) => requirementMet(state, r))) return 'quest-requirements';
  }
  return null;
}

/**
 * Checks blocks about to be added. Later blocks can rely on what earlier ones produce.
 * `alreadyQueued` is how many blocks the running queue already holds.
 */
export function checkPlan(state: GameState, legsIn: LegPlan[], alreadyQueued = 0): PlanProblem | null {
  if (legsIn.length === 0) return 'no-legs';
  if (alreadyQueued + legsIn.length > MAX_QUEUE_BLOCKS) return 'queue-full';
  if (state.time.bankHours < 0) return 'in-debt';
  for (const leg of legsIn) {
    const problem = checkLeg(state, leg);
    if (problem) return problem;
  }
  const total = legsIn.reduce((sum, l) => sum + normaliseLeg(state, l).hours, 0);
  if (total > state.time.bankHours + 1e-9) return 'not-enough-time';
  return null;
}

/** The queue is still working (or waiting to be brought up to date). */
export const queueRunning = (trip: Trip | null | undefined): trip is Trip => !!trip && !trip.done;

/**
 * Adds blocks to the queue (PROG-045): to the end of a running queue, or as a new queue
 * starting now. Spends the hours up front and hands over quest items. Bring a running
 * queue up to date with advanceTrip first, so a queue that has really finished starts afresh.
 */
export function queueLegs(
  state: GameState, current: Trip | null, legsIn: LegPlan[], newId: string, nowMs: number,
): { state: GameState; trip: Trip; appended: boolean } {
  const running = queueRunning(current);
  const problem = checkPlan(state, legsIn, running ? current.legs.length : 0);
  if (problem) throw new Error(`Can't queue that: ${problem}`);
  const legs = legsIn.map((l) => normaliseLeg(state, l));
  const total = legs.reduce((sum, l) => sum + l.hours, 0);
  const bank = { ...state.bank };
  for (const l of legs) {
    const act = activityOf(l.activityId);
    if (act?.kind === 'quest') for (const [item, n] of Object.entries(act.quest.takes ?? {})) bank[item] -= n;
  }
  const fresh = legs.map((l) => ({ ...l, chunksDone: 0, refundedHours: 0, ended: false }));
  const nextState = { ...state, bank, time: { ...state.time, bankHours: round4(state.time.bankHours - total) } };
  if (running) {
    return { state: nextState, trip: { ...current, legs: [...current.legs.map((l) => ({ ...l })), ...fresh] }, appended: true };
  }
  return { state: nextState, trip: { id: newId, startMs: nowMs, legs: fresh, nextChunk: 0, done: false }, appended: false };
}

/** Sends the adventurer off on a new queue (kept for callers and tests that start from nothing). */
export function sendTrip(state: GameState, legs: LegPlan[], id: string, nowMs: number): { state: GameState; trip: Trip } {
  const res = queueLegs(state, null, legs, id, nowMs);
  return { state: res.state, trip: res.trip };
}

// ---------- Resolving ----------

export function emptyReport(): TripReport {
  return { xp: {}, gained: {}, used: {}, burnt: {}, kills: {}, attempts: {}, found: [], questsCompleted: [], refundedHours: 0, levelUps: [], notes: [] };
}

/** The log has something to show: items, XP, kills, quests, refunds or notes. */
export function reportHasNews(r: TripReport): boolean {
  return Object.keys(r.gained).length > 0 || Object.values(r.xp).some((n) => (n ?? 0) > 0) || Object.keys(r.kills).length > 0
    || r.questsCompleted.length > 0 || r.refundedHours > 0 || r.notes.length > 0 || r.found.length > 0;
}

const add = (bag: Record<string, number>, key: string, n: number) => {
  if (n) bag[key] = (bag[key] ?? 0) + n;
};

/** Hours a block has worked so far. */
const legWorked = (leg: Leg) => leg.chunksDone * CHUNK_HOURS + (leg.madeHours ?? 0);
/** Hours of a block not yet worked (and not yet refunded). */
const legRemaining = (leg: Leg) => round4(leg.hours - legWorked(leg) - leg.refundedHours);
/** Hours a block still has to go (for the queue on Today). */
export const blockHoursLeft = (leg: Leg): number => (leg.ended ? 0 : legRemaining(leg));
/** Hours a block has worked so far. */
export const blockHoursWorked = (leg: Leg): number => legWorked(leg);

const travelOf = (regionId: string) => REGIONS[regionId]?.travelFraction ?? 0;

/** Actions per hour for a method right now, with the best tool and travel included. */
export function effectiveRate(state: GameState, method: Method, regionId: string): number {
  const level = levelOf(state, method.skill);
  let rate = method.perHour;
  if (method.kind === 'gather' && method.toolTiered) {
    const tool = bestTool(state, method.tool, level);
    rate *= toolMultiplier(tool?.tier ?? 1);
  }
  return rate * (1 - travelOf(regionId));
}

/** Randomness and the moment for rolls inside one step (pets, PROG-046). */
interface Roll { rand: () => number; atMs: number }

/**
 * A rare find (boss unique, boss pet or skilling pet): into the bank and the log, and
 * into the collection log the first time (PROG-047), with when and at what count.
 */
function logFind(state: GameState, report: TripReport, item: string, atMs: number, detail: { kc?: number; level?: number } = {}) {
  add(state.bank, item, 1);
  add(report.gained, item, 1);
  report.found.push(item);
  if (!state.collection[item]) state.collection = { ...state.collection, [item]: { atMs, ...detail } };
}

function gainXP(state: GameState, report: TripReport, skill: GameSkill, amount: number, affinity: ReadonlySet<string>, roll: Roll) {
  if (amount <= 0) return;
  const before = levelOf(state, skill);
  const total = amount * (affinity.has(skill) ? 1 + AFFINITY_BONUS : 1);
  state.xp[skill] = (state.xp[skill] ?? 0) + total;
  report.xp[skill] = (report.xp[skill] ?? 0) + total;
  const after = levelOf(state, skill);
  if (after > before) report.levelUps.push({ skill, level: after });
  // Skilling pet (PROG-046): every XP point is a 1 in PET_XP roll, so this many XP finds it with this chance.
  if (roll.rand() < 1 - Math.exp(-total / PET_XP)) logFind(state, report, SKILL_PETS[skill], roll.atMs, { level: after });
}

/** Ends a leg early and hands its unworked hours back; quest legs also hand their items back. */
function endLeg(state: GameState, trip: Trip, legIndex: number, report: TripReport, note: string) {
  const leg = trip.legs[legIndex];
  const refund = legRemaining(leg);
  leg.refundedHours = round4(leg.refundedHours + refund);
  leg.ended = true;
  state.time.bankHours = round4(state.time.bankHours + refund);
  report.refundedHours = round4(report.refundedHours + refund);
  if (refund > 0 && note) report.notes.push(note);
  const act = activityOf(leg.activityId);
  if (act?.kind === 'quest' && refund > 0) {
    for (const [item, n] of Object.entries(act.quest.takes ?? {})) state.bank[item] = (state.bank[item] ?? 0) + n;
  }
}

/** Craft & deliver (PROG-050): fills the order from the bank now; if it can't, the items stay and the log says why. */
function deliverOrder(state: GameState, report: TripReport, order: NonNullable<Leg['deliver']>['order'], dayId: string) {
  const name = ITEMS[order.item]?.name ?? order.item;
  try {
    Object.assign(state, fillOrder(state, order, dayId, report));
    report.notes.push(`Delivered ${order.count} ${name} to the order board.`);
  } catch (err) {
    report.notes.push(`Couldn't deliver ${name}: ${err instanceof Error ? err.message.toLowerCase() : 'try again'}. They're in your bank.`);
  }
}

/** Uses the inputs for `made` actions and adds what they make, burns and the XP. */
function makeItems(state: GameState, report: TripReport, method: Method, made: number, rand: () => number, affinity: ReadonlySet<string>, atMs: number) {
  if (method.kind !== 'process') return;
  for (const [id, n] of Object.entries(method.inputs)) {
    state.bank[id] -= made * n;
    add(report.used, id, made * n);
  }
  const burnt = stochasticRound(made * burnChance(method, levelOf(state, method.skill)), rand);
  const ok = made - burnt;
  if (method.output) {
    const n = ok * (method.outputEach ?? 1);
    add(state.bank, method.output, n);
    add(report.gained, method.output, n);
  }
  if (burnt && method.burn && method.output) {
    add(state.bank, method.burn.burntItem, burnt);
    add(report.burnt, method.output, burnt);
  }
  gainXP(state, report, method.skill, ok * method.xpEach, affinity, { rand, atMs });
}

const currentLeg = (trip: Trip) => trip.legs.findIndex((l) => !l.ended);
/** When the queue's next step starts: its start plus everything worked so far. */
const nextStepMs = (trip: Trip) => trip.startMs + hoursToMs(trip.legs.reduce((h, l) => h + legWorked(l), 0));

/** Index of the block being worked now, or -1 when the queue is done. */
export const currentBlock = (trip: Trip) => currentLeg(trip);

/** The blocks still to do, as plans for what's left of each (for previewing the bank after the queue). */
export function remainingPlan(trip: Trip): LegPlan[] {
  return trip.legs.filter((l) => !l.ended).map((l) => {
    const { chunksDone: _c, refundedHours: _r, ended: _e, madeHours: _m, ...plan } = l;
    return isWorkOrder(l) ? plan : { ...plan, hours: legRemaining(l) };
  });
}

/** When the queue should finish if nothing runs short: now's step plus everything left. */
export function queueEndsMs(trip: Trip): number {
  return nextStepMs(trip) + hoursToMs(trip.legs.reduce((h, l) => h + (l.ended ? 0 : legRemaining(l)), 0));
}

/**
 * Removes a block that hasn't started (PROG-045): its hours go back to the bank, and a
 * quest's items come back. The block being worked now can't be removed; call back instead.
 */
export function removeQueuedLeg(stateIn: GameState, tripIn: Trip, index: number): { state: GameState; trip: Trip } {
  if (index <= currentLeg(tripIn) || index >= tripIn.legs.length) throw new Error("That block has already started");
  const state: GameState = { ...stateIn, bank: { ...stateIn.bank }, time: { ...stateIn.time } };
  const leg = tripIn.legs[index];
  state.time.bankHours = round4(state.time.bankHours + legRemaining(leg));
  const act = activityOf(leg.activityId);
  if (act?.kind === 'quest') for (const [item, n] of Object.entries(act.quest.takes ?? {})) state.bank[item] = (state.bank[item] ?? 0) + n;
  return { state, trip: { ...tripIn, legs: tripIn.legs.filter((_, i) => i !== index).map((l) => ({ ...l })) } };
}

/**
 * Resizes a block that hasn't started (PROG-045): new hours for gathering and fights,
 * a new count for a work order. The difference comes from, or goes back to, the bank.
 */
export function resizeQueuedLeg(
  stateIn: GameState, tripIn: Trip, index: number, size: { hours?: number; count?: number },
): { state: GameState; trip: Trip } {
  if (index <= currentLeg(tripIn) || index >= tripIn.legs.length) throw new Error("That block has already started");
  const old = tripIn.legs[index];
  if (activityOf(old.activityId)?.kind === 'quest') throw new Error('Quests take their own length');
  const resized = normaliseLeg(stateIn, { ...old, ...size });
  const problem = checkLeg(stateIn, resized);
  if (problem) throw new Error(`Can't resize that block: ${problem}`);
  const delta = round4(resized.hours - old.hours);
  if (delta > stateIn.time.bankHours + 1e-9) throw new Error("Can't resize that block: not-enough-time");
  const state: GameState = { ...stateIn, time: { ...stateIn.time, bankHours: round4(stateIn.time.bankHours - delta) } };
  const legs = tripIn.legs.map((l, i) => (i === index ? { ...l, hours: resized.hours, count: resized.count } : { ...l }));
  return { state, trip: { ...tripIn, legs } };
}

function meleeXP(state: GameState, report: TripReport, focus: MeleeFocus, amount: number, affinity: ReadonlySet<string>, roll: Roll) {
  if (focus === 'shared') {
    for (const s of ['Attack', 'Strength', 'Defence'] as const) gainXP(state, report, s, amount / 3, affinity, roll);
  } else gainXP(state, report, focus, amount, affinity, roll);
}

/** One half hour of fighting: attempts, wins, XP, bones, drops, luck meter. */
function fightChunk(state: GameState, leg: Leg, creature: Creature, rand: () => number, report: TripReport, affinity: ReadonlySet<string>, atMs: number) {
  const roll = { rand, atMs };
  const loadout = pickLoadout(state, creature, leg.overrides);
  const attempts = stochasticRound(attemptsPerHour(offence(state, loadout, creature), creature) * CHUNK_HOURS * (1 - travelOf(leg.regionId)), rand);
  for (let a = 0; a < attempts; a++) {
    const food = bestFood(state, creature);
    if (food) {
      state.bank[food.id] -= creature.foodPerAttempt;
      add(report.used, food.id, creature.foodPerAttempt);
    }
    add(report.attempts, creature.id, 1);
    if (rand() >= winChance(defence(state, loadout, food?.heal ?? 0), creature)) continue; // a loss costs only time (PROG-008)

    state.kills[creature.id] = (state.kills[creature.id] ?? 0) + 1;
    add(report.kills, creature.id, 1);
    meleeXP(state, report, leg.focus ?? 'shared', 4 * creature.hp, affinity, roll);
    gainXP(state, report, 'Hitpoints', (4 / 3) * creature.hp, affinity, roll);
    add(state.bank, creature.bones, 1);
    add(report.gained, creature.bones, 1);
    for (const d of creature.drops) {
      if (rand() < d.chance) {
        const n = d.min + Math.floor(rand() * (d.max - d.min + 1));
        add(state.bank, d.item, n);
        add(report.gained, d.item, n);
      }
    }
    if (creature.boss) {
      const { uniques, pet } = creature.boss;
      const dry = (state.dryKills[creature.id] ?? 0) + 1;
      let found = uniques.find((u) => rand() < 1 / u.oneIn)?.item;
      // Luck meter (PROG-030): a missing unique is guaranteed after twice its drop rate in dry kills.
      const missing = uniques.filter((u) => !state.bank[u.item]);
      const pity = 2 * Math.min(...uniques.map((u) => u.oneIn));
      if (!found && missing.length && dry >= pity) found = missing[0].item;
      const kc = state.kills[creature.id];
      if (found) {
        logFind(state, report, found, atMs, { kc });
        state.dryKills[creature.id] = 0;
      } else state.dryKills[creature.id] = dry;
      if (rand() < 1 / pet.oneIn) logFind(state, report, pet.item, atMs, { kc });
    }
  }
}

function completeQuest(state: GameState, quest: Quest, report: TripReport) {
  state.quests[quest.id] = true;
  for (const [item, n] of Object.entries(quest.rewards.items ?? {})) {
    add(state.bank, item, n);
    add(report.gained, item, n);
  }
  // Quest XP goes straight to its skills (PROG-048); no affinity bonus or pet roll, as it isn't earned by the work.
  for (const [skill, n] of Object.entries(quest.rewards.xp ?? {}) as [GameSkill, number][]) addRewardXP(state, report, skill, n);
  report.questsCompleted.push(quest.id);
}

/**
 * Works out every half-hour chunk that has finished by `nowMs`.
 * `affinityAt` says which skills get the affinity bonus at a moment (the caller knows habits and days).
 */
export function advanceTrip(
  stateIn: GameState,
  tripIn: Trip,
  nowMs: number,
  affinityAt: (ms: number) => ReadonlySet<string> = () => new Set(),
): { state: GameState; trip: Trip; report: TripReport } {
  const state: GameState = {
    ...stateIn, xp: { ...stateIn.xp }, bank: { ...stateIn.bank }, time: { ...stateIn.time },
    quests: { ...stateIn.quests }, kills: { ...stateIn.kills }, dryKills: { ...stateIn.dryKills }, lamps: [...stateIn.lamps],
    collection: { ...stateIn.collection },
  };
  const trip: Trip = { ...tripIn, legs: tripIn.legs.map((l) => ({ ...l })) };
  const report = emptyReport();
  if (trip.done) return { state, trip, report };

  for (;;) {
    const li = currentLeg(trip);
    if (li < 0) {
      trip.done = true;
      trip.finishedMs = nextStepMs(trip);
      break;
    }
    const leg = trip.legs[li];
    if (legRemaining(leg) <= 0) { leg.ended = true; continue; }
    const chunkStart = nextStepMs(trip);
    const act = activityOf(leg.activityId)!;

    // A work order (PROG-043) finishes in one step, after the minutes its items take.
    if (isWorkOrder(leg) && act.kind === 'method' && act.method.kind === 'process') {
      const method = act.method;
      const made = Math.min(leg.count!, canMakeFrom(state.bank, method));
      if (made <= 0) {
        endLeg(state, trip, li, report, `${method.name}: nothing to use, so it was skipped.`);
        continue;
      }
      const hours = Math.min(craftHours(effectiveRate(state, method, leg.regionId), made), legRemaining(leg));
      if (chunkStart + hoursToMs(hours) > nowMs) break; // still working on it
      const rand = chunkRng(trip.id, trip.nextChunk);
      makeItems(state, report, method, made, rand, affinityAt(chunkStart), chunkStart);
      leg.madeHours = hours;
      trip.nextChunk += 1;
      if (leg.deliver) deliverOrder(state, report, leg.deliver.order, leg.deliver.dayId);
      if (made < leg.count!) endLeg(state, trip, li, report, `${method.name}: ran out of materials after ${made}.`);
      else if (legRemaining(leg) > 0) endLeg(state, trip, li, report, '');
      else leg.ended = true;
      continue;
    }

    if (chunkStart + hoursToMs(CHUNK_HOURS) > nowMs) break; // this half hour hasn't finished yet
    const rand = chunkRng(trip.id, trip.nextChunk);
    const affinity = affinityAt(chunkStart);

    if (act.kind === 'fight') {
      fightChunk(state, leg, act.creature, rand, report, affinity, chunkStart);
    } else if (act.kind === 'quest') {
      // Quests just take their time; rewards land when the last half hour finishes.
    } else {
      const method = act.method;
      const expected = effectiveRate(state, method, leg.regionId) * CHUNK_HOURS;
      if (method.kind === 'gather') {
        const count = stochasticRound(expected, rand);
        add(state.bank, method.output, count);
        add(report.gained, method.output, count);
        gainXP(state, report, method.skill, count * method.xpEach, affinity, { rand, atMs: chunkStart });
      } else {
        // Older, time-planned processing (before work orders) is limited by materials in the bank (PROG-026).
        const wanted = stochasticRound(expected, rand);
        const made = Math.min(wanted, canMakeFrom(state.bank, method));
        if (made <= 0) {
          endLeg(state, trip, li, report, `${method.name}: ran out of materials.`);
          continue; // the next leg starts in this same half hour
        }
        makeItems(state, report, method, made, rand, affinity, chunkStart);
        if (made < wanted) {
          leg.chunksDone += 1;
          trip.nextChunk += 1;
          endLeg(state, trip, li, report, `${method.name}: ran out of materials.`);
          continue;
        }
      }
    }
    leg.chunksDone += 1;
    trip.nextChunk += 1;
    if (legRemaining(leg) <= 0) {
      leg.ended = true;
      if (act.kind === 'quest') completeQuest(state, act.quest, report);
    }
  }
  return { state, trip, report };
}

/** Calls the adventurer home now: resolves finished chunks, then refunds every unworked hour. */
export function callBack(state: GameState, trip: Trip, nowMs: number, affinityAt?: (ms: number) => ReadonlySet<string>) {
  const res = advanceTrip(state, trip, nowMs, affinityAt);
  if (!res.trip.done) {
    for (let i = 0; i < res.trip.legs.length; i++) {
      if (!res.trip.legs[i].ended) endLeg(res.state, res.trip, i, res.report, 'Called back early.');
    }
    res.trip.done = true;
    res.trip.finishedMs = nowMs;
  }
  return res;
}

/**
 * PROG-025: after unticking a habit put adventure time into debt, take unstarted
 * hours back from the trip, latest leg first, in half-hour steps. Quest legs are
 * left alone. Whatever can't be covered stays as debt.
 */
export function clawBackForDebt(stateIn: GameState, tripIn: Trip): { state: GameState; trip: Trip; clawedHours: number } {
  const state: GameState = { ...stateIn, time: { ...stateIn.time } };
  const trip: Trip = { ...tripIn, legs: tripIn.legs.map((l) => ({ ...l })) };
  let clawed = 0;
  for (let i = trip.legs.length - 1; i >= 0 && state.time.bankHours < 0; i--) {
    const leg = trip.legs[i];
    if (leg.ended || activityOf(leg.activityId)?.kind === 'quest') continue;
    if (isWorkOrder(leg)) {
      // A work order can't be cut in half hours: an unstarted one is cancelled whole.
      if (i <= currentLeg(trip)) continue;
      const back = legRemaining(leg);
      leg.refundedHours = round4(leg.refundedHours + back);
      leg.ended = true;
      state.time.bankHours = round4(state.time.bankHours + back);
      clawed = round4(clawed + back);
      continue;
    }
    // keep the half hour that may be in progress on the current leg
    const inProgress = i === currentLeg(trip) ? CHUNK_HOURS : 0;
    const available = Math.max(0, legRemaining(leg) - inProgress);
    const needed = Math.ceil(-state.time.bankHours / CHUNK_HOURS) * CHUNK_HOURS;
    const cut = Math.min(available, needed);
    if (cut <= 0) continue;
    leg.hours = round4(leg.hours - cut);
    state.time.bankHours = round4(state.time.bankHours + cut);
    clawed = round4(clawed + cut);
    if (legRemaining(leg) <= 0) leg.ended = true;
  }
  if (currentLeg(trip) < 0) trip.done = true;
  return { state, trip, clawedHours: clawed };
}
