/**
 * Derived player stats. Screens must use these instead of computing their own,
 * so every screen shows the same numbers.
 */
import { calculateLevel } from './xpCalculations';

type SkillXP = { skillName: string; totalXP: number };

/**
 * OSRS-style total level: the sum of every skill's level across the whole roster.
 * Skills with no Firestore doc yet (e.g. ones added after sign-up) count as level 1.
 * Pass OSRS_SKILLS as the roster (kept as a parameter so this stays free of assets).
 */
export function getTotalLevel(skills: SkillXP[], roster: readonly string[]): number {
  const xpByName = new Map(skills.map(s => [s.skillName, s.totalXP]));
  return roster.reduce((sum, name) => sum + calculateLevel(xpByName.get(name) ?? 0), 0);
}

/** Total XP across all skills. */
export function getTotalXP(skills: SkillXP[]): number {
  return skills.reduce((sum, s) => sum + (s.totalXP || 0), 0);
}
