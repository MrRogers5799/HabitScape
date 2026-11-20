/**
 * Game layer types (PLAT-007).
 *
 * Everything in src/game is pure TypeScript: no React, no Firebase, no clocks.
 * Callers pass in the current time and any day/week ids, so every result can be
 * recomputed and tested.
 */

/** Skills that exist in the game layer's first slice. Names match the app's skill IDs (PROD-003). */
export const GAME_SKILLS = [
  'Attack', 'Strength', 'Defence', 'Hitpoints', 'Prayer',
  'Mining', 'Smithing', 'Woodcutting', 'Fishing', 'Cooking',
] as const;
export type GameSkill = typeof GAME_SKILLS[number];

export type ItemId = string;
export type RegionId = string;

/** Item counts the adventurer owns. Missing keys mean zero. */
export type Bank = Record<ItemId, number>;

export interface Region {
  id: RegionId;
  name: string;
  /** Share of every trip spent travelling there (PROG-036). */
  travelFraction: number;
  /** Quest that opens the region, if any (PROG-007). */
  questGate?: string;
}

// ---------- Items and gear ----------

export type ToolType = 'pickaxe' | 'hatchet' | 'small_net' | 'fishing_rod';

export interface ToolInfo {
  type: ToolType;
  /** 1 = bronze, 2 = iron, 3 = steel, … Untiered tools are tier 1. */
  tier: number;
  /** Level needed in the method's skill to use it. */
  level: number;
}

/** Ten gear slots (PROG-016, PROG-021). */
export const SLOTS = ['head', 'neck', 'cape', 'chest', 'legs', 'boots', 'gloves', 'ring', 'mainHand', 'offHand'] as const;
export type Slot = typeof SLOTS[number];

/** Melee attack types (PROG-017). Ranged and magic types arrive with those styles. */
export type AttackType = 'stab' | 'slash' | 'crush';

export interface Equip {
  slot: Slot;
  /** Level needed to wear or wield it. */
  wear: { skill: GameSkill; level: number };
  /** Weapons: attack type and power. */
  attackType?: AttackType;
  power?: number;
  /** Armour: defence. */
  defence?: number;
}

export interface Item {
  id: ItemId;
  name: string;
  tool?: ToolInfo;
  equip?: Equip;
  /** Food: how much it heals (trip supply, PROG-020). */
  food?: number;
}

export type Loadout = Partial<Record<Slot, ItemId>>;
/** Player choices in the trip planner: an item, or null to leave the slot empty (PROG-015). */
export type LoadoutOverrides = Partial<Record<Slot, ItemId | null>>;

// ---------- Methods (gathering and processing) ----------

interface MethodBase {
  id: string;
  name: string;
  skill: GameSkill;
  /** Level needed to use the method. */
  level: number;
  /** Regions where the method is available. */
  regions: RegionId[];
  /** XP per item made, gathered or used (PROG-016). */
  xpEach: number;
  /** Items per hour of work, with a tier-1 tool. */
  perHour: number;
}

export interface GatherMethod extends MethodBase {
  kind: 'gather';
  output: ItemId;
  tool: ToolType;
  /** Fishing tools aren't tiered in the first slice. */
  toolTiered: boolean;
}

export interface ProcessMethod extends MethodBase {
  kind: 'process';
  /** Items used per action. */
  inputs: Record<ItemId, number>;
  /** What each action makes; none for burying bones. */
  output?: ItemId;
  /** Cooking burns (PROG-037): chance at the unlock level, falling to 0 over `levelsToZero` levels. */
  burn?: { chanceAtUnlock: number; levelsToZero: number; burntItem: ItemId };
}

export type Method = GatherMethod | ProcessMethod;

// ---------- Combat ----------

export interface DropEntry {
  item: ItemId;
  /** Chance per kill (1 = always). */
  chance: number;
  min: number;
  max: number;
}

export interface Creature {
  id: string;
  name: string;
  level: number;
  hp: number;
  region: RegionId;
  weakness?: AttackType;
  /** Kills per hour at `refPower` offence; scales with offence (content sheet §6). */
  baseKph: number;
  refPower: number;
  /** How hard it hits back; your defence against this sets your win chance per attempt. */
  attack: number;
  /** Food eaten per attempt, if you packed any. */
  foodPerAttempt: number;
  bones: ItemId;
  drops: DropEntry[];
  boss?: {
    /** Unique drops and their rates (1 in N per kill). */
    uniques: { item: ItemId; oneIn: number }[];
    pet: { item: ItemId; oneIn: number };
  };
}

/** Where melee XP goes (Combat note: you pick a focus). */
export type MeleeFocus = 'Attack' | 'Strength' | 'Defence' | 'shared';

// ---------- Quests ----------

export type QuestRequirement =
  | { kind: 'skill'; skill: GameSkill; level: number }
  | { kind: 'kills'; creature: string; count: number }
  | { kind: 'item'; item: ItemId; count: number }
  | { kind: 'quest'; quest: string };

export interface Quest {
  id: string;
  name: string;
  region: RegionId;
  hours: number;
  requirements: QuestRequirement[];
  /** Items handed over when the quest starts. */
  takes?: Record<ItemId, number>;
  rewards: { items?: Record<ItemId, number>; lampXP?: number };
}

// ---------- State ----------

/** Adventure time (PROG-022). Hours are banked; negative means debt (PROG-025). */
export interface AdventureTime {
  bankHours: number;
  /** Caller-supplied id of the current week (e.g. '2026-W47' using the user's week start). */
  weekId: string;
  weekEarnedHours: number;
}

/** What a single habit completion added, so unticking can take exactly that back. */
export interface TimeGrant {
  weekHours: number;
  bankHours: number;
}

export interface GameState {
  xp: Record<GameSkill, number>;
  bank: Bank;
  time: AdventureTime;
  /** Completed quests. */
  quests: Record<string, true>;
  /** Kill counts per creature (PROG-007 gates). */
  kills: Record<string, number>;
  /** Kills since the last unique, per boss (luck meter, PROG-030). */
  dryKills: Record<string, number>;
  /** Unused XP lamps from quests: XP the player puts into any skill. */
  lamps: number[];
}

// ---------- Trips ----------

export interface LegPlan {
  /** A method id, a fight id (`fight-<creature>`) or a quest id (`quest-<quest>`). */
  activityId: string;
  regionId: RegionId;
  /** Planned length in hours, in 0.5 steps. Quests take their own length. */
  hours: number;
  /** Fights: where melee XP goes. Defaults to shared. */
  focus?: MeleeFocus;
  /** Fights: slots the player chose by hand (PROG-015). */
  overrides?: LoadoutOverrides;
}

export interface Leg extends LegPlan {
  /** Half-hour chunks worked so far. */
  chunksDone: number;
  /** Hours handed back (materials ran out, called back, or clawed back for debt). */
  refundedHours: number;
  ended: boolean;
}

export interface Trip {
  id: string;
  startMs: number;
  legs: Leg[];
  /** Index of the next half-hour chunk to resolve, counted from startMs. */
  nextChunk: number;
  done: boolean;
  finishedMs?: number;
}

/** What happened while a trip was advanced, for the return screen. */
export interface TripReport {
  xp: Partial<Record<GameSkill, number>>;
  gained: Bank;
  used: Bank;
  burnt: Bank;
  kills: Record<string, number>;
  attempts: Record<string, number>;
  /** Boss uniques and pets found. */
  found: ItemId[];
  questsCompleted: string[];
  refundedHours: number;
  levelUps: { skill: GameSkill; level: number }[];
  notes: string[];
}
