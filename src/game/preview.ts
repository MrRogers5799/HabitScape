/**
 * Trip planner previews (PROG-011, PROG-026): what each leg should bring back, before
 * the player sends it. Expected values only (no randomness). Legs are previewed in
 * order, carrying expected items forward, so "mine copper, then smelt bronze" works.
 */
import { burnChance, levelOf } from './adventurer';
import { fightPreview } from './combat';
import { CHUNK_HOURS } from './rules';
import { activityOf, canMakeFrom, checkLeg, effectiveRate, isWorkOrder, normaliseLeg, PlanProblem, requirementMet } from './trips';
import { GameState, LegPlan, QuestRequirement } from './types';

export type LegPreview =
  | {
      kind: 'method'; skill: string; perHour: number; count: number; xp: number; output?: string;
      uses: Record<string, number>; burnChance: number;
      /** Set when materials run out before the leg ends (it will stop and refund, PROG-026). */
      runsOutAfterHours?: number;
      /** Work orders (PROG-043): how many of the order can't be made from what will be in the bank. */
      short?: number;
    }
  | {
      kind: 'fight'; winChance: number; killsPerHour: number; kills: number; styleXP: number; hitpointsXP: number;
      loadout: Record<string, string>; food: string | null; foodUsed: number; hitsWeakness: boolean;
    }
  | { kind: 'quest'; requirements: { req: QuestRequirement; met: boolean }[] };

export interface PlanPreview {
  legs: { plan: LegPlan; problem: PlanProblem | null; preview: LegPreview | null }[];
  totalHours: number;
  /** What the bank should hold once these blocks finish (expected values). */
  bankAfter: GameState['bank'];
}

/**
 * `bankAfterQueue`, when given, is what the bank should hold once the blocks already
 * queued finish, so new blocks are previewed from there.
 */
export function previewPlan(stateIn: GameState, legs: LegPlan[], bankAfterQueue?: GameState['bank']): PlanPreview {
  const state: GameState = { ...stateIn, bank: { ...(bankAfterQueue ?? stateIn.bank) } };
  const out: PlanPreview = { legs: [], totalHours: 0, bankAfter: state.bank };
  for (const raw of legs) {
    const plan = normaliseLeg(stateIn, raw);
    out.totalHours += plan.hours;
    const act = activityOf(plan.activityId);
    // Later legs may use earlier legs' output, so only flag hard problems here.
    const problem = checkLeg(state, plan);
    if (!act) { out.legs.push({ plan, problem, preview: null }); continue; }

    if (act.kind === 'method') {
      const m = act.method;
      const perHour = effectiveRate(state, m, plan.regionId);
      let count = perHour * plan.hours;
      let runsOutAfterHours: number | undefined;
      let short: number | undefined;
      const uses: Record<string, number> = {};
      if (m.kind === 'process' && isWorkOrder(plan)) {
        const canMake = canMakeFrom(state.bank, m);
        count = Math.min(plan.count!, canMake);
        if (canMake < plan.count!) short = plan.count! - canMake;
        for (const [id, n] of Object.entries(m.inputs)) {
          uses[id] = count * n;
          state.bank[id] = (state.bank[id] ?? 0) - uses[id];
        }
      } else if (m.kind === 'process') {
        const canMake = canMakeFrom(state.bank, m);
        if (canMake < count) {
          count = canMake;
          runsOutAfterHours = Math.ceil((canMake / perHour) / CHUNK_HOURS) * CHUNK_HOURS;
        }
        for (const [id, n] of Object.entries(m.inputs)) {
          uses[id] = Math.round(count * n);
          state.bank[id] = (state.bank[id] ?? 0) - uses[id];
        }
      }
      const burn = burnChance(m, levelOf(state, m.skill));
      const made = Math.floor(count * (1 - burn));
      const each = m.kind === 'process' ? m.outputEach ?? 1 : 1;
      const output = m.output;
      if (output) state.bank[output] = (state.bank[output] ?? 0) + made * each;
      out.legs.push({
        plan, problem,
        preview: {
          kind: 'method', skill: m.skill, perHour, count: Math.floor(count) * each, xp: Math.round(made * m.xpEach), output, uses,
          burnChance: burn, runsOutAfterHours, short,
        },
      });
    } else if (act.kind === 'fight') {
      const c = act.creature;
      const p = fightPreview(state, c, plan.overrides);
      const kills = p.killsPerHour * plan.hours;
      const foodUsed = p.food ? Math.round(p.attemptsPerHour * plan.hours * c.foodPerAttempt) : 0;
      if (p.food) state.bank[p.food] = Math.max(0, (state.bank[p.food] ?? 0) - foodUsed);
      out.legs.push({
        plan, problem,
        preview: {
          kind: 'fight', winChance: p.winChance, killsPerHour: p.killsPerHour, kills,
          styleXP: Math.round(kills * 4 * c.hp), hitpointsXP: Math.round((kills * 4 * c.hp) / 3),
          loadout: p.loadout as Record<string, string>, food: p.food, foodUsed, hitsWeakness: p.hitsWeakness,
        },
      });
    } else {
      out.legs.push({
        plan, problem,
        preview: { kind: 'quest', requirements: act.quest.requirements.map((req) => ({ req, met: requirementMet(stateIn, req) })) },
      });
    }
  }
  return out;
}
