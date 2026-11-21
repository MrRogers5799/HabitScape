/**
 * Display helpers for the game screens: names and short descriptions of activities,
 * and plain-English hours. Pure, so screens stay simple.
 */
import { CREATURES, ITEMS, METHODS, QUESTS, REGIONS } from './content/valley';
import { activityOf } from './trips';

export const itemName = (id: string): string => ITEMS[id]?.name ?? id;
export const regionName = (id: string): string => REGIONS[id]?.name ?? id;

/** English plural for creature names: Wolf → Wolves, Goblin → Goblins. */
function plural(name: string): string {
  return /f$/.test(name) ? `${name.slice(0, -1)}ves` : `${name}s`;
}

export function activityName(id: string): string {
  if (METHODS[id]) return METHODS[id].name;
  const act = activityOf(id);
  if (act?.kind === 'fight') return `Fight ${act.creature.name.toLowerCase().startsWith('the ') ? act.creature.name : plural(act.creature.name)}`;
  if (act?.kind === 'quest') return `Quest: ${act.quest.name}`;
  return id;
}

/** "30m", "1h", "2h 30m". */
export function formatHours(h: number): string {
  const total = Math.round(h * 60);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

/** "14:30" in the phone's local time. */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Every activity available in a region, grouped for the region screen. */
export function activitiesIn(regionId: string) {
  return {
    methods: Object.values(METHODS).filter((m) => m.regions.includes(regionId) && !m.id.startsWith('smith-')),
    /** Anvil recipes (smithing gear and tools), listed separately so the region stays readable. */
    recipes: Object.values(METHODS).filter((m) => m.regions.includes(regionId) && m.id.startsWith('smith-')),
    fights: Object.values(CREATURES).filter((c) => c.region === regionId),
    quests: Object.values(QUESTS).filter((q) => q.region === regionId),
  };
}
