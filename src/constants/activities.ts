/**
 * Pre-defined Activities for HabitScape
 * 
 * Global activity database - all activities are defined here and mapped to OSRS skills.
 * Users can select which activities to track in their settings.
 * 
 * Phase 2 Feature:
 * - Settings page with activity selection wizard
 * - Users choose: Skill → Activity → Cadence
 * - Default set assigned at signup, customizable in settings
 * - Ability to add/remove activities and change cadence
 */

import { Cadence } from '../types';

/**
 * Activity template - defines the core properties of an activity
 * These are global activities that users can select from
 */
export interface ActivityTemplate {
  id: string;
  activityName: string;
  skillId: string;
  baseXP: number;
  description: string;
  category: 'health' | 'fitness' | 'mental' | 'learning' | 'hobby' | 'productivity';
  defaultCadence?: Cadence;
  availableCadences: Cadence[];
}

/**
 * Comprehensive global activity database - 50+ activities mapped to all 23 OSRS skills
 * Users select from these activities and choose a cadence in settings
 */
export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  // ===== STRENGTH =====
  {
    id: 'weight-lifting',
    activityName: 'Weight Lifting',
    skillId: 'Strength',
    baseXP: 100,
    category: 'fitness',
    description: 'Resistance training for strength building',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'group-fitness',
    activityName: 'Group Fitness Class',
    skillId: 'Strength',
    baseXP: 110,
    category: 'fitness',
    description: 'CrossFit, bootcamp, or group training classes',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'strength-training',
    activityName: 'Strongman Training',
    skillId: 'Strength',
    baseXP: 120,
    category: 'fitness',
    description: 'Heavy compound movements and strongman training',
    defaultCadence: '2x/week',
    availableCadences: ['3x/week', '2x/week', 'weekly'],
  },

  // ===== ATTACK =====
  {
    id: 'martial-arts',
    activityName: 'Martial Arts Training',
    skillId: 'Attack',
    baseXP: 105,
    category: 'fitness',
    description: 'Boxing, kickboxing, or martial arts practice',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'sparring',
    activityName: 'Sparring Session',
    skillId: 'Attack',
    baseXP: 110,
    category: 'fitness',
    description: 'Competitive sparring or fight practice',
    defaultCadence: '2x/week',
    availableCadences: ['3x/week', '2x/week', 'weekly'],
  },

  // ===== DEFENSE =====
  {
    id: 'yoga',
    activityName: 'Yoga',
    skillId: 'Defense',
    baseXP: 80,
    category: 'fitness',
    description: 'Holistic fitness, balance, and flexibility',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'pilates',
    activityName: 'Pilates',
    skillId: 'Defense',
    baseXP: 85,
    category: 'fitness',
    description: 'Core strengthening and stability training',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== RANGED =====
  {
    id: 'archery',
    activityName: 'Archery Training',
    skillId: 'Ranged',
    baseXP: 85,
    category: 'hobby',
    description: 'Bow and arrow practice',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'rock-climbing',
    activityName: 'Rock Climbing',
    skillId: 'Ranged',
    baseXP: 95,
    category: 'fitness',
    description: 'Indoor or outdoor climbing for endurance',
    defaultCadence: '2x/week',
    availableCadences: ['3x/week', '2x/week', 'weekly'],
  },

  // ===== HITPOINTS =====
  {
    id: 'sleep-8h',
    activityName: 'Sleep 8+ Hours',
    skillId: 'Hitpoints',
    baseXP: 85,
    category: 'health',
    description: 'Quality sleep for recovery and health',
    defaultCadence: 'daily',
    availableCadences: ['daily'],
  },
  {
    id: 'hydration',
    activityName: 'Drink 8 Glasses Water',
    skillId: 'Hitpoints',
    baseXP: 50,
    category: 'health',
    description: 'Daily hydration goal',
    defaultCadence: 'daily',
    availableCadences: ['daily'],
  },
  {
    id: 'cold-shower',
    activityName: 'Cold Shower',
    skillId: 'Hitpoints',
    baseXP: 75,
    category: 'health',
    description: 'Cold exposure and resilience training',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week'],
  },

  // ===== AGILITY =====
  {
    id: 'running',
    activityName: 'Running',
    skillId: 'Agility',
    baseXP: 90,
    category: 'fitness',
    description: 'Cardio and endurance training',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'stretching',
    activityName: 'Stretching Routine',
    skillId: 'Agility',
    baseXP: 60,
    category: 'fitness',
    description: 'Flexibility and mobility work',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week'],
  },
  {
    id: 'walk-hike',
    activityName: 'Walk or Hike',
    skillId: 'Agility',
    baseXP: 85,
    category: 'fitness',
    description: 'Outdoor walking or hiking activity',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'dancing',
    activityName: 'Dancing',
    skillId: 'Agility',
    baseXP: 80,
    category: 'hobby',
    description: 'Dance class or freestyle dancing',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== MAGIC =====
  {
    id: 'reading',
    activityName: 'Reading/Study',
    skillId: 'Magic',
    baseXP: 70,
    category: 'learning',
    description: 'Reading books or studying new topics',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'online-course',
    activityName: 'Online Course',
    skillId: 'Magic',
    baseXP: 90,
    category: 'learning',
    description: 'Take an online course or tutorial',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'learn-language',
    activityName: 'Learn New Language',
    skillId: 'Magic',
    baseXP: 85,
    category: 'learning',
    description: 'Language learning session (Duolingo, etc)',
    defaultCadence: 'daily',
    availableCadences: ['daily', '5x/week'],
  },

  // ===== COOKING =====
  {
    id: 'meal-prep',
    activityName: 'Meal Prep',
    skillId: 'Cooking',
    baseXP: 95,
    category: 'productivity',
    description: 'Weekly meal preparation and planning',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'cooking-advanced',
    activityName: 'Advanced Cooking',
    skillId: 'Cooking',
    baseXP: 105,
    category: 'hobby',
    description: 'Try a new recipe or cooking technique',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'baking',
    activityName: 'Baking',
    skillId: 'Cooking',
    baseXP: 90,
    category: 'hobby',
    description: 'Bread, pastries, or dessert baking',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== PRAYER =====
  {
    id: 'meditation',
    activityName: 'Meditation',
    skillId: 'Prayer',
    baseXP: 80,
    category: 'mental',
    description: 'Mindfulness and breathing exercises',
    defaultCadence: 'daily',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'journaling',
    activityName: 'Journaling',
    skillId: 'Prayer',
    baseXP: 65,
    category: 'mental',
    description: 'Reflection and mental health journaling',
    defaultCadence: '5x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'meditation-deep',
    activityName: 'Deep Meditation (30+ min)',
    skillId: 'Prayer',
    baseXP: 120,
    category: 'mental',
    description: 'Extended meditation session',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'gratitude-practice',
    activityName: 'Gratitude Practice',
    skillId: 'Prayer',
    baseXP: 60,
    category: 'mental',
    description: 'Daily gratitude reflection',
    defaultCadence: 'daily',
    availableCadences: ['daily'],
  },

  // ===== HERBLORE =====
  {
    id: 'tea-routine',
    activityName: 'Herbal Tea Routine',
    skillId: 'Herblore',
    baseXP: 55,
    category: 'health',
    description: 'Prepare and drink herbal teas',
    defaultCadence: 'daily',
    availableCadences: ['daily', '5x/week'],
  },
  {
    id: 'gardening',
    activityName: 'Herb Gardening',
    skillId: 'Herblore',
    baseXP: 80,
    category: 'hobby',
    description: 'Grow and harvest herbs',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },

  // ===== FISHING =====
  {
    id: 'fishing',
    activityName: 'Fishing',
    skillId: 'Fishing',
    baseXP: 85,
    category: 'hobby',
    description: 'Fishing at a local spot',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== MINING =====
  {
    id: 'geocaching',
    activityName: 'Geocaching',
    skillId: 'Mining',
    baseXP: 75,
    category: 'hobby',
    description: 'Search for hidden treasures outdoors',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== SMITHING =====
  {
    id: 'woodworking',
    activityName: 'Woodworking Project',
    skillId: 'Smithing',
    baseXP: 95,
    category: 'hobby',
    description: 'Build or craft something with wood',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'metalworking',
    activityName: 'Metalworking',
    skillId: 'Smithing',
    baseXP: 100,
    category: 'hobby',
    description: 'Blacksmithing or metalcraft',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== CRAFTING =====
  {
    id: 'knitting',
    activityName: 'Knitting/Sewing',
    skillId: 'Crafting',
    baseXP: 70,
    category: 'hobby',
    description: 'Knit, sew, or create textiles',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'pottery',
    activityName: 'Pottery/Ceramics',
    skillId: 'Crafting',
    baseXP: 85,
    category: 'hobby',
    description: 'Pottery wheel or hand sculpting',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== FIREMAKING =====
  {
    id: 'camping',
    activityName: 'Camping Trip',
    skillId: 'Firemaking',
    baseXP: 90,
    category: 'hobby',
    description: 'Outdoor camping or bonfire',
    defaultCadence: 'monthly',
    availableCadences: ['monthly', '2x/month'],
  },

  // ===== RUNECRAFT =====
  {
    id: 'programming',
    activityName: 'Programming/Coding',
    skillId: 'Runecrafting',
    baseXP: 100,
    category: 'learning',
    description: 'Code or build a programming project',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'problem-solving',
    activityName: 'Problem Solving (LeetCode, Codewars)',
    skillId: 'Runecraft',
    baseXP: 85,
    category: 'learning',
    description: 'Solve coding challenges',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== CONSTRUCTION =====
  {
    id: 'home-improvement',
    activityName: 'Home Improvement Project',
    skillId: 'Construction',
    baseXP: 95,
    category: 'productivity',
    description: 'DIY home repair or improvement',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'organization',
    activityName: 'Organize/Declutter Room',
    skillId: 'Construction',
    baseXP: 75,
    category: 'productivity',
    description: 'Organize and clean a space',
    defaultCadence: 'weekly',
    availableCadences: ['weekly', 'monthly'],
  },

  // ===== SLAYER =====
  {
    id: 'parkour',
    activityName: 'Parkour Training',
    skillId: 'Slayer',
    baseXP: 95,
    category: 'fitness',
    description: 'Parkour and movement training',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== HUNTER =====
  {
    id: 'bird-watching',
    activityName: 'Bird Watching',
    skillId: 'Hunter',
    baseXP: 65,
    category: 'hobby',
    description: 'Bird watching and wildlife observation',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== THIEVING =====
  {
    id: 'puzzle-games',
    activityName: 'Puzzle Games (Sudoku, Chess)',
    skillId: 'Thieving',
    baseXP: 70,
    category: 'learning',
    description: 'Play puzzle games for brain training',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== FLETCHING =====
  {
    id: 'crafting-hobby',
    activityName: 'Crafting/DIY Hobby',
    skillId: 'Fletching',
    baseXP: 80,
    category: 'hobby',
    description: 'Create crafts or DIY projects',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
];

/**
 * Helper function to get an activity template by ID
 */
export function getActivityTemplate(id: string): ActivityTemplate | undefined {
  return ACTIVITY_TEMPLATES.find(activity => activity.id === id);
}

/**
 * Helper function to get all activity templates for a specific skill
 */
export function getActivitiesForSkill(skillId: string): ActivityTemplate[] {
  return ACTIVITY_TEMPLATES.filter(activity => activity.skillId === skillId);
}

/**
 * Helper function to get the default cadence for an activity
 */
export function getDefaultCadence(activityId: string): string {
  const template = getActivityTemplate(activityId);
  return template?.defaultCadence || 'weekly';
}

/**
 * Default activities assigned to users at signup
 * One activity per skill for a good starting point
 */
export const DEFAULT_USER_ACTIVITIES = [
  'weight-lifting',      // Strength
  'martial-arts',        // Attack
  'yoga',                // Defense
  'archery',             // Ranged
  'sleep-8h',            // Hitpoints
  'running',             // Agility
  'reading',             // Magic
  'meal-prep',           // Cooking
  'meditation',          // Prayer
  'tea-routine',         // Herblore
  'fishing',             // Fishing
  'geocaching',          // Mining
  'metalworking',        // Smithing
  'knitting',            // Crafting
  'camping',             // Firemaking
  'programming',         // Runecraft
  'home-improvement',    // Construction
  'parkour',             // Slayer
  'bird-watching',       // Hunter
  'puzzle-games',        // Thieving
  'crafting-hobby',      // Fletching
];
