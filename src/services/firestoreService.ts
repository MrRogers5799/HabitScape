/**
 * Firestore Service
 * 
 * This service handles all Firestore database operations:
 * - CRUD operations for skills, activities, and completions
 * - Real-time listeners for syncing data changes
 * - XP calculations and updates
 * - Activity completion tracking
 * 
 * All functions handle Firestore timestamps and type conversions automatically.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction,
  Timestamp,
  Unsubscribe,
  updateDoc,
  QueryConstraint,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  User,
  Skill,
  Activity,
  ActivityCompletion,
  Cadence,
} from '../types';
import {
  calculateXPPerCompletion,
  calculateNextResetTime,
} from '../constants/cadences';
import { OSRS_SKILLS } from '../constants/osrsSkills';
import { calculateLevel } from '../utils/xpCalculations';

/**
 * GET SKILLS - Fetch all skills for a user
 * 
 * Retrieves all 23 skills for a user with their current XP and level.
 * Results can be sorted or filtered as needed.
 * 
 * @param userId - The user's Firebase UID
 * @returns Array of all user's skills
 */
export async function getSkills(userId: string): Promise<Skill[]> {
  try {
    const skillsRef = collection(db, 'users', userId, 'skills');
    const skillsSnap = await getDocs(skillsRef);

    const skills: Skill[] = [];
    skillsSnap.forEach(doc => {
      const data = doc.data();
      skills.push({
        id: doc.id,
        skillName: data.skillName,
        totalXP: data.totalXP || 0,
        level: data.level || 1,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      });
    });

    return skills.sort((a, b) => a.skillName.localeCompare(b.skillName));
  } catch (error) {
    console.error('❌ Error fetching skills:', error);
    throw error;
  }
}

/**
 * GET SINGLE SKILL - Fetch one skill by ID
 * 
 * @param userId - The user's Firebase UID
 * @param skillId - The skill ID (skill name, e.g., "Strength")
 * @returns The skill object, or undefined if not found
 */
export async function getSkill(userId: string, skillId: string): Promise<Skill | undefined> {
  try {
    const skillRef = doc(db, 'users', userId, 'skills', skillId);
    const skillSnap = await getDoc(skillRef);

    if (!skillSnap.exists()) {
      return undefined;
    }

    const data = skillSnap.data();
    return {
      id: skillSnap.id,
      skillName: data.skillName,
      totalXP: data.totalXP || 0,
      level: data.level || 1,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  } catch (error) {
    console.error(`❌ Error fetching skill ${skillId}:`, error);
    throw error;
  }
}

/**
 * SUBSCRIBE TO SKILLS - Real-time listener for all user skills
 * 
 * Sets up a Firestore listener that fires whenever any skill changes.
 * Use this to update the UI in real-time as XP increases.
 * 
 * @param userId - The user's Firebase UID
 * @param callback - Function called whenever skills change
 * @returns Unsubscribe function to stop listening
 * 
 * @example
 * const unsubscribe = subscribeToSkills(userId, (skills) => {
 *   setSkillsState(skills);
 * });
 * // Later, stop listening:
 * unsubscribe();
 */
export function subscribeToSkills(
  userId: string,
  callback: (skills: Skill[]) => void
): Unsubscribe {
  const skillsRef = collection(db, 'users', userId, 'skills');

  return onSnapshot(skillsRef, snapshot => {
    const skills: Skill[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      skills.push({
        id: doc.id,
        skillName: data.skillName,
        totalXP: data.totalXP || 0,
        level: data.level || 1,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      });
    });
    skills.sort((a, b) => a.skillName.localeCompare(b.skillName));
    callback(skills);
  });
}

/**
 * GET ACTIVITIES - Fetch all activities for a user
 * 
 * @param userId - The user's Firebase UID
 * @param cadenceFilter - Optional: filter by specific cadence
 * @returns Array of user's activities
 */
