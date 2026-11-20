/**
 * Trips (PROG-011, PROG-023, PROG-026): the adventurer works through up to three
 * legs in real time, half an hour at a time. A leg is a method (gathering,
 * processing, burying), a fight (`fight-<creature>`) or a quest (`quest-<quest>`).
 *
 * Trips resolve lazily: call advanceTrip with the current time whenever the app
 * opens, and it works out the half-hour chunks that have finished since last time.
 * Results are deterministic (seeded per trip and chunk), so resolving in one go or
 * in many small steps gives the same outcome.
 */
import { bestTool, levelOf, toolMultiplier } from './adventurer';
import { attemptsPerHour, bestFood, defence, offence, pickLoadout, winChance } from './combat';
import { CREATURES, METHODS, QUESTS, REGIONS } from './content/valley';
import { chunkRng, stochasticRound } from './rng';
import { AFFINITY_BONUS, CHUNK_HOURS, CHUNK_MS, MAX_LEGS } from './rules';
import { Creature, GameSkill, GameState, Leg, LegPlan, MeleeFocus, Method, Quest, QuestRequirement, Trip, TripReport } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

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
  | 'no-legs' | 'too-many-legs' | 'bad-length' | 'unknown-activity' | 'wrong-region'
  | 'region-locked' | 'level-too-low' | 'no-tool' | 'not-enough-time' | 'in-debt'
  | 'quest-done' | 'quest-requirements' | 'quest-length';

export function requirementMet(state: GameState, r: QuestRequirement): boolean {
  switch (r.kind) {
    case 'skill': return levelOf(state, r.skill) >= r.level;
    case 'kills': return (state.kills[r.creature] ?? 0) >= r.count;
    case 'item': return (state.bank[r.item] ?? 0) >= r.count;
    case 'quest': return !!state.quests[r.quest];
  }
}

/** Checks one leg against the adventurer as they are now. */
export function checkLeg(state: GameState, leg: LegPlan): PlanProblem | null {
  const act = activityOf(leg.activityId);
  if (!act) return 'unknown-activity';
  const regions = act.kind === 'method' ? act.method.regions : act.kind === 'fight' ? [act.creature.region] : [act.quest.region];
  if (!regions.includes(leg.regionId)) return 'wrong-region';
  const gate = REGIONS[leg.regionId]?.questGate;
  if (gate && !state.quests[gate]) return 'region-locked';
  if (!Number.isInteger(leg.hours * 2) || leg.hours <= 0) return 'bad-length';
  if (act.kind === 'method') {
    const level = levelOf(state, act.method.skill);
    if (level < act.method.level) return 'level-too-low';
    if (act.method.kind === 'gather' && !bestTool(state, act.method.tool, level)) return 'no-tool';
  }
  if (act.kind === 'quest') {
    if (state.quests[act.quest.id]) return 'quest-done';
    if (leg.hours !== act.quest.hours) return 'quest-length';
    if (!act.quest.requirements.every((r) => requirementMet(state, r))) return 'quest-requirements';
  }
  return null;
}

/** Checks a whole plan. Later legs can rely on what earlier legs produce. */
export function checkPlan(state: GameState, legs: LegPlan[]): PlanProblem | null {
  if (legs.length === 0) return 'no-legs';
  if (legs.length > MAX_LEGS) return 'too-many-legs';
  if (state.time.bankHours < 0) return 'in-debt';
  for (const leg of legs) {
    const problem = checkLeg(state, leg);
    if (problem) return problem;
  }
  const total = legs.reduce((sum, l) => sum + l.hours, 0);
  if (total > state.time.bankHours + 1e-9) return 'not-enough-time';
  return null;
}

