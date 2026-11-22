/**
 * The adventurer: levels, tools, lamps and a fresh starting state.
 */
import { XP_TABLE } from '../constants/xpTable';
import { calculateLevel } from '../utils/xpCalculations';
import { ITEMS, STARTING_BANK } from './content/valley';
import { TOOL_TIER_STEP } from './rules';
import { GAME_SKILLS, GameSkill, GameState, Method, ToolType, TripReport } from './types';

export const levelOf = (state: GameState, skill: GameSkill): number => calculateLevel(state.xp[skill] ?? 0);

/** A new adventurer: every skill at 1 except Hitpoints at 10 (content sheet §10). */
export function newAdventurer(weekId: string): GameState {
  const xp = {} as Record<GameSkill, number>;
  for (const s of GAME_SKILLS) xp[s] = 0;
  xp.Hitpoints = XP_TABLE[10];
  return {
    xp,
    bank: { ...STARTING_BANK },
    time: { bankHours: 0, weekId, weekEarnedHours: 0 },
    quests: {},
    kills: {},
    dryKills: {},
    lamps: [],
    ordersFilled: {},
    collection: {},
    journey: { claimed: {}, welcomed: false },
  };
}

/**
 * The best tool of a type the adventurer owns and can use at their level
 * (auto-equip, PROG-015). Returns null if they have none they can use.
 */
export function bestTool(state: GameState, type: ToolType, skillLevel: number): { id: string; tier: number } | null {
  let best: { id: string; tier: number } | null = null;
  for (const [id, count] of Object.entries(state.bank)) {
    const tool = ITEMS[id]?.tool;
    if (!count || !tool || tool.type !== type || tool.level > skillLevel) continue;
    if (!best || tool.tier > best.tier) best = { id, tier: tool.tier };
  }
  return best;
}

/** Gather-rate multiplier for a tool tier (PROG-029: about 20% per tier). */
export const toolMultiplier = (tier: number): number => Math.pow(TOOL_TIER_STEP, tier - 1);

/** Uses an XP lamp from a quest: its XP goes into any skill the player picks. */
export function applyLamp(state: GameState, lampIndex: number, skill: GameSkill): GameState {
  const amount = state.lamps[lampIndex];
  if (amount === undefined) throw new Error('No such lamp');
  return {
    ...state,
    xp: { ...state.xp, [skill]: (state.xp[skill] ?? 0) + amount },
    lamps: state.lamps.filter((_, i) => i !== lampIndex),
  };
}

/** Burn chance for a cooking method at a level (PROG-037). */
export function burnChance(method: Method, level: number): number {
  if (method.kind !== 'process' || !method.burn) return 0;
  const { chanceAtUnlock, levelsToZero } = method.burn;
  return Math.max(0, chanceAtUnlock * (1 - (level - method.level) / levelsToZero));
}

/** Reward XP (quests, village orders, PROG-048): added to the skill, with any level-up reported. */
export function addRewardXP(state: GameState, report: TripReport | null, skill: GameSkill, amount: number) {
  if (amount <= 0) return;
  const before = levelOf(state, skill);
  state.xp[skill] = (state.xp[skill] ?? 0) + amount;
  if (!report) return;
  report.xp[skill] = (report.xp[skill] ?? 0) + amount;
  const after = levelOf(state, skill);
  if (after > before) report.levelUps.push({ skill, level: after });
}
