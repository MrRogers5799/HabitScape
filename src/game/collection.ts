/**
 * The collection log (PROG-047): every unique in the game, in sections, built from the
 * content so a new boss, unique or pet joins it as soon as it is added. What the player
 * has found lives in GameState.collection.
 */
import { CREATURES, SKILL_PETS } from './content/valley';
import { CollectionEntry, GAME_SKILLS, GameState, ItemId } from './types';

export interface CollectionSection {
  id: string;
  title: string;
  items: ItemId[];
}

export function collectionLog(): CollectionSection[] {
  const bosses = Object.values(CREATURES)
    .filter((c) => c.boss)
    .map((c) => ({ id: c.id, title: c.name, items: [...c.boss!.uniques.map((u) => u.item), c.boss!.pet.item] }));
  return [...bosses, { id: 'skilling-pets', title: 'Skilling pets', items: GAME_SKILLS.map((s) => SKILL_PETS[s]) }];
}

/** Every item in the log. */
export const collectionItems = (): ItemId[] => collectionLog().flatMap((s) => s.items);

export function collectionProgress(state: GameState): { found: number; total: number } {
  const all = collectionItems();
  return { found: all.filter((i) => state.collection[i]).length, total: all.length };
}

/**
 * Fills the log from the bank for uniques found before the log existed (no date known),
 * so nothing a player already owns shows as missing.
 */
export function backfillCollection(bank: Record<string, number>, collection: Record<ItemId, CollectionEntry>): Record<ItemId, CollectionEntry> {
  const out = { ...collection };
  for (const item of collectionItems()) if (!out[item] && (bank[item] ?? 0) > 0) out[item] = { atMs: 0 };
  return out;
}