/** Sends the adventurer off: spends the hours up front and hands over quest items. */
export function sendTrip(state: GameState, legs: LegPlan[], id: string, nowMs: number): { state: GameState; trip: Trip } {
  const problem = checkPlan(state, legs);
  if (problem) throw new Error(`Can't send trip: ${problem}`);
  const total = legs.reduce((sum, l) => sum + l.hours, 0);
  const bank = { ...state.bank };
  for (const l of legs) {
    const act = activityOf(l.activityId);
    if (act?.kind === 'quest') for (const [item, n] of Object.entries(act.quest.takes ?? {})) bank[item] -= n;
  }
  return {
    state: { ...state, bank, time: { ...state.time, bankHours: round2(state.time.bankHours - total) } },
    trip: {
      id,
      startMs: nowMs,
      legs: legs.map((l) => ({ ...l, chunksDone: 0, refundedHours: 0, ended: false })),
      nextChunk: 0,
      done: false,
    },
  };
}

// ---------- Resolving ----------

export function emptyReport(): TripReport {
  return { xp: {}, gained: {}, used: {}, burnt: {}, kills: {}, attempts: {}, found: [], questsCompleted: [], refundedHours: 0, levelUps: [], notes: [] };
}

const add = (bag: Record<string, number>, key: string, n: number) => {
  if (n) bag[key] = (bag[key] ?? 0) + n;
};

/** Hours of a leg not yet worked (and not yet refunded). */
const legRemaining = (leg: Leg) => round2(leg.hours - leg.chunksDone * CHUNK_HOURS - leg.refundedHours);

/** Burn chance for a cooking method at a level (PROG-037). */
export function burnChance(method: Method, level: number): number {
  if (method.kind !== 'process' || !method.burn) return 0;
  const { chanceAtUnlock, levelsToZero } = method.burn;
  return Math.max(0, chanceAtUnlock * (1 - (level - method.level) / levelsToZero));
}

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

function gainXP(state: GameState, report: TripReport, skill: GameSkill, amount: number, affinity: ReadonlySet<string>) {
  if (amount <= 0) return;
  const before = levelOf(state, skill);
  const total = amount * (affinity.has(skill) ? 1 + AFFINITY_BONUS : 1);
  state.xp[skill] = (state.xp[skill] ?? 0) + total;
  report.xp[skill] = (report.xp[skill] ?? 0) + total;
  const after = levelOf(state, skill);
  if (after > before) report.levelUps.push({ skill, level: after });
}

/** Ends a leg early and hands its unworked hours back; quest legs also hand their items back. */
function endLeg(state: GameState, trip: Trip, legIndex: number, report: TripReport, note: string) {
  const leg = trip.legs[legIndex];
  const refund = legRemaining(leg);
  leg.refundedHours = round2(leg.refundedHours + refund);
  leg.ended = true;
  state.time.bankHours = round2(state.time.bankHours + refund);
  report.refundedHours = round2(report.refundedHours + refund);
  if (refund > 0) report.notes.push(note);
  const act = activityOf(leg.activityId);
  if (act?.kind === 'quest' && refund > 0) {
    for (const [item, n] of Object.entries(act.quest.takes ?? {})) state.bank[item] = (state.bank[item] ?? 0) + n;
  }
}

const currentLeg = (trip: Trip) => trip.legs.findIndex((l) => !l.ended);
const workedChunks = (trip: Trip) => trip.legs.reduce((n, l) => n + l.chunksDone, 0);

function meleeXP(state: GameState, report: TripReport, focus: MeleeFocus, amount: number, affinity: ReadonlySet<string>) {
  if (focus === 'shared') {
    for (const s of ['Attack', 'Strength', 'Defence'] as const) gainXP(state, report, s, amount / 3, affinity);
  } else gainXP(state, report, focus, amount, affinity);
}

/** One half hour of fighting: attempts, wins, XP, bones, drops, luck meter. */
function fightChunk(state: GameState, leg: Leg, creature: Creature, rand: () => number, report: TripReport, affinity: ReadonlySet<string>) {
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
    meleeXP(state, report, leg.focus ?? 'shared', 4 * creature.hp, affinity);
    gainXP(state, report, 'Hitpoints', (4 / 3) * creature.hp, affinity);
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
      if (found) {
        add(state.bank, found, 1);
        report.found.push(found);
        state.dryKills[creature.id] = 0;
      } else state.dryKills[creature.id] = dry;
      if (rand() < 1 / pet.oneIn) {
        add(state.bank, pet.item, 1);
        report.found.push(pet.item);
      }
    }
  }
}

