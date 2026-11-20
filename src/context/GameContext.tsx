/**
 * Game Context: the Adventure (beta) game layer for the signed-in player (PROD-018).
 *
 * Keeps the adventurer and the active trip live from Firestore, brings the trip up to
 * date whenever the app is open (on start, when it returns to the foreground, and every
 * minute), and exposes the actions the beta screens need. All game rules live in
 * src/game; saving lives in src/services/gameService.ts.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { useActivities } from './ActivitiesContext';
import { GameSkill, GameState, LegPlan } from '../game';
import { weekIdFor } from '../game/persistence';
import {
  ActiveTrip, applyLampOn, callBackTrip, dismissReturn, joinAdventureBeta, resolveActiveTrip, startTrip,
  subscribeToAdventurer, subscribeToTrip,
} from '../services/gameService';

const RESOLVE_EVERY_MS = 60 * 1000;

interface GameContextType {
  /** The player opted in to the beta. */
  enabled: boolean;
  loading: boolean;
  state: GameState | null;
  activeTrip: ActiveTrip | null;
  /** The current time, refreshed every minute so countdowns move. */
  nowMs: number;
  /** Skills whose habits were done on the day of `ms` (affinity). */
  affinityAt: (ms: number) => ReadonlySet<string>;
  error: string | null;
  join: () => Promise<void>;
  send: (legs: LegPlan[]) => Promise<void>;
  callBack: () => Promise<void>;
  dismissReturn: () => Promise<void>;
  applyLamp: (index: number, skill: GameSkill) => Promise<void>;
  refresh: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user, setAdventureBeta } = useAuth();
  const { completions } = useActivities();
  const enabled = !!user?.adventureBeta;
  const weekStart = user?.weekStartDay ?? 1;

  const [state, setState] = useState<GameState | null>(null);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const weekId = weekIdFor(nowMs, weekStart);

  // Affinity: skills of habits completed on a given day.
  const skillsByDay = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of completions) {
      const key = dayKey(c.completedAt.getTime());
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(c.skillId);
    }
    return map;
  }, [completions]);
  const affinityAt = useCallback((ms: number) => skillsByDay.get(dayKey(ms)) ?? new Set<string>(), [skillsByDay]);

  // Live adventurer document.
  useEffect(() => {
    if (!user || !enabled) {
      setState(null);
      setActiveTripId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeToAdventurer(user.uid, weekId, (s) => {
      setState(s?.state ?? null);
      setActiveTripId(s?.activeTripId ?? null);
      setLoading(false);
    });
    // weekId is read at subscribe time only; the stored week rolls over on the next save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, enabled]);

  // Live active trip document.
  useEffect(() => {
    if (!user || !activeTripId) {
      setActiveTrip(null);
      return;
    }
    return subscribeToTrip(user.uid, activeTripId, setActiveTrip);
  }, [user, activeTripId]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      setError(null);
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    const now = Date.now();
    setNowMs(now);
    if (!user || !enabled || !activeTrip || activeTrip.trip.done) return;
    await resolveActiveTrip(user.uid, weekIdFor(now, weekStart), now, affinityAt).catch((err) => console.error('Trip update failed:', err));
  }, [user, enabled, activeTrip, weekStart, affinityAt]);

  // Bring the trip up to date on open, on return to the foreground, and every minute.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    refreshRef.current();
    const timer = setInterval(() => refreshRef.current(), RESOLVE_EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshRef.current(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [enabled, activeTrip?.trip.id]);

  const value: GameContextType = {
    enabled,
    loading,
    state,
    activeTrip,
    nowMs,
    affinityAt,
    error,
    join: () => run(async () => {
      if (!user) return;
      await joinAdventureBeta(user.uid, weekIdFor(Date.now(), weekStart));
      setAdventureBeta(true);
    }),
    send: (legs) => run(async () => {
      if (!user) return;
      const now = Date.now();
      await startTrip(user.uid, weekIdFor(now, weekStart), legs, now);
      setNowMs(now);
    }),
    callBack: () => run(async () => {
      if (!user) return;
      const now = Date.now();
      await callBackTrip(user.uid, weekIdFor(now, weekStart), now, affinityAt);
    }),
    dismissReturn: () => run(async () => {
      if (!user) return;
      const now = Date.now();
      await dismissReturn(user.uid, weekIdFor(now, weekStart), now);
    }),
    applyLamp: (index, skill) => run(async () => {
      if (!user) return;
      await applyLampOn(user.uid, weekIdFor(Date.now(), weekStart), index, skill);
    }),
    refresh,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
