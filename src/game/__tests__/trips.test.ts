import { XP_TABLE } from '../../constants/xpTable';
import { burnChance, levelOf, newAdventurer } from '../adventurer';
import { CHUNK_MS } from '../rules';
import { mulberry32, stochasticRound } from '../rng';
import {
  advanceTrip, callBack, checkPlan, clawBackForDebt, craftHours, queueEndsMs, queueLegs, removeQueuedLeg, resizeQueuedLeg, sendTrip,
} from '../trips';
import { METHODS } from '../content/valley';
import { GameState, LegPlan } from '../types';

const HOUR = 2 * CHUNK_MS;
const T0 = Date.UTC(2026, 10, 19, 8, 0);

function adventurer(over: Partial<GameState> = {}, hours = 24): GameState {
  const s = newAdventurer('W1');
  return { ...s, ...over, time: { ...s.time, bankHours: hours } };
}
const leg = (activityId: string, hours: number, regionId = 'millbrook'): LegPlan => ({ activityId, regionId, hours });

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('stochastic rounding averages to the true value', () => {
    const r = mulberry32(7);
    let sum = 0;
    for (let i = 0; i < 20000; i++) sum += stochasticRound(33.25, r);
    expect(sum / 20000).toBeCloseTo(33.25, 1);
  });
});

describe('checkPlan', () => {
  it('rejects plans it cannot run', () => {
    const s = adventurer();
    expect(checkPlan(s, [])).toBe('no-legs');
    expect(checkPlan(s, [leg('mine-copper', 0.5), leg('mine-tin', 0.5), leg('chop-tree', 0.5), leg('net-shrimp', 0.5)])).toBeNull();
    expect(checkPlan(s, Array.from({ length: 41 }, () => leg('mine-copper', 0.5)))).toBe('queue-full');
    expect(checkPlan(s, [leg('mine-iron', 1, 'stonecrest')])).toBe('region-locked');
    expect(checkPlan({ ...s, quests: { 'road-to-stonecrest': true } }, [leg('mine-iron', 1, 'stonecrest')])).toBe('level-too-low');
    expect(checkPlan(s, [leg('rod-trout', 1, 'greywood')])).toBe('level-too-low');
    expect(checkPlan({ ...s, bank: {} }, [leg('mine-copper', 1)])).toBe('no-tool');
    expect(checkPlan(s, [leg('mine-copper', 0.75)])).toBe('bad-length');
    expect(checkPlan(adventurer({}, 2), [leg('mine-copper', 3)])).toBe('not-enough-time');
    expect(checkPlan(adventurer({}, -1), [leg('mine-copper', 1)])).toBe('in-debt');
    expect(checkPlan(s, [leg('mine-copper', 2)])).toBeNull();
  });
});

