/**
 * The trip plan the player is building in the Adventure tab, shared by the region and
 * planner screens (kept apart from the navigator to avoid a circular import).
 */
import React, { createContext, useContext, useState } from 'react';
import { LegPlan, MAX_LEGS } from '../../game';

export interface DraftPlan {
  legs: LegPlan[];
  addLeg: (leg: LegPlan) => boolean;
  updateLeg: (index: number, leg: LegPlan) => void;
  removeLeg: (index: number) => void;
  clear: () => void;
}

const DraftPlanContext = createContext<DraftPlan | undefined>(undefined);

export function DraftPlanProvider({ children }: { children: React.ReactNode }) {
  const [legs, setLegs] = useState<LegPlan[]>([]);
  const plan: DraftPlan = {
    legs,
    addLeg: (leg) => {
      if (legs.length >= MAX_LEGS) return false;
      setLegs([...legs, leg]);
      return true;
    },
    updateLeg: (i, leg) => setLegs(legs.map((l, j) => (j === i ? leg : l))),
    removeLeg: (i) => setLegs(legs.filter((_, j) => j !== i)),
    clear: () => setLegs([]),
  };
  return <DraftPlanContext.Provider value={plan}>{children}</DraftPlanContext.Provider>;
}

export function useDraftPlan(): DraftPlan {
  const ctx = useContext(DraftPlanContext);
  if (!ctx) throw new Error('useDraftPlan must be used inside the Adventure tab');
  return ctx;
}