export async function getActivities(
  userId: string,
  cadenceFilter?: Cadence
): Promise<Activity[]> {
  try {
    const activitiesRef = collection(db, 'users', userId, 'activities');
    let q = query(activitiesRef, where('isActive', '==', true));

    const activitiesSnap = await getDocs(q);

    let activities: Activity[] = [];
    activitiesSnap.forEach(doc => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        activityName: data.activityName,
        skillId: data.skillId,
        baseXP: data.baseXP,
        cadence: data.cadence,
        cadenceMultiplier: data.cadenceMultiplier,
        xpPerCompletion: data.xpPerCompletion,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        nextResetTime: data.nextResetTime?.toDate?.() || new Date(),
      });
    });

    // Filter by cadence if provided
    if (cadenceFilter) {
      activities = activities.filter(a => a.cadence === cadenceFilter);
    }

    return activities;
  } catch (error) {
    console.error('❌ Error fetching activities:', error);
    throw error;
  }
}

/**
 * CREATE ACTIVITY - Add a new activity for a user
 * 
 * @param userId - The user's Firebase UID
 * @param activityName - Name of the activity
 * @param skillId - Skill ID to link to
 * @param baseXP - Base XP for the activity
 * @param cadence - How often the activity is done
 * @param timezone - User's timezone for reset calculations
 * @returns The created activity ID
 */
export async function createActivity(
  userId: string,
  activityName: string,
  skillId: string,
  baseXP: number,
  cadence: Cadence,
  timezone: string
): Promise<string> {
  try {
    const activitiesRef = collection(db, 'users', userId, 'activities');
    
    // Calculate XP per completion based on cadence
    const xpPerCompletion = calculateXPPerCompletion(baseXP, cadence);
    const nextResetTime = calculateNextResetTime(cadence, timezone);
    
    // Use activity name as ID (lowercase, hyphenated)
    const activityId = activityName.toLowerCase().replace(/\s+/g, '-');
    const activityRef = doc(activitiesRef, activityId);

    const activityData = {
      activityName,
      skillId,
      baseXP,
      cadence,
      cadenceMultiplier: parseFloat((baseXP === 0 ? 0 : xpPerCompletion / baseXP).toFixed(2)),
      xpPerCompletion,
      isActive: true,
      createdAt: Timestamp.now(),
      nextResetTime: Timestamp.fromDate(nextResetTime),
    };

    await setDoc(activityRef, activityData);
    console.log(`✅ Activity "${activityName}" created for skill "${skillId}"`);
    return activityId;
  } catch (error) {
    console.error('❌ Error creating activity:', error);
    throw error;
  }
}

/**
 * COMPLETE ACTIVITY - Record that a user completed an activity and grant XP
 * 
 * This is the core function for the app! When a user checks off an activity:
 * 1. Create an ActivityCompletion record
 * 2. Add XP to the corresponding skill
 * 3. Update the skill's level
 * 
 * This happens atomically using a Firestore batch write.
 * 
 * @param userId - The user's Firebase UID
 * @param activityId - The activity ID being completed
 * @returns Promise that resolves when the activity is recorded
 */
export async function completeActivity(
  userId: string,
  activityId: string
): Promise<void> {
  try {
    // Read the userActivity first (outside the transaction — it doesn't change during completion)
    const userActivityRef = doc(db, 'users', userId, 'userActivities', activityId);
    const userActivitySnap = await getDoc(userActivityRef);

    if (!userActivitySnap.exists()) {
      throw new Error(`Activity ${activityId} not found`);
    }

    const { skillId, xpPerCompletion } = userActivitySnap.data() as any;
    const skillRef = doc(db, 'users', userId, 'skills', skillId);
    const completionRef = doc(collection(db, 'users', userId, 'activity_completions'));

    // Use a transaction so the skill XP read and write are atomic — prevents
    // double-tap from reading the same XP value twice before either write lands.
    await runTransaction(db, async (transaction) => {
      const skillSnap = await transaction.get(skillRef);
      if (!skillSnap.exists()) throw new Error(`Skill ${skillId} not found`);

      const currentXP = (skillSnap.data().totalXP as number) || 0;
      const newTotalXP = currentXP + xpPerCompletion;
      const newLevel = calculateLevel(newTotalXP);

      transaction.set(completionRef, {
        activityId,
        skillId,
        completedAt: Timestamp.now(),
        xpEarned: xpPerCompletion,
        metadata: {},
      });

      transaction.update(skillRef, {
        totalXP: newTotalXP,
        level: newLevel,
        updatedAt: Timestamp.now(),
      });
    });

    console.log(`✅ Activity "${activityId}" completed! +${xpPerCompletion} XP to ${skillId}`);
  } catch (error) {
    console.error('❌ Error completing activity:', error);
    throw error;
  }
}

