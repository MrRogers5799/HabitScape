import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { WorkoutTemplate } from '../types';
import {
  subscribeToWorkoutTemplates,
  createWorkoutTemplate,
  updateWorkoutTemplate,
  deleteWorkoutTemplate,
} from '../services/workoutService';

interface WorkoutContextType {
  templates: WorkoutTemplate[];
  loading: boolean;
  createTemplate: (name: string, linkedSkillId?: string) => Promise<string>;
  updateTemplate: (templateId: string, name: string, linkedSkillId?: string) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToWorkoutTemplates(user.uid, t => {
      setTemplates(t);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  async function handleCreate(name: string, linkedSkillId?: string): Promise<string> {
    if (!user) throw new Error('Not authenticated');
    return createWorkoutTemplate(user.uid, name, linkedSkillId);
  }

  async function handleUpdate(templateId: string, name: string, linkedSkillId?: string): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    return updateWorkoutTemplate(user.uid, templateId, name, linkedSkillId);
  }

  async function handleDelete(templateId: string): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    return deleteWorkoutTemplate(user.uid, templateId);
  }

  return (
    <WorkoutContext.Provider value={{ templates, loading, createTemplate: handleCreate, updateTemplate: handleUpdate, deleteTemplate: handleDelete }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout(): WorkoutContextType {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
}