describe('advanceTrip', () => {
  it('mines about 70 copper an hour with a bronze pickaxe and spends the hours up front', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 4)], 'trip-1', T0);
    expect(sent.state.time.bankHours).toBe(20);
    const { state, trip, report } = advanceTrip(sent.state, sent.trip, T0 + 4 * HOUR);
    expect(trip.done).toBe(true);
    expect(report.gained.copper_ore).toBeGreaterThanOrEqual(278);
    expect(report.gained.copper_ore).toBeLessThanOrEqual(282);
    expect(state.xp.Mining).toBe(report.gained.copper_ore * 10);
  });

  it('only resolves half hours that have finished', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 2)], 'trip-2', T0);
    const mid = advanceTrip(sent.state, sent.trip, T0 + CHUNK_MS * 1.5);
    expect(mid.trip.nextChunk).toBe(1);
    expect(mid.trip.done).toBe(false);
  });

  it('gives the same result resolved in one go or in many steps', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 3), leg('mine-tin', 3), leg('smelt-bronze', 2)], 'trip-3', T0);
    const once = advanceTrip(sent.state, sent.trip, T0 + 10 * HOUR);
    let s = sent.state, t = sent.trip;
    for (let h = 0.25; h <= 10; h += 0.25) ({ state: s, trip: t } = advanceTrip(s, t, T0 + h * HOUR));
    expect(s).toEqual(once.state);
    expect(t).toEqual(once.trip);
  });

  it('gathers 20% more per hour with an iron pickaxe', () => {
    const s = adventurer({ bank: { iron_pickaxe: 1, bronze_pickaxe: 1 } });
    s.xp.Mining = XP_TABLE[10];
    const sent = sendTrip(s, [leg('mine-copper', 10)], 'trip-4', T0);
    const { report } = advanceTrip(sent.state, sent.trip, T0 + 10 * HOUR);
    expect(report.gained.copper_ore).toBeGreaterThanOrEqual(830);
    expect(report.gained.copper_ore).toBeLessThanOrEqual(850);
  });

  it('loses travel time in far regions (8% at Stonecrest)', () => {
    const s = adventurer({ quests: { 'road-to-stonecrest': true } });
    const sent = sendTrip(s, [leg('mine-copper', 10, 'stonecrest')], 'trip-5', T0);
    const { report } = advanceTrip(sent.state, sent.trip, T0 + 10 * HOUR);
    expect(report.gained.copper_ore).toBeGreaterThanOrEqual(634);
    expect(report.gained.copper_ore).toBeLessThanOrEqual(654);
  });

  it('feeds a later leg with what an earlier leg made, and refunds a leg that runs out (PROG-026)', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 1), leg('mine-tin', 1), leg('smelt-bronze', 4)], 'trip-6', T0);
    const { state, trip, report } = advanceTrip(sent.state, sent.trip, T0 + 6 * HOUR);
    expect(trip.done).toBe(true);
    const bars = report.gained.bronze_bar;
    expect(bars).toBe(Math.min(report.gained.copper_ore, report.gained.tin_ore));
    expect(trip.legs[2].ended).toBe(true);
    expect(trip.legs[2].refundedHours).toBeGreaterThan(2);
    expect(state.time.bankHours).toBeCloseTo(18 + trip.legs[2].refundedHours, 5);
    expect(report.notes[0]).toMatch(/ran out of materials/);
  });

  it('refunds a processing leg with no materials at all', () => {
    const sent = sendTrip(adventurer(), [leg('smelt-bronze', 2)], 'trip-7', T0);
    const { state, trip, report } = advanceTrip(sent.state, sent.trip, T0 + 2 * HOUR);
    expect(trip.done).toBe(true);
    expect(report.refundedHours).toBe(2);
    expect(state.time.bankHours).toBe(24);
  });

  it('burns some food at the unlock level and none twenty levels later (PROG-037)', () => {
    const cook = METHODS['cook-shrimp'];
    expect(burnChance(cook, 1)).toBeCloseTo(0.3);
    expect(burnChance(cook, 21)).toBe(0);
    const s = adventurer({ bank: { raw_shrimp: 1000 } });
    const sent = sendTrip(s, [leg('cook-shrimp', 2)], 'trip-8', T0);
    const { report, state } = advanceTrip(sent.state, sent.trip, T0 + 2 * HOUR);
    const made = report.used.raw_shrimp;
    expect(made).toBeGreaterThan(250);
    expect((report.burnt.shrimp ?? 0) / made).toBeGreaterThan(0.1);
    expect(state.bank.shrimp).toBe(report.gained.shrimp);
    expect(state.bank.burnt_food).toBe(report.burnt.shrimp);
    expect(state.bank.raw_shrimp).toBe(1000 - made);
  });

  it('adds the affinity bonus to skills your habits trained that day', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 1)], 'trip-9', T0);
    const plain = advanceTrip(sent.state, sent.trip, T0 + HOUR);
    const boosted = advanceTrip(sent.state, sent.trip, T0 + HOUR, () => new Set(['Mining']));
    expect(boosted.state.xp.Mining).toBeCloseTo(plain.state.xp.Mining * 1.1, 5);
  });

  it('reports level-ups', () => {
    const sent = sendTrip(adventurer(), [leg('chop-tree', 2)], 'trip-10', T0);
    const { report, state } = advanceTrip(sent.state, sent.trip, T0 + 2 * HOUR);
    expect(report.levelUps.length).toBeGreaterThan(0);
    expect(report.levelUps[report.levelUps.length - 1].level).toBe(levelOf(state, 'Woodcutting'));
  });
});

describe('callBack and clawBackForDebt', () => {
  it('calling back refunds every unworked hour', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 4), leg('mine-tin', 2)], 'trip-11', T0);
    const { state, trip, report } = callBack(sent.state, sent.trip, T0 + 1.2 * HOUR);
    expect(trip.done).toBe(true);
    expect(report.refundedHours).toBe(5);
    expect(state.time.bankHours).toBe(23);
  });

  it('takes debt back from unstarted hours, latest leg first (PROG-025)', () => {
    const sent = sendTrip(adventurer({}, 6), [leg('mine-copper', 3), leg('mine-tin', 3)], 'trip-12', T0);
    const inDebt: GameState = { ...sent.state, time: { ...sent.state.time, bankHours: -4 } };
    const { state, trip, clawedHours } = clawBackForDebt(inDebt, sent.trip);
    expect(clawedHours).toBe(4);
    expect(state.time.bankHours).toBe(0);
    expect(trip.legs[1].hours).toBe(0);
    expect(trip.legs[1].ended).toBe(true);
    expect(trip.legs[0].hours).toBe(2);
  });

  it('leaves debt it cannot cover', () => {
    const sent = sendTrip(adventurer({}, 1), [leg('mine-copper', 1)], 'trip-13', T0);
    const inDebt: GameState = { ...sent.state, time: { ...sent.state.time, bankHours: -3 } };
    const { state, clawedHours } = clawBackForDebt(inDebt, sent.trip);
    expect(clawedHours).toBe(0.5);
    expect(state.time.bankHours).toBe(-2.5);
  });
});

