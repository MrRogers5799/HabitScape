import { XP_TABLE } from '../../constants/xpTable';
import { levelOf, newAdventurer } from '../adventurer';
import { CHUNK_MS } from '../rules';
import { mulberry32, stochasticRound } from '../rng';
import { advanceTrip, burnChance, callBack, checkPlan, clawBackForDebt, sendTrip } from '../trips';
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
    expect(checkPlan(s, [leg('mine-copper', 1), leg('mine-tin', 1), leg('chop-tree', 1), leg('net-shrimp', 1)])).toBe('too-many-legs');
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
