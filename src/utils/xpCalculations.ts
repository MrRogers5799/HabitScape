/**
 * XP Calculation Utilities
 * 
 * This file contains all utility functions for XP-related calculations:
 * - Calculate level from total XP
 * - Calculate XP needed to reach next level
 * - Calculate progress percentage toward next level
 * - Format XP for display
 * 
 * These functions are critical for accurately displaying skill progression
 * and ensuring consistent XP calculations across the app.
 */

import { XP_TABLE, getAllLevels } from '../constants/xpTable';

/**
 * Calculate the level for a given total XP value
 * 
 * Looks up the XP table and finds the highest level where the required XP
 * is less than or equal to the user's total XP.
 * 
 * @param totalXP - User's total XP in the skill
 * @returns Level number from 1 to 99
 * 
 * @example
 * calculateLevel(0) // returns 1
 * calculateLevel(83) // returns 2
 * calculateLevel(174) // returns 3
 * calculateLevel(13034431) // returns 99
 */
export function calculateLevel(totalXP: number): number {
  // If no XP, user is level 1
  if (totalXP <= 0) {
    return 1;
  }

  // Find the highest level where required XP <= totalXP
  const levels = getAllLevels();
  for (let i = levels.length - 1; i >= 0; i--) {
    const level = levels[i];
    if (XP_TABLE[level] <= totalXP) {
      return level;
    }
  }

  // Fallback to level 1 (shouldn't reach here)
  return 1;
}

/**
 * Calculate the total XP needed to reach the next level
 * 
 * @param totalXP - User's current total XP in the skill
 * @returns Amount of XP still needed to reach next level
 * 
 * @example
 * calculateXPToNextLevel(0) // returns 83 (to reach level 2)
 * calculateXPToNextLevel(83) // returns 91 (174 - 83 = 91 to reach level 3)
 * calculateXPToNextLevel(13034431) // returns 0 (already at max)
 */
export function calculateXPToNextLevel(totalXP: number): number {
  const currentLevel = calculateLevel(totalXP);

  // If already at level 99, no XP needed to next level
  if (currentLevel >= 99) {
    return 0;
  }

  // Get XP needed for next level
  const nextLevelXP = XP_TABLE[currentLevel + 1];
  return Math.max(0, nextLevelXP - totalXP);
}

/**
 * Calculate current XP within the current level (progress toward next level)
 * 
 * @param totalXP - User's current total XP in the skill
 * @returns XP earned within the current level (not cumulative)
 * 
 * @example
 * calculateCurrentLevelXP(0) // returns 0 (at start of level 1)
 * calculateCurrentLevelXP(83) // returns 0 (just reached level 2)
 * calculateCurrentLevelXP(174) // returns 0 (just reached level 3)
 * calculateCurrentLevelXP(180) // returns 6 (6 XP into level 3, which requires 174-83=91 XP)
 */
export function calculateCurrentLevelXP(totalXP: number): number {
  const currentLevel = calculateLevel(totalXP);
  const levelRequiredXP = XP_TABLE[currentLevel];
  return Math.max(0, totalXP - levelRequiredXP);
}

/**
 * Calculate XP required for the current level (XP spread for that level)
 * 
 * @param totalXP - User's current total XP in the skill
 * @returns Total XP needed to complete current level (next level XP - current level XP)
 * 
 * @example
 * calculateLevelXPRange(0) // returns 83 (level 1->2 requires 83 XP)
 * calculateLevelXPRange(83) // returns 91 (level 2->3 requires 174-83=91 XP)
 * calculateLevelXPRange(13034431) // returns 0 (no more levels after 99)
 */
export function calculateLevelXPRange(totalXP: number): number {
  const currentLevel = calculateLevel(totalXP);

  // If at level 99, return 0 (no more XP range)
  if (currentLevel >= 99) {
    return 0;
  }

  const currentLevelXP = XP_TABLE[currentLevel];
  const nextLevelXP = XP_TABLE[currentLevel + 1];
  return nextLevelXP - currentLevelXP;
}

/**
 * Calculate progress percentage toward next level (0-100)
 * 
 * @param totalXP - User's current total XP in the skill
 * @returns Progress as percentage (0.0 to 100.0)
 * 
 * @example
 * calculateProgress(0) // returns 0 (just started level 1)
 * calculateProgress(41) // returns 49.4 (roughly halfway through level 1)
 * calculateProgress(174) // returns 0 (just reached next level)
 */
export function calculateProgress(totalXP: number): number {
  const currentLevel = calculateLevel(totalXP);

  // If at max level, progress is 100%
  if (currentLevel >= 99) {
    return 100;
  }

  const currentXP = calculateCurrentLevelXP(totalXP);
  const levelXPRange = calculateLevelXPRange(totalXP);

  if (levelXPRange === 0) {
    return 100;
  }

  // Return percentage rounded to 2 decimals
  return Math.round((currentXP / levelXPRange) * 10000) / 100;
}

/**
 * Format XP number for display with comma separators
 * 
 * @param xp - The XP value to format
 * @returns Formatted XP string with commas
 * 
 * @example
 * formatXP(1234567) // returns "1,234,567"
 * formatXP(100) // returns "100"
 * formatXP(0) // returns "0"
 */
export function formatXP(xp: number): string {
  return xp.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });
}

/**
 * Validate that an XP value is within valid bounds
 * 
 * @param xp - The XP value to validate
 * @returns true if XP is valid (0 to 13,034,431)
 */
export function isValidXPValue(xp: number): boolean {
  const MAX_XP = XP_TABLE[99];
  return xp >= 0 && xp <= MAX_XP && Number.isFinite(xp);
}

/**
 * Get quick XP statistics for a skill
 * 
 * @param totalXP - User's total XP in the skill
 * @returns Object containing level, XP progress details
 */
export function getXPStats(totalXP: number) {
  return {
    totalXP,
    level: calculateLevel(totalXP),
    currentLevelXP: calculateCurrentLevelXP(totalXP),
    xpToNextLevel: calculateXPToNextLevel(totalXP),
    levelXPRange: calculateLevelXPRange(totalXP),
    progressPercent: calculateProgress(totalXP),
  };
}