const order = (activityId: string, count: number, regionId = 'millbrook'): LegPlan => ({ activityId, regionId, hours: 0, count });
const MIN = 60 * 1000;
/** An adventurer at Smithing 20, so every bronze piece can be made. */
function smith(bank: Record<string, number>, hours = 24): GameState {
  const s = adventurer({}, hours);
  return { ...s, bank: { ...s.bank, ...bank }, xp: { ...s.xp, Smithing: XP_TABLE[20] } };
}

describe('work orders (PROG-043)', () => {
  it('takes only the minutes the items need', () => {
    expect(craftHours(60, 1)).toBeCloseTo(1 / 60, 4);
    expect(craftHours(120, 35)).toBeCloseTo(18 / 60, 4);
    expect(craftHours(24, 1)).toBeCloseTo(3 / 60, 4);
  });

  it('smiths one bronze helm in a minute', () => {
    const sent = sendTrip(smith({ bronze_bar: 2 }, 1), [order('smith-bronze_helm', 1)], 'wo-1', T0);
    expect(sent.trip.legs[0].hours).toBeCloseTo(1 / 60, 4);
    expect(sent.state.time.bankHours).toBeCloseTo(1 - 1 / 60, 4);
    expect(advanceTrip(sent.state, sent.trip, T0 + 0.5 * MIN).trip.done).toBe(false);
    const { state, trip, report } = advanceTrip(sent.state, sent.trip, T0 + MIN);
    expect(trip.done).toBe(true);
    expect(state.bank.bronze_helm).toBe(1);
    expect(state.bank.bronze_bar).toBe(0);
    expect(report.xp.Smithing).toBe(24);
  });

  it('makes a whole bronze set in one queue, one piece after another', () => {
    const pieces = ['helm', 'chestplate', 'platelegs', 'shield', 'boots', 'gloves'];
    const sent = sendTrip(smith({ bronze_bar: 15 }, 2), pieces.map((p) => order(`smith-bronze_${p}`, 1)), 'wo-2', T0);
    const minutes = sent.trip.legs.reduce((m, l) => m + l.hours * 60, 0);
    expect(minutes).toBeCloseTo(10, 1); // 1 + 3 + 2 + 2 + 1 + 1 minutes
    const { state, trip } = advanceTrip(sent.state, sent.trip, T0 + 10 * MIN);
    expect(trip.done).toBe(true);
    for (const p of pieces) expect(state.bank[`bronze_${p}`]).toBe(1);
    expect(state.bank.bronze_bar).toBe(0);
  });

  it('makes what it can when short and refunds the rest', () => {
    const sent = sendTrip(adventurer({ bank: { copper_ore: 10, tin_ore: 10 } }, 2), [order('smelt-bronze', 60)], 'wo-3', T0);
    expect(sent.trip.legs[0].hours).toBeCloseTo(0.5, 4);
    const { state, trip, report } = advanceTrip(sent.state, sent.trip, T0 + 5 * MIN);
    expect(trip.done).toBe(true);
    expect(state.bank.bronze_bar).toBe(10);
    expect(state.time.bankHours).toBeCloseTo(2 - 5 / 60, 4);
    expect(report.notes[0]).toMatch(/ran out of materials after 10/);
  });

  it('can use what an earlier block gathered', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 0.5), leg('mine-tin', 0.5), order('smelt-bronze', 20)], 'wo-4', T0);
    const { state, trip } = advanceTrip(sent.state, sent.trip, T0 + HOUR + 10 * MIN);
    expect(trip.done).toBe(true);
    expect(state.bank.bronze_bar).toBe(20);
  });

  it('resolves the same in one go or in small steps', () => {
    const plan = [order('smelt-bronze', 5), leg('mine-copper', 0.5), order('smelt-bronze', 3)];
    const sent = sendTrip(adventurer({ bank: { copper_ore: 8, tin_ore: 8, bronze_pickaxe: 1 } }), plan, 'wo-5', T0);
    const once = advanceTrip(sent.state, sent.trip, T0 + 2 * HOUR);
    let s = sent.state, t = sent.trip;
    for (let m = 1; m <= 120; m++) ({ state: s, trip: t } = advanceTrip(s, t, T0 + m * MIN));
    expect(s).toEqual(once.state);
    expect(t).toEqual(once.trip);
  });
});

