/**
 * Cadence Constants and Utilities
 * 
 * Defines the cadence system for activities, including:
 * - Cadence options (daily, weekly, etc.)
 * - Multipliers for fair XP scaling
 * - Helper functions for cadence management
 * 
 * The cadence multiplier ensures that fairness is maintained:
 * If you do an activity daily vs weekly, you should get the same
 * total XP in the same time period, just distributed differently.
 */

import { Cadence } from '../types';

/**
 * Cadence information - maps cadence types to their metadata
 * Multiplier: How to scale base XP so fairness is maintained
 * 
 * Example: Weekly activity with base 700 XP and 0.14 multiplier:
 * - 1 completion = 700 × 0.14 = 98 XP per week
 * - User does it 1x/week = 98 XP/week
 * 
 * Daily activity with base 700 XP and 1.00 multiplier:
 * - 1 completion = 700 × 1.00 = 700 XP per day
 * - User does it 7x/week = 700 × 7 = 4,900 XP/week
 * - Weekly equivalent = 4,900 / 7 = 700 XP/week per day effort
 */
export const CADENCE_CONFIG: Record<Cadence, {
  label: string;
  description: string;
  timesPerWeek: number;
  multiplier: number; // Rounded to 2 decimals for fairness
}> = {
  'daily': {
    label: 'Daily (7x/week)',
    description: 'Every single day',
    timesPerWeek: 7,
    multiplier: 1.00,
  },
  '5x/week': {
    label: '5x/week',
    description: 'Five times per week',
    timesPerWeek: 5,
    multiplier: 5.00,
  },
  '4x/week': {
    label: '4x/week',
    description: 'Four times per week',
    timesPerWeek: 4,
    multiplier: 4.00,
  },
  '3x/week': {
    label: '3x/week',
    description: 'Three times per week',
    timesPerWeek: 3,
    multiplier: 3.00,
  },
  '2x/week': {
    label: '2x/week',
    description: 'Twice per week',
    timesPerWeek: 2,
    multiplier: 2.00,
  },
  'weekly': {
    label: 'Weekly (1x/week)',
    description: 'Once per week',
    timesPerWeek: 1,
    multiplier: 7.00,
  },
  'monthly': {
    label: 'Monthly',
    description: 'Once per month',
    timesPerWeek: 0.25,
    multiplier: 30.00,
  },
};

/**
 * Helper function to get the multiplier for a cadence
 * @param cadence - The cadence type
 * @returns The multiplier value (0.00 to 1.00)
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
 * Calculate XP earned for a single completion based on activity base XP and cadence
 * @param baseXP - The base XP value for the activity
 * @param cadence - The selected cadence
 * @returns XP earned per completion, rounded to 2 decimals
 */
export function calculateXPPerCompletion(baseXP: number, cadence: Cadence): number {
  const multiplier = getCadenceMultiplier(cadence);
  // Round to 2 decimal places for consistency
  return Math.round(baseXP * multiplier * 100) / 100;
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
export function calculateNextResetTime(cadence: Cadence, userTimezone: string): Date {
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
    // Calculate next Monday at midnight
    const daysUntilMonday = (1 - now.getDay() + 7) % 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(nextMonday.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday;
  }

  if (cadence === '2x/week' || cadence === '3x/week' || cadence === '4x/week' || cadence === '5x/week') {
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