function completeQuest(state: GameState, quest: Quest, report: TripReport) {
  state.quests[quest.id] = true;
  for (const [item, n] of Object.entries(quest.rewards.items ?? {})) {
    add(state.bank, item, n);
    add(report.gained, item, n);
  }
  if (quest.rewards.lampXP) state.lamps.push(quest.rewards.lampXP);
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
  };
  const trip: Trip = { ...tripIn, legs: tripIn.legs.map((l) => ({ ...l })) };
  const report = emptyReport();
  if (trip.done) return { state, trip, report };

  for (;;) {
    const li = currentLeg(trip);
    if (li < 0) {
      trip.done = true;
      trip.finishedMs = trip.startMs + workedChunks(trip) * CHUNK_MS;
      break;
    }
    const leg = trip.legs[li];
    if (legRemaining(leg) <= 0) { leg.ended = true; continue; }
    const chunkStart = trip.startMs + workedChunks(trip) * CHUNK_MS;
    if (chunkStart + CHUNK_MS > nowMs) break; // this chunk hasn't finished yet

    const act = activityOf(leg.activityId)!;
    const rand = chunkRng(trip.id, trip.nextChunk);
    const affinity = affinityAt(chunkStart);

    if (act.kind === 'fight') {
      fightChunk(state, leg, act.creature, rand, report, affinity);
    } else if (act.kind === 'quest') {
      // Quests just take their time; rewards land when the last half hour finishes.
    } else {
      const method = act.method;
      const expected = effectiveRate(state, method, leg.regionId) * CHUNK_HOURS;
      if (method.kind === 'gather') {
        const count = stochasticRound(expected, rand);
        add(state.bank, method.output, count);
        add(report.gained, method.output, count);
        gainXP(state, report, method.skill, count * method.xpEach, affinity);
      } else {
        // Processing is limited by materials in the bank (PROG-026).
        const canMake = Math.min(...Object.entries(method.inputs).map(([id, n]) => Math.floor((state.bank[id] ?? 0) / n)));
        const wanted = stochasticRound(expected, rand);
        const made = Math.min(wanted, canMake);
        if (made <= 0) {
          endLeg(state, trip, li, report, `${method.name}: ran out of materials.`);
          continue; // the next leg starts in this same half hour
        }
        for (const [id, n] of Object.entries(method.inputs)) {
          state.bank[id] -= made * n;
          add(report.used, id, made * n);
        }
        const burnt = stochasticRound(made * burnChance(method, levelOf(state, method.skill)), rand);
        const ok = made - burnt;
        if (method.output) {
          add(state.bank, method.output, ok);
          add(report.gained, method.output, ok);
        }
        if (burnt && method.burn && method.output) {
          add(state.bank, method.burn.burntItem, burnt);
          add(report.burnt, method.output, burnt);
        }
        gainXP(state, report, method.skill, ok * method.xpEach, affinity);
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
    // keep the half hour that may be in progress on the current leg
    const inProgress = i === currentLeg(trip) ? CHUNK_HOURS : 0;
    const available = Math.max(0, legRemaining(leg) - inProgress);
    const needed = Math.ceil(-state.time.bankHours / CHUNK_HOURS) * CHUNK_HOURS;
    const cut = Math.min(available, needed);
    if (cut <= 0) continue;
    leg.hours = round2(leg.hours - cut);
    state.time.bankHours = round2(state.time.bankHours + cut);
    clawed = round2(clawed + cut);
    if (legRemaining(leg) <= 0) leg.ended = true;
  }
  if (currentLeg(trip) < 0) trip.done = true;
  return { state, trip, clawedHours: clawed };
}
