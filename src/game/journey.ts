/**
 * The road to the Bog Warden (PROD-021, PROD-032): a new player's first goal, as nine steps
 * shown one at a time on Today. A step is done when the game state says so (nothing to
 * tick by hand); the player then collects its reward, a few items that set up the next
 * step. Steps go in order, so a later step's condition is only checked once the earlier
 * ones are collected. Rough pace at today's numbers: about 50 adventure hours in all.
 */
import { ITEMS } from './content/valley';
import { GAME_SKILLS, GameState, ItemId } from './types';

/** Where a step's "Go" button leads: a tab, or a region and one of its sections. */
export type JourneyTarget =
  | { tab: 'map' }
  | { regionId: string; section: 'gather' | 'make' | 'fight' | 'village' };

/** Facts the game state can't hold, passed in by the caller. */
export interface JourneyContext {
  /** The adventurer has (or had) something queued. */
  queued: boolean;
}

export interface JourneyStep {
  id: string;
  title: string;
  /** One line on what to do next. */
  hint: string;
  done: (state: GameState, ctx: JourneyContext) => boolean;
  reward: Record<ItemId, number>;
  go?: JourneyTarget;
}

const owns = (state: GameState, id: ItemId) => (state.bank[id] ?? 0) > 0;
const ownsArmour = (state: GameState, metal: string) =>
  Object.keys(state.bank).some((id) => id.startsWith(`${metal}_`) && owns(state, id) && !!ITEMS[id]?.equip && ITEMS[id].equip!.slot !== 'mainHand');
/** Any game XP beyond a new adventurer's (who starts at Hitpoints 10). */
const trained = (state: GameState) => GAME_SKILLS.some((s) => s !== 'Hitpoints' && (state.xp[s] ?? 0) > 0);

export const JOURNEY: JourneyStep[] = [
  {
    id: 'first-habit', title: 'Tick a habit',
    hint: "Tick one of today's habits below: it earns adventure time.",
    done: (s, c) => s.time.weekEarnedHours > 0 || s.time.bankHours > 0 || c.queued || trained(s),
    reward: { copper_ore: 10, tin_ore: 10 },
  },
  {
    id: 'first-block', title: 'Pick something on the Map',
    hint: 'Open a region on the Map and add something to do. Your adventurer works on it in real time.',
    done: (s, c) => c.queued || trained(s),
    reward: { shrimp: 10 }, go: { tab: 'map' },
  },
  {
    id: 'bronze-weapon', title: 'Smith a bronze weapon',
    hint: 'Smelt bronze bars from copper and tin, then make a sword or mace at the anvil.',
    done: (s) => owns(s, 'bronze_sword') || owns(s, 'bronze_mace'),
    reward: { bronze_bar: 10 }, go: { regionId: 'millbrook', section: 'make' },
  },
  {
    id: 'goblins', title: 'Defeat 10 goblins',
    hint: 'Fight goblins in Millbrook. Pick the style you want to train.',
    done: (s) => (s.kills.goblin ?? 0) >= 10,
    reward: { bronze_shield: 1 }, go: { regionId: 'millbrook', section: 'fight' },
  },
  {
    id: 'road-to-stonecrest', title: 'Quest: The Road to Stonecrest',
    hint: 'Reach Attack 15 and defeat 10 wolves in Greywood (some Defence helps), then do the quest in Millbrook.',
    done: (s) => !!s.quests['road-to-stonecrest'],
    reward: { iron_pickaxe: 1 }, go: { regionId: 'millbrook', section: 'village' },
  },
  {
    id: 'iron-armour', title: 'Iron armour',
    hint: 'Mine iron in Stonecrest Hills, smelt it, and smith a piece of iron armour.',
    done: (s) => ownsArmour(s, 'iron'),
    reward: { iron_bar: 10 }, go: { regionId: 'stonecrest', section: 'gather' },
  },
  {
    id: 'drowned-bell', title: 'Quest: The Drowned Bell',
    hint: 'Reach Fishing 20 and Woodcutting 20 and defeat 10 bandits in Stonecrest. It opens the Bog.',
    done: (s) => !!s.quests['drowned-bell'],
    reward: { coal: 30 }, go: { regionId: 'millbrook', section: 'village' },
  },
  {
    id: 'steel-and-salmon', title: 'Steel armour and salmon',
    hint: "Smith a piece of steel armour and cook salmon: the Warden hits hard, and food keeps you in the fight.",
    done: (s) => ownsArmour(s, 'steel') && owns(s, 'salmon'),
    reward: { salmon: 20 }, go: { tab: 'map' },
  },
  {
    id: 'bog-warden', title: 'Defeat the Bog Warden',
    hint: 'Head into the Sunken Bog with your steel armour and salmon packed.',
    done: (s) => (s.kills['bog-warden'] ?? 0) >= 1,
    reward: {}, go: { regionId: 'bog', section: 'fight' },
  },
];

/** The first step not yet collected, its index, and whether it's done; null when the road is finished. */
export function currentJourneyStep(state: GameState, ctx: JourneyContext): { step: JourneyStep; index: number; done: boolean } | null {
  const index = JOURNEY.findIndex((s) => !state.journey.claimed[s.id]);
  if (index < 0) return null;
  const step = JOURNEY[index];
  return { step, index, done: step.done(state, ctx) };
}

/** Collects the current step's reward. Throws if it isn't the current step or isn't done yet. */
export function claimJourneyStep(state: GameState, stepId: string, ctx: JourneyContext): GameState {
  const cur = currentJourneyStep(state, ctx);
  if (!cur || cur.step.id !== stepId) throw new Error('That step is not the current one');
  if (!cur.done) throw new Error('That step is not done yet');
  const bank = { ...state.bank };
  for (const [item, n] of Object.entries(cur.step.reward)) bank[item] = (bank[item] ?? 0) + n;
  return { ...state, bank, journey: { ...state.journey, claimed: { ...state.journey.claimed, [stepId]: true } } };
}

/** The welcome pages were seen (or skipped). */
export const markWelcomed = (state: GameState): GameState => ({ ...state, journey: { ...state.journey, welcomed: true } });