/**
 * GET ACTIVITY COMPLETIONS - Fetch completed activities for a user
 * 
 * Useful for building activity history or checking today's completions.
 * 
 * @param userId - The user's Firebase UID
 * @param limit - Optional: limit number of results
 * @returns Array of activity completions
 */
export async function getActivityCompletions(
  userId: string,
  limit: number = 100
): Promise<ActivityCompletion[]> {
  try {
    const completionsRef = collection(
      db,
      'users',
      userId,
      'activity_completions'
    );
    const q = query(
      completionsRef,
      orderBy('completedAt', 'desc'),
      firestoreLimit(limit)
    );

    const completionsSnap = await getDocs(q);

    const completions: ActivityCompletion[] = [];
    completionsSnap.forEach(doc => {
      const data = doc.data();
      completions.push({
        id: doc.id,
        activityId: data.activityId,
        skillId: data.skillId,
        xpEarned: data.xpEarned,
        completedAt: data.completedAt?.toDate?.() || new Date(),
        metadata: data.metadata,
      });
    });

    return completions;
  } catch (error) {
    console.error('❌ Error fetching activity completions:', error);
    throw error;
  }
}

/**
 * SUBSCRIBE TO ACTIVITY COMPLETIONS - Real-time listener
 * 
 * Listen to completion history as it updates.
 * 
 * @param userId - The user's Firebase UID
 * @param callback - Function called when completions change
 * @returns Unsubscribe function
 */
export function subscribeToActivityCompletions(
  userId: string,
  callback: (completions: ActivityCompletion[]) => void
): Unsubscribe {
  const completionsRef = collection(
    db,
    'users',
    userId,
    'activity_completions'
  );
  const q = query(completionsRef, orderBy('completedAt', 'desc'));

  return onSnapshot(q, snapshot => {
    const completions: ActivityCompletion[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      completions.push({
        id: doc.id,
        activityId: data.activityId,
        skillId: data.skillId,
        xpEarned: data.xpEarned,
        completedAt: data.completedAt?.toDate?.() || new Date(),
        metadata: data.metadata,
      });
    });
    callback(completions);
  });
}

/**
 * CHECK IF ACTIVITY COMPLETED TODAY - Utility function
 * 
 * Checks if a specific activity has already been completed today.
 * Useful for the checklist UI to show what's already done.
 * 
 * @param userId - The user's Firebase UID
 * @param activityId - The activity to check
 * @returns true if activity completed today
 */
export async function isActivityCompletedToday(
  userId: string,
  activityId: string
): Promise<boolean> {
  try {
    const completions = await getActivityCompletions(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return completions.some(completion => {
      const completionDate = new Date(completion.completedAt);
      completionDate.setHours(0, 0, 0, 0);
      return (
        completion.activityId === activityId &&
        completionDate.getTime() === today.getTime()
      );
    });
  } catch (error) {
    console.error('❌ Error checking daily completion:', error);
    return false;
  }
}

/**
 * GET USER ACTIVITIES - Fetch user's selected activities (Phase 2)
 * 
 * Retrieves all activities the user has selected from the global database.
 * Each userActivity has the user's chosen cadence and XP calculation.
 * 
 * @param userId - The user's Firebase UID
 * @returns Array of user's selected activities
 */
export async function getUserActivities(userId: string): Promise<any[]> {
  try {
    const activitiesRef = collection(db, 'users', userId, 'userActivities');
    const snapshot = await getDocs(activitiesRef);

    const userActivities: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      userActivities.push({
        id: doc.id,
        ...data,
        selectedAt: data.selectedAt?.toDate?.() || new Date(),
        nextResetTime: data.nextResetTime?.toDate?.() || new Date(),
      });
    });

    return userActivities.filter(a => a.isActive);
  } catch (error) {
    console.error('❌ Error fetching user activities:', error);
    throw error;
  }
}

