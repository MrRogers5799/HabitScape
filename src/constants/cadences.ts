/**
 * Cadence Constants and Utilities
 *
 * Defines the cadence system for activities, including:
 * - Cadence options (daily, weekly, etc.)
 * - Helper functions for cadence management
 *
 * XP fairness is built into each activity's baseXP value, not the multiplier.
 * Low-frequency activities (weekly, monthly) have higher baseXP to compensate
 * for fewer completions per week. Each completion always earns exactly baseXP.
 */

import { Cadence } from '../types';

/**
 * Cadence information - maps cadence types to their metadata.
 * multiplier is always 1.0 — XP normalization lives in baseXP, not here.
 */
export const CADENCE_CONFIG: Record<Cadence, {
  label: string;
  description: string;
  timesPerWeek: number;
  multiplier: number;
}> = {
  'daily': {
    label: 'Daily (7x/week)',
    description: 'Every single day',
    timesPerWeek: 7,
    multiplier: 1.00,
  },
  '6x/week': {
    label: '6x/week',
    description: 'Six times per week',
    timesPerWeek: 6,
    multiplier: 1.00,
  },
  '5x/week': {
    label: '5x/week',
    description: 'Five times per week',
    timesPerWeek: 5,
    multiplier: 1.00,
  },
  '4x/week': {
    label: '4x/week',
    description: 'Four times per week',
    timesPerWeek: 4,
    multiplier: 1.00,
  },
  '3x/week': {
    label: '3x/week',
    description: 'Three times per week',
    timesPerWeek: 3,
    multiplier: 1.00,
  },
  '2x/week': {
    label: '2x/week',
    description: 'Twice per week',
    timesPerWeek: 2,
    multiplier: 1.00,
  },
  'weekly': {
    label: 'Weekly (1x/week)',
    description: 'Once per week',
    timesPerWeek: 1,
    multiplier: 1.00,
  },
  'monthly': {
    label: 'Monthly',
    description: 'Once per month',
    timesPerWeek: 0.25,
    multiplier: 1.00,
  },
};

/**
 * Helper function to get the multiplier for a cadence — always 1.0.
 * Retained for backwards compatibility with existing call sites.
 */
export function getCadenceMultiplier(cadence: Cadence): number {
  return CADENCE_CONFIG[cadence].multiplier;
}

/**
 * Helper function to get cadence info/label
 * @param cadence - The cadence type
 * @returns Human-readable label for the cadence
 */
export function getCadenceLabel(cadence: Cadence): string {
  return CADENCE_CONFIG[cadence].label;
}

/**
 * Helper function to get cadence description
 * @param cadence - The cadence type
 * @returns Human-readable description for the cadence
 */
export function getCadenceDescription(cadence: Cadence): string {
  return CADENCE_CONFIG[cadence].description;
}

/**
 * Helper function to get how many times per week a cadence is
 * @param cadence - The cadence type
 * @returns Number of times per week (e.g., 7 for daily, 1 for weekly, 0.25 for monthly)
 */
export function getTimesPerWeek(cadence: Cadence): number {
  return CADENCE_CONFIG[cadence].timesPerWeek;
}

/**
 * Returns XP earned per completion. Always equal to baseXP — cadence does not
 * scale XP. Frequency parity is handled by each activity's baseXP value.
 */
export function calculateXPPerCompletion(baseXP: number, _cadence: Cadence): number {
  return baseXP;
}

/**
 * Validate that a cadence is a valid cadence string
 * @param cadence - The cadence to validate
 * @returns true if the cadence is valid
 */
export function isValidCadence(cadence: any): cadence is Cadence {
  return cadence in CADENCE_CONFIG;
}

/**
 * Get all available cadence options
 * @returns Array of all valid cadence types
 */
export function getAllCadences(): Cadence[] {
  return Object.keys(CADENCE_CONFIG) as Cadence[];
}

/**
 * Calculate the next reset time for an activity based on its cadence
 * For daily: tomorrow at midnight in user's timezone
 * For weekly: next Monday at midnight in user's timezone
 * For monthly: first day of next month at midnight in user's timezone
 * 
 * Note: This is a client-side calculation and should be validated server-side
 * @param cadence - The cadence type
 * @param userTimezone - User's timezone string (e.g., "America/New_York")
 * @returns Date of next reset time
 */
export function calculateNextResetTime(cadence: Cadence, userTimezone: string, weekStartDay: 0 | 1 = 1): Date {
  // Create a date in the user's timezone
  const now = new Date();
  
  // For simplicity in MVP, we'll use UTC-based calculations
  // In production, use a library like 'date-fns-tz' or 'moment-timezone'
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (cadence === 'daily') {
    return tomorrow;
  }

  if (cadence === 'weekly') {
    const daysUntilStart = (weekStartDay - now.getDay() + 7) % 7;
    const nextWeekStart = new Date(now);
    nextWeekStart.setDate(nextWeekStart.getDate() + (daysUntilStart === 0 ? 7 : daysUntilStart));
    nextWeekStart.setHours(0, 0, 0, 0);
    return nextWeekStart;
  }

  if (cadence === '2x/week' || cadence === '3x/week' || cadence === '4x/week' || cadence === '5x/week' || cadence === '6x/week') {
    // For multi-week cadences, reset happens daily (user picks their days)
    // For MVP simplicity, we'll treat it as daily reset for the checklist
    return tomorrow;
  }

  if (cadence === 'monthly') {
    // Calculate first day of next month
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }

  // Fallback to tomorrow
  return tomorrow;
}
