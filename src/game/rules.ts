/**
 * Numbers the game rules are built on, each traced to its decision in the vault.
 */

/** PROG-022: adventure hours earned per habit XP. */
export const HOURS_PER_HABIT_XP = 1 / 50;
/** PROG-022: most adventure hours that can be earned in one week. */
export const WEEKLY_HOURS_CAP = 84;
/** Most hours the bank holds; extra spills. */
export const BANK_HOURS_CAP = 48;
/** PROG-011: trips run in half-hour chunks. */
export const CHUNK_HOURS = 0.5;
export const CHUNK_MS = CHUNK_HOURS * 60 * 60 * 1000;
/** PROG-026: a trip chains up to this many legs. */
export const MAX_LEGS = 3;
/** PROG-029: each tool tier gathers this much more per hour than the one below. */
export const TOOL_TIER_STEP = 1.2;
/** Affinity: XP bonus in the game for a skill your habits trained that day. */
export const AFFINITY_BONUS = 0.1;
