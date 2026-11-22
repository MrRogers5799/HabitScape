/** The new version's tab route names (PROD-034), for jumping between tabs from inside a stack: `navigation.getParent()?.navigate(TABS.map)`. Kept apart from the navigator so screens can import it without a cycle. */
export const TABS = { habits: 'HabitsTab', planner: 'PlannerTab', map: 'MapTab', hero: 'HeroTab' } as const;
