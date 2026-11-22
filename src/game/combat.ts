/**
 * Combat (Combat note; PROG-008, PROG-010, PROG-015, PROG-017, PROG-020, PROG-028).
 *
 * Fights are calculated, never animated. Offence sets how fast kills come;
 * defence sets the chance of winning each attempt. A lost attempt costs only its time.
 * The model is deliberately simple so the planner can explain it in numbers.
 */
import { bestTool, levelOf } from './adventurer';
import { ITEMS } from './content/valley';
import { AttackType, Creature, GameSkill, GameState, ItemId, Loadout, LoadoutOverrides, SLOTS, Slot, ToolType } from './types';

/** Damage bonus for hitting a creature's weakness. */
export const WEAKNESS_BONUS = 1.25;
/** Kills per hour can't drop below or rise above these multiples of the creature's base rate. */
export const KPH_SCALE = { min: 0.25, max: 2 };

const canWear = (state: GameState, id: ItemId): boolean => {
  const eq = ITEMS[id]?.equip;
  return !!eq && (state.bank[id] ?? 0) > 0 && levelOf(state, eq.wear.skill) >= eq.wear.level;
};

/** Attack type of the main-hand weapon; bare hands count as crush. */
export const attackTypeOf = (loadout: Loadout): AttackType =>
  (loadout.mainHand && ITEMS[loadout.mainHand]?.equip?.attackType) || 'crush';

/** Offence: average of Attack and Strength, plus twice the weapon's power, boosted on a weakness. */
export function offence(state: GameState, loadout: Loadout, creature: Creature): number {
  const melee = Math.floor((levelOf(state, 'Attack') + levelOf(state, 'Strength')) / 2);
  const power = (loadout.mainHand && ITEMS[loadout.mainHand]?.equip?.power) || 0;
  const raw = melee + 2 * power;
  return creature.weakness && attackTypeOf(loadout) === creature.weakness ? raw * WEAKNESS_BONUS : raw;
}

export const armourOf = (loadout: Loadout): number =>
  SLOTS.reduce((sum, slot) => sum + ((loadout[slot] && ITEMS[loadout[slot]!]?.equip?.defence) || 0), 0);

/** Defence: Defence level, armour, a fifth of Hitpoints, and twice the food's healing if food is packed. */
export function defence(state: GameState, loadout: Loadout, foodHeal: number): number {
  return levelOf(state, 'Defence') + armourOf(loadout) + Math.floor(levelOf(state, 'Hitpoints') / 5) + 2 * foodHeal;
}

/** Chance of winning one attempt. */
export function winChance(def: number, creature: Creature): number {
  return Math.max(0.05, Math.min(0.99, 0.5 + (def - creature.attack) / 30));
}

/** Attempts per hour (before travel), from offence. */
export function attemptsPerHour(off: number, creature: Creature): number {
  const scale = Math.max(KPH_SCALE.min, Math.min(KPH_SCALE.max, off / creature.refPower));
  return creature.baseKph * scale;
}

/** The best food in the bank, if the fight uses food (trip supply, PROG-020). */
export function bestFood(state: GameState, creature: Creature): { id: ItemId; heal: number } | null {
  if (!creature.foodPerAttempt) return null;
  let best: { id: ItemId; heal: number } | null = null;
  for (const [id, n] of Object.entries(state.bank)) {
    const heal = ITEMS[id]?.food;
    if (n >= creature.foodPerAttempt && heal && (!best || heal > best.heal)) best = { id, heal };
  }
  return best;
}

/**
 * Auto-equip (PROG-015, PROG-029): the loadout that maximises kills per hour.
 * Armour slots take the highest defence you can wear; the main hand takes whichever
 * weapon gives the most offence against this creature (its weakness counts).
 * Overrides from the planner win, as long as the item is owned and wearable.
 */
export function pickLoadout(state: GameState, creature: Creature, overrides: LoadoutOverrides = {}): Loadout {
  const loadout: Loadout = {};
  const owned = Object.keys(state.bank).filter((id) => canWear(state, id));
  for (const slot of SLOTS) {
    const options = owned.filter((id) => ITEMS[id].equip!.slot === slot);
    if (slot === 'mainHand') {
      let best: ItemId | undefined;
      let bestOff = offence(state, {}, creature);
      for (const id of options) {
        const off = offence(state, { mainHand: id }, creature);
        if (off > bestOff) { bestOff = off; best = id; }
      }
      if (best) loadout.mainHand = best;
    } else {
      const best = options.sort((a, b) => (ITEMS[b].equip!.defence ?? 0) - (ITEMS[a].equip!.defence ?? 0))[0];
      if (best) loadout[slot] = best;
    }
  }
  for (const [slot, id] of Object.entries(overrides) as [Slot, ItemId | null][]) {
    if (id === null) delete loadout[slot];
    else if (canWear(state, id) && ITEMS[id].equip!.slot === slot) loadout[slot] = id;
  }
  return loadout;
}

/** Everything the trip planner shows for a fight (Combat note: "the player only sees the numbers"). */
/**
 * What the adventurer has on by default, for Hero's Gear section: in each slot the best
 * piece they can wear (most power for a weapon, most defence otherwise), and the best tool
 * of each type they can use. A fight may still pick differently against a weakness (PROG-015).
 */
export function wornGear(state: GameState): Set<ItemId> {
  const worn = new Set<ItemId>();
  const owned = Object.keys(state.bank).filter((id) => (state.bank[id] ?? 0) > 0);
  for (const slot of SLOTS) {
    const score = (id: ItemId) => (slot === 'mainHand' ? ITEMS[id].equip!.power ?? 0 : ITEMS[id].equip!.defence ?? 0);
    const best = owned.filter((id) => canWear(state, id) && ITEMS[id].equip!.slot === slot).sort((a, b) => score(b) - score(a))[0];
    if (best) worn.add(best);
  }
  const toolSkill: Record<ToolType, GameSkill> = { pickaxe: 'Mining', hatchet: 'Woodcutting', small_net: 'Fishing', fishing_rod: 'Fishing' };
  for (const type of Object.keys(toolSkill) as ToolType[]) {
    const best = bestTool(state, type, levelOf(state, toolSkill[type]));
    if (best) worn.add(best.id);
  }
  return worn;
}

/** The melee style with the lowest level (ties go to Attack): a new fight's default focus (PROG-051). */
export function lowestStyle(state: GameState): 'Attack' | 'Strength' | 'Defence' {
  return (['Attack', 'Strength', 'Defence'] as const).reduce((low, s) => (levelOf(state, s) < levelOf(state, low) ? s : low), 'Attack' as 'Attack' | 'Strength' | 'Defence');
}

export function fightPreview(state: GameState, creature: Creature, overrides?: LoadoutOverrides) {
  const loadout = pickLoadout(state, creature, overrides);
  const food = bestFood(state, creature);
  const off = offence(state, loadout, creature);
  const win = winChance(defence(state, loadout, food?.heal ?? 0), creature);
  const attempts = attemptsPerHour(off, creature);
  return {
    loadout,
    food: food?.id ?? null,
    attackType: attackTypeOf(loadout),
    hitsWeakness: !!creature.weakness && attackTypeOf(loadout) === creature.weakness,
    winChance: win,
    attemptsPerHour: attempts,
    killsPerHour: attempts * win,
  };
}
