/**
 * Activities Context (Phase 2)
 * 
 * Manages user's selected activities (userActivities) and activity completions.
 * Provides:
 * - User's selected activities with chosen cadences
 * - Completed activities history with timestamps
 * - Real-time sync of activity completions
 * - Functions to complete, add, update, remove activities, and undo completions
 * 
 * Note: This is a major refactor for Phase 2. Activities are now per-user selections
 * from the global ACTIVITY_TEMPLATES database, allowing users to choose their own
 * activities and cadences in Settings.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserActivity, ActivityCompletion, ActivitiesContextType, Cadence } from '../types';
import { useAuth } from './AuthContext';
import {
  getUserActivities,
  getActivityCompletions,
  completeActivity,
  subscribeToActivityCompletions,
  addUserActivity,
  removeUserActivity,
  undoActivityCompletion,
  updateActivityStreaks,
} from '../services/firestoreService';
import { computeAllStreakUpdates } from '../utils/streakUtils';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ACTIVITY_TEMPLATES } from '../constants/activities';

/**
 * Create the activities context
 */
const ActivitiesContext = createContext<ActivitiesContextType | undefined>(
  undefined
);

/**
 * Activities Provider Component
 * 
 * Sets up real-time listeners for user activities and completions.
 * Must be wrapped inside AuthProvider so it has access to the user.
 * 
 * @param children - React components to wrap
 */
export function ActivitiesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [completions, setCompletions] = useState<ActivityCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Set up real-time listener for user's selected activities
   * This updates whenever activities are added/removed/modified
   */
  useEffect(() => {
    if (!user) {
      setUserActivities([]);
      setLoading(false);
      return;
    }

    try {
      // Subscribe to userActivities collection changes
      const activitiesRef = collection(db, 'users', user.uid, 'userActivities');
      const unsubscribe = onSnapshot(
        activitiesRef,
        (snapshot) => {
          const activities: UserActivity[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            activities.push({
              ...data,
              selectedAt: data.selectedAt?.toDate?.() || new Date(),
              nextResetTime: data.nextResetTime?.toDate?.() || new Date(),
            } as UserActivity);
          });

          // Filter to only active activities
          const activeActivities = activities.filter(a => a.isActive);
          setUserActivities(activeActivities);
          setLoading(false);
          setError(null);
        },
        (error) => {
          console.error('Error listening to user activities:', error);
          const message = error instanceof Error ? error.message : 'Failed to load activities';
          setError(message);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.error('Error setting up activities listener:', err);
      setLoading(false);
    }
  }, [user]);

  /**
   * Set up real-time listener for activity completions
   * This updates whenever a user completes an activity
   */
  useEffect(() => {
    if (!user) {
      setCompletions([]);
      return;
    }

    try {
      // Subscribe to completion updates
      const unsubscribe = subscribeToActivityCompletions(
        user.uid,
        (completions) => {
          // Filter out undone completions
          const activeCompletions = completions.filter(c => !('undone' in c) || !c.undone);
          setCompletions(activeCompletions);
        }
      );

      // Clean up listener when component unmounts
      return unsubscribe;
    } catch (err) {
      console.error('Error subscribing to completions:', err);
    }
  }, [user]);

  /**
   * Once per session, evaluate whether any activities need their streak updated.
   * Runs when both activities and completions are fully loaded, and only writes
   * to Firestore if at least one activity has crossed a week boundary.
   */
  useEffect(() => {
    if (!user || !userActivities.length || loading) return;

    const updates = computeAllStreakUpdates(userActivities, completions);
    if (updates.length === 0) return;

    updateActivityStreaks(user.uid, updates).catch(err =>
      console.error('Streak update failed:', err)
    );
  }, [user, userActivities, completions, loading]);

  /**
   * Complete an activity and grant XP
   */
  const handleCompleteActivity = useCallback(
    async (activityId: string) => {
      if (!user) return;

      try {
        setError(null);
        await completeActivity(user.uid, activityId);
        // Real-time listener will update completions automatically
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to complete activity';
        setError(message);
        throw err;
      }
    },
    [user]
  );

  /**
   * Add a new activity to user's selection
   */
  const handleAddActivity = useCallback(
    async (activityTemplateId: string, cadence: Cadence) => {
      if (!user) return;

      try {
        setError(null);
        console.log(`📝 Adding activity ${activityTemplateId} with cadence ${cadence}`);
        
        // Find the activity template
        const template = ACTIVITY_TEMPLATES.find(a => a.id === activityTemplateId);
        if (!template) {
          throw new Error(`Activity template ${activityTemplateId} not found`);
        }
        
        // XP per completion is always baseXP — no cadence multiplier applied.
        // Frequency parity is baked into each activity's baseXP value.
        const xpPerCompletion = template.baseXP;

        await addUserActivity(
          user.uid,
          activityTemplateId,
          cadence,
          xpPerCompletion,
          1,
          template.skillId,
          user.timezone ?? 'UTC'
        );
        
        console.log(`✅ Activity ${activityTemplateId} added successfully`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add activity';
        setError(message);
        console.error('❌ Error adding activity:', err);
        throw err;
      }
    },
    [user]
  );

  /**
   * Update activity cadence
   */
  const handleUpdateActivityCadence = useCallback(
    async (activityId: string, cadence: Cadence) => {
      if (!user) return;

      try {
        setError(null);
        // To be implemented: update cadence in Firestore
        console.log(`Updating activity ${activityId} cadence to ${cadence}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update activity';
        setError(message);
        throw err;
      }
    },
    [user]
  );

  /**
   * Remove activity from user's selection
   */
  const handleRemoveActivity = useCallback(
    async (activityId: string) => {
      if (!user) return;

      try {
        setError(null);
        await removeUserActivity(user.uid, activityId);
        setUserActivities(
          userActivities.filter(a => a.id !== activityId)
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove activity';
        setError(message);
        throw err;
      }
    },
    [user, userActivities]
  );

  /**
   * Undo an activity completion and revoke XP
   */
  const handleUndoCompletion = useCallback(
    async (completionId: string) => {
      if (!user) {
        console.error('❌ No user logged in');
        return;
      }

      try {
        console.log('🔄 Undo context: Processing completion', completionId);
        setError(null);
        await undoActivityCompletion(user.uid, completionId);
        console.log('✅ Undo context: Completion deleted successfully');
        // Real-time listener will update completions automatically
      } catch (err) {
        console.error('❌ Undo context error:', err);
        const message = err instanceof Error ? err.message : 'Failed to undo completion';
        setError(message);
        throw err;
      }
    },
    [user]
  );

  /**
   * Manually refresh activities from Firestore
   */
  const refreshActivities = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const updatedActivities = await getUserActivities(user.uid);
      setUserActivities(updatedActivities);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh activities';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const value: ActivitiesContextType = {
    userActivities,
    completions,
    loading,
    error,
    completeActivity: handleCompleteActivity,
    addActivity: handleAddActivity,
    updateActivityCadence: handleUpdateActivityCadence,
    removeActivity: handleRemoveActivity,
    undoCompletion: handleUndoCompletion,
    refreshActivities,
  };

  return (
    <ActivitiesContext.Provider value={value}>
      {children}
    </ActivitiesContext.Provider>
  );
}

/**
 * Hook to use activities context
 * 
 * @returns ActivitiesContextType with activities data and functions
 * @throws Error if used outside ActivitiesProvider
 */
export function useActivities(): ActivitiesContextType {
  const context = useContext(ActivitiesContext);
  if (context === undefined) {
    throw new Error('useActivities must be used within an ActivitiesProvider');
  }
  return context;
}