/**
 * ADD USER ACTIVITY - Add activity to user's selected activities (Phase 2)
 * 
 * Creates a new userActivity document when user selects an activity in settings.
 * 
 * @param userId - The user's Firebase UID
 * @param activityTemplateId - ID of the activity template from global database
 * @param cadence - User's chosen cadence for this activity
 * @param xpPerCompletion - Final XP earned per completion (baseXP × multiplier)
 * @param cadenceMultiplier - Multiplier based on cadence
 */
export async function addUserActivity(
  userId: string,
  activityTemplateId: string,
  cadence: Cadence,
  xpPerCompletion: number,
  cadenceMultiplier: number,
  skillId: string,
  timezone: string
): Promise<void> {
  try {
    const userActivityRef = doc(
      db,
      'users',
      userId,
      'userActivities',
      activityTemplateId
    );

    const nextResetTime = calculateNextResetTime(cadence, timezone);

    await setDoc(userActivityRef, {
      id: activityTemplateId,
      activityTemplateId,
      skillId,
      cadence,
      cadenceMultiplier,
      xpPerCompletion,
      isActive: true,
      selectedAt: Timestamp.now(),
      nextResetTime: Timestamp.fromDate(nextResetTime),
    });

    console.log(`✅ Activity ${activityTemplateId} added to user ${userId}`);
  } catch (error) {
    console.error('❌ Error adding user activity:', error);
    throw error;
  }
}

/**
 * REMOVE USER ACTIVITY - Remove activity from user's selection (Phase 2)
 * 
 * Soft-deletes a userActivity by setting isActive to false.
 * 
 * @param userId - The user's Firebase UID
 * @param activityId - ID of the activity to remove
 */
export async function removeUserActivity(
  userId: string,
  activityId: string
): Promise<void> {
  try {
    const userActivityRef = doc(db, 'users', userId, 'userActivities', activityId);
    await updateDoc(userActivityRef, { isActive: false });

    console.log(`✅ Activity ${activityId} removed from user ${userId}`);
  } catch (error) {
    console.error('❌ Error removing user activity:', error);
    throw error;
  }
}

/**
 * UNDO ACTIVITY COMPLETION - Revoke XP and remove completion record (Phase 2)
 * 
 * Handles the undo functionality:
 * 1. Deletes the completion record
 * 2. Subtracts XP from the skill
 * 3. Recalculates skill level
 * 
 * @param userId - The user's Firebase UID
 * @param completionId - ID of the completion to undo
 */
export async function undoActivityCompletion(
  userId: string,
  completionId: string
): Promise<void> {
  try {
    // Get the completion record to know what to undo
    const completionRef = doc(db, 'users', userId, 'activity_completions', completionId);
    const completionDoc = await getDoc(completionRef);

    if (!completionDoc.exists()) {
      throw new Error('Completion record not found');
    }

    const { skillId, xpEarned } = completionDoc.data() as ActivityCompletion;

    // Subtract XP from the skill first
    const skillRef = doc(db, 'users', userId, 'skills', skillId);
    const skillDoc = await getDoc(skillRef);

    if (skillDoc.exists()) {
      const currentXP = (skillDoc.data() as Skill).totalXP;
      const newXP = Math.max(0, currentXP - xpEarned);
      const newLevel = calculateLevel(newXP);

      const batch = writeBatch(db);

      batch.update(skillRef, {
        totalXP: newXP,
        level: newLevel,
        updatedAt: Timestamp.now(),
      });

      batch.delete(completionRef);

      await batch.commit();

      console.log(
        `✅ Undid ${xpEarned} XP from skill ${skillId} for user ${userId}`
      );
    }
  } catch (error) {
    console.error('❌ Error undoing activity completion:', error);
    throw error;
  }
}
