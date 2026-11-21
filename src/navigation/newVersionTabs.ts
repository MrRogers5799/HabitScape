/** The new version's tab route names (PROD-019), for jumping between tabs from inside a stack: `navigation.getParent()?.navigate(TABS.map)`. Kept apart from the navigator so screens can import it without a cycle. */
export const TABS = { today: 'TodayTab', map: 'MapTab', hero: 'HeroTab', workout: 'WorkoutTab' } as const;
