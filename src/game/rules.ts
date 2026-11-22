/**
 * Numbers the game rules are built on, each traced to its decision in the vault.
 */

/** PROG-022: adventure hours earned per habit XP. */
export const HOURS_PER_HABIT_XP = 1 / 50;
/** PROG-022: most adventure hours that can be earned in one week. */
export const WEEKLY_HOURS_CAP = 84;
/** PROG-011: trips run in half-hour chunks. */
export const CHUNK_HOURS = 0.5;
export const CHUNK_MS = CHUNK_HOURS * 60 * 60 * 1000;
/**
 * PROG-045: the queue has no game limit (banked time is the limit). This only keeps a
 * queue document a sane size; the security rules allow the same.
 */
export const MAX_QUEUE_BLOCKS = 40;
/** PROG-044: melting smithed gear gives back this share of its bars, rounded down. */
export const MELT_SHARE = 0.5;
/** PROG-044: orders on each village's board per day. */
export const ORDERS_PER_BOARD = 3;
/** PROG-029: each tool tier gathers this much more per hour than the one below. */
export const TOOL_TIER_STEP = 1.2;
/** Affinity: XP bonus in the game for a skill your habits trained that day. */
export const AFFINITY_BONUS = 0.1;
/** PROG-046: each XP point earned in a skill is a 1 in this many roll for its pet. */
export const PET_XP = 5_000_000;
