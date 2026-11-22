import { XP_TABLE } from '../../constants/xpTable';
import { newAdventurer, applyLamp } from '../adventurer';
import { fightPreview, pickLoadout } from '../combat';
import { CREATURES } from '../content/valley';
import { CHUNK_MS } from '../rules';
import { advanceTrip, checkPlan, fightId, questId, sendTrip } from '../trips';
import { GameSkill, GameState, LegPlan } from '../types';

const HOUR = 2 * CHUNK_MS;
const T0 = Date.UTC(2026, 10, 19, 8, 0);

function adventurer(levels: Partial<Record<GameSkill, number>> = {}, bank: Record<string, number> = {}, hours = 48): GameState {
  const s = newAdventurer('W1');
  for (const [skill, lvl] of Object.entries(levels)) s.xp[skill as GameSkill] = XP_TABLE[lvl!];
  return { ...s, bank: { ...s.bank, ...bank }, time: { ...s.time, bankHours: hours } };
}
const leg = (activityId: string, hours: number, regionId = 'millbrook', extra: Partial<LegPlan> = {}): LegPlan => ({ activityId, regionId, hours, ...extra });
const STEEL_SET = { steel_helm: 1, steel_chestplate: 1, steel_platelegs: 1, steel_boots: 1, steel_gloves: 1, steel_shield: 1 };

describe('pickLoadout (PROG-015)', () => {
  it("picks the weapon that hits the creature's weakness when that's stronger", () => {
    const s = adventurer({}, { bronze_dagger: 1, bronze_sword: 1 });
    expect(pickLoadout(s, CREATURES.goblin).mainHand).toBe('bronze_dagger'); // goblins are weak to stab
    expect(pickLoadout(s, CREATURES.wolf).mainHand).toBe('bronze_sword'); // wolves are weak to slash
  });

  it('wears the best armour the adventurer can wear', () => {
    const low = adventurer({}, { bronze_helm: 1, iron_helm: 1 });
    expect(pickLoadout(low, CREATURES.goblin).head).toBe('bronze_helm');
    const high = adventurer({ Defence: 10 }, { bronze_helm: 1, iron_helm: 1 });
    expect(pickLoadout(high, CREATURES.goblin).head).toBe('iron_helm');
  });

  it('applies the player\'s overrides when they are valid', () => {
    const s = adventurer({}, { bronze_dagger: 1, bronze_sword: 1, bronze_helm: 1 });
    const l = pickLoadout(s, CREATURES.goblin, { mainHand: 'bronze_sword', head: null, chest: 'steel_chestplate' });
    expect(l.mainHand).toBe('bronze_sword');
    expect(l.head).toBeUndefined();
    expect(l.chest).toBeUndefined(); // not owned, so ignored
  });
});

describe('fights', () => {
  it('kills goblins, earns XP in the chosen focus plus Hitpoints, and always drops bones (PROG-018)', () => {
    const s = adventurer({ Attack: 5, Strength: 5 });
    const sent = sendTrip(s, [leg(fightId('goblin'), 2, 'millbrook', { focus: 'Strength' })], 'f1', T0);
    const { state, report } = advanceTrip(sent.state, sent.trip, T0 + 2 * HOUR);
    const kills = report.kills.goblin;
    expect(kills).toBeGreaterThan(20); // about 24 kills an hour at level 5 with a bronze dagger
    expect(kills).toBeLessThan(70);
    expect(report.gained.bones).toBe(kills);
    expect(report.xp.Strength).toBe(kills * 40);
    expect(report.xp.Attack).toBeUndefined();
    expect(report.xp.Hitpoints).toBeCloseTo((kills * 40) / 3, 5);
    expect(state.kills.goblin).toBe(kills);
  });

  it('splits melee XP three ways on shared focus', () => {
    const sent = sendTrip(adventurer(), [leg(fightId('chicken'), 1)], 'f2', T0);
    const { report } = advanceTrip(sent.state, sent.trip, T0 + HOUR);
    expect(report.xp.Attack).toBeCloseTo(report.xp.Strength!, 5);
    expect(report.xp.Defence).toBeCloseTo(report.xp.Strength!, 5);
  });

  it('packs food for the boss: it raises win chance and gets eaten (PROG-020)', () => {
    const base = adventurer({ Attack: 30, Strength: 30, Defence: 30, Hitpoints: 30 }, { ...STEEL_SET, steel_mace: 1 });
    base.quests['road-to-stonecrest'] = true;
    base.quests['drowned-bell'] = true;
    const without = fightPreview({ ...base, bank: { ...base.bank, shrimp: 0 } }, CREATURES['bog-warden']);
    const withFood = fightPreview({ ...base, bank: { ...base.bank, salmon: 200 } }, CREATURES['bog-warden']);
    expect(withFood.winChance).toBeGreaterThan(without.winChance);
    expect(withFood.hitsWeakness).toBe(true);

    const sent = sendTrip({ ...base, bank: { ...base.bank, salmon: 200 } }, [leg(fightId('bog-warden'), 2, 'bog')], 'f3', T0);
    const { report } = advanceTrip(sent.state, sent.trip, T0 + 2 * HOUR);
    expect(report.used.salmon).toBe(2 * report.attempts['bog-warden']);
  });

  it('fights without food when none is packed (supplies are never required)', () => {
    const s = adventurer({ Attack: 30, Strength: 30, Defence: 30 }, { ...STEEL_SET, steel_mace: 1, shrimp: 0 });
    s.quests['road-to-stonecrest'] = true;
    s.quests['drowned-bell'] = true;
    expect(checkPlan(s, [leg(fightId('bog-warden'), 1, 'bog')])).toBeNull();
  });

  it('guarantees a missing unique once the luck meter is full (PROG-030)', () => {
    const s = adventurer({ Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60 }, { ...STEEL_SET, steel_mace: 1, salmon: 500 });
    s.quests['road-to-stonecrest'] = true;
    s.quests['drowned-bell'] = true;
    s.dryKills['bog-warden'] = 59;
    const sent = sendTrip(s, [leg(fightId('bog-warden'), 0.5, 'bog')], 'f4', T0);
    const { state, report } = advanceTrip(sent.state, sent.trip, T0 + HOUR);
    expect(report.kills['bog-warden']).toBeGreaterThan(0);
    expect(report.found.some((i) => i === 'wardens_maul' || i === 'bog_iron_helm')).toBe(true);
    expect(state.dryKills['bog-warden']).toBeLessThan(60);
    // The collection log (PROG-047) records it once, with the kill count it came at.
    const unique = report.found.find((i) => i === 'wardens_maul' || i === 'bog_iron_helm')!;
    expect(state.collection[unique].kc).toBeGreaterThan(0);
    expect(state.collection[unique].kc).toBeLessThanOrEqual(state.kills['bog-warden']);
    expect(state.collection[unique].atMs).toBeGreaterThanOrEqual(T0);
    expect(report.gained[unique]).toBe(1);
  });
});

