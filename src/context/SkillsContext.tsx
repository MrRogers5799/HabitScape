/**
 * Skills Context
 * 
 * This context provider manages user skills data and real-time synchronization.
 * Provides:
 * - All user skills with current XP and levels
 * - Real-time updates via Firebase listeners
 * - Functions to fetch and refresh skill data
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Skill, SkillsContextType } from '../types';
import { getSkills, subscribeToSkills } from '../services/firestoreService';
import { useAuth } from './AuthContext';

/**
 * Create the skills context
 */
const SkillsContext = createContext<SkillsContextType | undefined>(undefined);

/**
 * Skills Provider Component
 * 
 * Sets up real-time listeners for user skills and provides them to the app.
 * Must be wrapped inside AuthProvider so it has access to the user.
 * 
 * @param children - React components to wrap
 */
export function SkillsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Set up real-time listener for skills
   * This fires whenever any skill's XP changes in Firestore
   */
  useEffect(() => {
    if (!user) {
      setSkills([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Subscribe to real-time skill updates
      const unsubscribe = subscribeToSkills(user.uid, (updatedSkills) => {
        setSkills(updatedSkills);
        setError(null);
        setLoading(false);
      });

      // Clean up listener when component unmounts or user changes
      return unsubscribe;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load skills';
      setError(message);
      setLoading(false);
    }
  }, [user]);

  /**
   * Manually refresh skills from Firestore
   * Useful if you want to force a refresh without waiting for real-time update
   */
  const refreshSkills = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const updatedSkills = await getSkills(user.uid);
      setSkills(updatedSkills);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh skills';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Get a single skill by ID
   */
  const getSkill = useCallback((skillId: string) => {
    return skills.find(s => s.id === skillId);
  }, [skills]);

  const value: SkillsContextType = {
    skills,
    loading,
    error,
    refreshSkills,
    getSkill,
  };

  return (
    <SkillsContext.Provider value={value}>
      {children}
    </SkillsContext.Provider>
  );
}

/**
 * Hook to use skills context
 * 
 * @returns SkillsContextType with skills data and functions
 * @throws Error if used outside SkillsProvider
 */
export function useSkills(): SkillsContextType {
  const context = useContext(SkillsContext);
  if (context === undefined) {
    throw new Error('useSkills must be used within a SkillsProvider');
  }
  return context;
}