describe('melting (PROG-044)', () => {
  it('is taught by The Melting Pot (OQ-37)', () => {
    const s = adventurer({ bank: { bronze_platelegs: 1 } });
    expect(checkPlan(s, [order('melt-bronze_platelegs', 1)])).toBe('needs-quest');
    expect(checkPlan({ ...s, quests: { 'melting-pot': true } }, [order('melt-bronze_platelegs', 1)])).toBeNull();
  });

  it('gives back half the bars, rounded down, and no XP', () => {
    expect(METHODS['melt-bronze_dagger']).toBeUndefined();
    const sent = sendTrip(adventurer({ bank: { bronze_platelegs: 2, bronze_chestplate: 1 }, quests: { 'melting-pot': true } }), [order('melt-bronze_platelegs', 2), order('melt-bronze_chestplate', 1)], 'melt-1', T0);
    const { state, report } = advanceTrip(sent.state, sent.trip, T0 + HOUR);
    expect(state.bank.bronze_bar).toBe(2 * 1 + 2);
    expect(state.bank.bronze_platelegs).toBe(0);
    expect(report.xp.Smithing ?? 0).toBe(0);
  });
});

describe('the queue (PROG-045)', () => {
  it('adds blocks to the end of a running queue', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 1)], 'q-1', T0);
    const mid = advanceTrip(sent.state, sent.trip, T0 + 0.5 * HOUR);
    const added = queueLegs(mid.state, mid.trip, [leg('mine-tin', 1)], 'unused', T0 + 0.5 * HOUR);
    expect(added.appended).toBe(true);
    expect(added.trip.id).toBe('q-1');
    expect(added.state.time.bankHours).toBe(22);
    expect(queueEndsMs(added.trip)).toBe(T0 + 2 * HOUR);
    const end = advanceTrip(added.state, added.trip, T0 + 2 * HOUR);
    expect(end.trip.done).toBe(true);
    expect(end.state.bank.tin_ore).toBeGreaterThan(60);
  });

  it('starts a new queue once the last one is done', () => {
    const sent = sendTrip(adventurer(), [leg('mine-copper', 0.5)], 'q-2', T0);
    const done = advanceTrip(sent.state, sent.trip, T0 + HOUR);
    const next = queueLegs(done.state, done.trip, [leg('mine-tin', 0.5)], 'q-3', T0 + HOUR);
    expect(next.appended).toBe(false);
    expect(next.trip).toMatchObject({ id: 'q-3', startMs: T0 + HOUR, nextChunk: 0 });
  });

  it('removes and resizes only blocks that have not started', () => {
    const sent = sendTrip(smith({ bronze_bar: 10 }, 10), [leg('mine-copper', 1), leg('mine-tin', 2), order('smith-bronze_boots', 2)], 'q-4', T0);
    expect(sent.state.time.bankHours).toBeCloseTo(10 - 3 - 1 / 60, 4);
    expect(() => removeQueuedLeg(sent.state, sent.trip, 0)).toThrow();
    const removed = removeQueuedLeg(sent.state, sent.trip, 1);
    expect(removed.trip.legs.map((l) => l.activityId)).toEqual(['mine-copper', 'smith-bronze_boots']);
    expect(removed.state.time.bankHours).toBeCloseTo(9 - 1 / 60, 4);
    const bigger = resizeQueuedLeg(removed.state, removed.trip, 1, { count: 10 });
    expect(bigger.trip.legs[1].count).toBe(10);
    expect(bigger.trip.legs[1].hours).toBeCloseTo(5 / 60, 4);
    expect(bigger.state.time.bankHours).toBeCloseTo(9 - 5 / 60, 4);
    expect(() => resizeQueuedLeg(bigger.state, bigger.trip, 1, { count: 0 })).toThrow();
  });

  it('cancels an unstarted work order whole to cover debt', () => {
    const sent = sendTrip(smith({ bronze_bar: 50 }, 2), [leg('mine-copper', 1), order('smith-bronze_chestplate', 10)], 'q-5', T0);
    const inDebt: GameState = { ...sent.state, time: { ...sent.state.time, bankHours: -0.2 } };
    const { state, trip } = clawBackForDebt(inDebt, sent.trip);
    expect(trip.legs[1].ended).toBe(true);
    expect(state.time.bankHours).toBeCloseTo(-0.2 + 25 / 60, 4);
  });
});