describe('smithing and Prayer', () => {
  it('smiths gear from bars at XP per bar used', () => {
    const s = adventurer({}, { bronze_bar: 10 });
    const sent = sendTrip(s, [leg('smith-bronze_dagger', 1)], 's1', T0);
    const { state, report } = advanceTrip(sent.state, sent.trip, T0 + HOUR);
    expect(report.gained.bronze_dagger).toBe(10);
    expect(state.bank.bronze_dagger).toBe(11);
    expect(report.xp.Smithing).toBe(10 * 12);
  });

  it('buries bones for Prayer XP (PROG-018, PROG-033)', () => {
    const s = adventurer({}, { bones: 50 });
    const sent = sendTrip(s, [leg('bury-bones', 0.5)], 'p1', T0);
    const { state, report } = advanceTrip(sent.state, sent.trip, T0 + HOUR);
    expect(report.xp.Prayer).toBe(50 * 6);
    expect(state.bank.bones).toBe(0);
  });
});

describe('quests', () => {
  it('checks requirements, takes items on start, and pays rewards when done', () => {
    const notYet = adventurer({ Cooking: 5 }, { shrimp: 10 });
    expect(checkPlan(notYet, [leg(questId('supper-for-the-smith'), 1)])).toBe('quest-requirements');

    const s = adventurer({ Cooking: 5 }, { shrimp: 25 });
    expect(checkPlan(s, [leg(questId('supper-for-the-smith'), 2)])).toBe('quest-length');
    const sent = sendTrip(s, [leg(questId('supper-for-the-smith'), 1)], 'q1', T0);
    expect(sent.state.bank.shrimp).toBe(5);
    const { state, report } = advanceTrip(sent.state, sent.trip, T0 + HOUR);
    expect(report.questsCompleted).toEqual(['supper-for-the-smith']);
    expect(state.bank.fishing_rod).toBe(1);
    // Quest XP goes straight to its skill (PROG-048), not into a lamp.
    expect(state.lamps).toEqual([]);
    expect(state.xp.Cooking).toBe(s.xp.Cooking + 500);
    expect(report.xp.Cooking).toBe(500);
    expect(checkPlan(state, [leg(questId('supper-for-the-smith'), 1)])).toBe('quest-done');

    // Lamps already in older saves still work.
    const lit = applyLamp({ ...state, lamps: [500] }, 0, 'Mining');
    expect(lit.xp.Mining).toBe(state.xp.Mining + 500);
    expect(lit.lamps).toEqual([]);
  });

  it('opens a region when its quest is done (PROG-007)', () => {
    const s = adventurer({ Attack: 15 });
    expect(checkPlan(s, [leg('mine-copper', 1, 'stonecrest')])).toBe('region-locked');
    s.kills.wolf = 10;
    const sent = sendTrip(s, [leg(questId('road-to-stonecrest'), 2)], 'q2', T0);
    const { state } = advanceTrip(sent.state, sent.trip, T0 + 2 * HOUR);
    expect(checkPlan(state, [leg('mine-copper', 1, 'stonecrest')])).toBeNull();
  });
});
