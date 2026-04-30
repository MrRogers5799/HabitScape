/**
 * HabitScape Type Definitions
 * 
 * This file contains all TypeScript interfaces and types used throughout
 * the HabitScape application. These types ensure type safety and provide
 * clear contracts for data structures across services and components.
 */

/**
 * Cadence Type - represents how frequently an activity should be completed
 * Examples: daily (7x/week), 3x/week, weekly (1x/week), monthly
 */
export type Cadence = 'daily' | '6x/week' | '5x/week' | '4x/week' | '3x/week' | '2x/week' | 'weekly' | 'monthly';

/**
 * User object - represents a user account in the system
 * Stores authentication info and user preferences like timezone
 */
export interface User {
  /** Firebase Auth UID - unique identifier for the user */
  uid: string;
  /** User's email address */
  email: string;
  /** User's display name (future: set during character creation) */
  displayName?: string;
  /** User's timezone for activity reset calculations (e.g., "America/New_York") */
  timezone: string;
  /** Timestamp when user account was created */
  createdAt: Date;
  /** Timestamp of last login */
  lastLoginAt: Date;
  /** Flag indicating if user has completed character creation (Phase 2) */
  profileComplete: boolean;
}

/**
 * Skill object - represents one of the 23 OSRS skills
 * Stores the user's XP and calculated level for each skill
 */
export interface Skill {
  /** Firestore document ID - same as skill name for consistency */
  id: string;
  /** Human-readable skill name (e.g., "Strength", "Agility", "Cooking") */
  skillName: string;
  /** Total XP earned in this skill (0 to 13,034,431 max for level 99) */
  totalXP: number;
  /** Calculated level 1-99 (cached for performance, recalculated when XP changes) */
  level: number;
  /** Timestamp when skill was first created for this user */
  createdAt: Date;
  /** Timestamp of last XP update (used for "recent progress" sorting) */
  updatedAt: Date;
}

/**
 * Activity object - represents a predefined activity that grants XP in a skill
 * Example: "Weight Lifting" grants XP in the "Strength" skill
 */
export interface Activity {
  /** Firestore document ID */
  id: string;
  /** Human-readable activity name (e.g., "Weight Lifting", "Running") */
  activityName: string;
  /** Reference to the skill this activity trains */
  skillId: string;
  /** Base XP value for this activity (before cadence multiplier is applied) */
  baseXP: number;
  /** How frequently the user has chosen to do this activity (daily, weekly, etc.) */
  cadence: Cadence;
  /** Multiplier based on cadence (e.g., 1.00 for daily, 0.14 for weekly) */
  cadenceMultiplier: number;
  /** Final XP earned per completion: baseXP × cadenceMultiplier */
  xpPerCompletion: number;
  /** Whether this activity is currently active (can be soft-deleted by setting to false) */
  isActive: boolean;
  /** Timestamp when this activity was created for the user */
  createdAt: Date;
  /** When this activity's completion counter resets (e.g., tomorrow for daily, next Monday for weekly) */
  nextResetTime: Date;
}

/**
 * UserActivity object - represents a user's selected activity with their chosen cadence
 * Links from global activities database to per-user selections
 * Stored in: users/{userId}/userActivities/{activityTemplateId}
 */
export interface UserActivity {
  /** Firestore document ID - same as the activity template ID from global activities */
  id: string;
  /** Reference to the global activity template (from ACTIVITIES constant) */
  activityTemplateId: string;
  /** Reference to the skill this activity trains */
  skillId: string;
  /** User's chosen cadence for this activity (can differ from template default) */
  cadence: Cadence;
  /** Multiplier based on user's chosen cadence — always 1 */
  cadenceMultiplier: number;
  /** Final XP earned per completion */
  xpPerCompletion: number;
  /** Whether user has this activity enabled */
  isActive: boolean;
  /** Timestamp when user selected this activity */
  selectedAt: Date;
  /** When this activity's completion counter resets */
  nextResetTime: Date;
  /** Consecutive completions (daily) or total completions since last reset (non-daily) */
  currentStreak: number;
  /** All-time highest streak for this activity */
  longestStreak: number;
  /** ISO date string (YYYY-MM-DD) of the last day a completion was logged — daily cadence only */
  lastStreakCheckDate?: string;
  /** ISO date string (YYYY-MM-DD) of the Monday when the weekly target was last evaluated — non-daily cadences */
  lastStreakCheckWeek?: string;
  /** Streak system version — used to trigger one-time migrations. Current version: 2 */
  streakVersion?: number;
}

/**
 * ActivityCompletion object - represents a single instance of completing an activity
 * Created every time a user checks off an activity, tracks XP earned
 */
export interface ActivityCompletion {
  /** Firestore document ID */
  id: string;
  /** Reference to the activity that was completed */
  activityId: string;
  /** Reference to the skill that received XP */
  skillId: string;
  /** Timestamp when activity was completed */
  completedAt: Date;
  /** Amount of XP earned (activity.xpPerCompletion at time of completion) */
  xpEarned: number;
  /** Optional metadata for future features (e.g., effort level, notes) */
  metadata?: {
    effortLevel?: 1 | 2 | 3; // 1 = easy, 2 = medium, 3 = hard
    notes?: string;
  };
}

/**
 * XPHistory object - optional analytics table for tracking XP changes over time
 * Used for generating charts and progress reports (Phase 2+)
 */
export interface XPHistory {
  /** Firestore document ID */
  id: string;
  /** Reference to the skill */
  skillId: string;
  /** Amount of XP earned (can be positive for completions, negative for adjustments) */
  xpChange: number;
  /** Reference to the activity completion that caused this XP change */
  activityId: string;
  /** When this XP change occurred */
  completedAt: Date;
  /** User's total XP balance in this skill after this change */
  balanceAfter: number;
}

/**
 * AuthContextType - type for authentication context provider
 * Provides current user state and auth functions to components
 */
export interface AuthContextType {
  /** Currently logged-in user, or null if not authenticated */
  user: User | null;
  /** Whether authentication state is still loading */
  loading: boolean;
  /** Current authentication error message, if any */
  error: string | null;
  /** Function to sign up new user */
  signUp: (email: string, password: string, timezone: string) => Promise<void>;
  /** Function to log in existing user */
  logIn: (email: string, password: string) => Promise<void>;
  /** Function to log out current user */
  logOut: () => Promise<void>;
  /** Update the user's display name in their Firestore profile */
  updateDisplayName: (displayName: string) => Promise<void>;
  /** Update the user's timezone in their Firestore profile */
  updateTimezone: (timezone: string) => Promise<void>;
  /** Change the user's password (requires current password for reauthentication) */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Finalize onboarding: saves display name + selected activities, sets profileComplete: true */
  completeOnboarding: (
    displayName: string,
    activities: { templateId: string; cadence: Cadence; skillId: string; baseXP: number }[]
  ) => Promise<void>;
}

/**
 * SkillsContextType - type for skills context provider
 * Provides user's skills and functions to manage skills
 */
export interface SkillsContextType {
  /** Array of all user's skills with current XP and levels */
  skills: Skill[];
  /** Whether skills data is loading from Firestore */
  loading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Function to refresh skills from Firestore */
  refreshSkills: () => Promise<void>;
  /** Function to get a specific skill by ID */
  getSkill: (skillId: string) => Skill | undefined;
}

// ─── Workout Types (#10) ──────────────────────────────────────────────────────

export interface WorkoutTemplate {
  id: string;
  name: string;
  /** Optional: links to an OSRS skill so completing a session grants XP */
  linkedSkillId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateExercise {
  id: string;
  templateId: string;
  name: string;
  defaultSets: number;
  /** Optional rep target shown during a session, e.g. "8-12", "5x5", "AMRAP" */
  repRange?: string;
  /** Zero-based position for display ordering */
  sortOrder: number;
  createdAt: Date;
}

export type WeightUnit = 'kg' | 'lbs';

export interface WorkoutSession {
  id: string;
  templateId: string;
  /** Denormalized so history survives template rename/delete */
  templateName: string;
  startedAt: Date;
  /** null while the session is still in progress */
  completedAt: Date | null;
  notes?: string;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  /** Denormalized so history survives exercise rename/delete */
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  unit: WeightUnit;
  completedAt: Date;
}

/**
 * Firestore schema (all under users/{uid}/):
 *   workoutTemplates/{templateId}                  → WorkoutTemplate
 *   workoutTemplates/{templateId}/exercises/{id}   → TemplateExercise
 *   workoutSessions/{sessionId}                    → WorkoutSession
 *   workoutSessions/{sessionId}/sets/{setId}       → SetLog
 */

// ─────────────────────────────────────────────────────────────────────────────

/**
 * ActivitiesContextType - type for activities context provider
 * Provides user's activities and functions to manage activities
 */
export interface ActivitiesContextType {
  /** Array of all user's selected activities */
  userActivities: UserActivity[];
  /** Array of activity completions for this session (for checklist UI) */
  completions: ActivityCompletion[];
  /** Whether activities data is loading from Firestore */
  loading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Function to complete an activity and add XP to skill */
  completeActivity: (activityId: string) => Promise<void>;
  /** Function to backfill an activity completion for a specific past date */
  completeActivityForDate: (activityId: string, date: Date) => Promise<void>;
  /** Function to add a new activity to user's selection */
  addActivity: (activityTemplateId: string, cadence: Cadence) => Promise<void>;
  /** Function to update activity cadence */
  updateActivityCadence: (activityId: string, cadence: Cadence) => Promise<void>;
  /** Function to remove activity from user's selection */
  removeActivity: (activityId: string) => Promise<void>;
  /** Function to undo an activity completion and revoke XP */
  undoCompletion: (completionId: string) => Promise<void>;
  /** Function to refresh activities from Firestore */
  refreshActivities: () => Promise<void>;
}
