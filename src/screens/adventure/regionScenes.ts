/**
 * Regions as places (PROD-037): a painted scene with tappable spots. Each spot lists what
 * it holds by skill or kind, so the popup shows the same rows as the region's list. The
 * spots and their labels are drawn by the app over the image (never painted in), as
 * fractions of the image's width and height, so they can move without new art.
 * Millbrook first (owner, 2026-11-22), then Greywood, Stonecrest and the Bog the same day.
 * A spot that holds a lot (the forge) has a painted scene of its own inside, with its own
 * spots (owner, 2026-11-22: "1 more layer, where you are inside the forge").
 */
import { ImageSourcePropType } from 'react-native';
import { activityOf, GameSkill } from '../../game';

export type SpotContent = {
  /** Gathering methods of these skills. */
  gather?: GameSkill[];
  /** Processing methods (not anvil recipes or melting) of these skills. */
  make?: GameSkill[];
  /** The anvil's recipes. */
  anvil?: boolean;
  /** Melting gear back into bars. */
  melt?: boolean;
  /** Fights with these creatures. */
  fights?: string[];
  /** The order board (weekly and daily orders). */
  orders?: boolean;
};

/** A tappable place; with `inside`, tapping it goes into that scene instead of opening a popup. */
export type Spot = SpotContent & { id: string; label: string; x: number; y: number; inside?: RegionScene };

export type RegionScene = { image: ImageSourcePropType; aspect: number; spots: Spot[] };

export const REGION_SCENES: Record<string, RegionScene> = {
  // Layout fixed by art/game/specs/menu-art.json (millbrook_town).
  millbrook: {
    image: require('../../../assets/game-ui/scenes/millbrook_town.png'),
    aspect: 2 / 3,
    spots: [
      { id: 'mine', label: 'Mine', x: 0.24, y: 0.15, gather: ['Mining'] },
      { id: 'trees', label: 'Trees', x: 0.72, y: 0.19, gather: ['Woodcutting'] },
      { id: 'fire', label: 'Cooking fire', x: 0.2, y: 0.47, make: ['Cooking'] },
      { id: 'board', label: 'Order board', x: 0.53, y: 0.5, orders: true },
      {
        id: 'forge', label: 'Forge', x: 0.8, y: 0.49,
        // Layout fixed by art/game/specs/menu-art.json (forge_inside).
        inside: {
          image: require('../../../assets/game-ui/scenes/forge_inside.png'),
          aspect: 2 / 3,
          spots: [
            { id: 'furnace', label: 'Furnace', x: 0.58, y: 0.36, make: ['Smithing'] },
            { id: 'anvil', label: 'Anvil', x: 0.48, y: 0.7, anvil: true },
            { id: 'melt', label: 'Melt down', x: 0.5, y: 0.93, melt: true },
          ],
        },
      },
      { id: 'pier', label: 'Fishing pier', x: 0.3, y: 0.62, gather: ['Fishing'] },
      { id: 'cairn', label: 'Cairn', x: 0.5, y: 0.87, make: ['Prayer'] },
      { id: 'yard', label: 'Fights', x: 0.77, y: 0.69, fights: ['chicken', 'goblin'] },
    ],
  },
  // Layouts fixed by art/game/specs/menu-art.json (greywood_place, stonecrest_place, bog_place).
  greywood: {
    image: require('../../../assets/game-ui/scenes/greywood_place.png'),
    aspect: 2 / 3,
    spots: [
      { id: 'trees', label: 'Trees', x: 0.3, y: 0.31, gather: ['Woodcutting'] },
      { id: 'river', label: 'River', x: 0.66, y: 0.6, gather: ['Fishing'] },
      { id: 'board', label: 'Order board', x: 0.42, y: 0.85, orders: true },
      { id: 'den', label: 'Wolf den', x: 0.82, y: 0.88, fights: ['wolf'] },
    ],
  },
  stonecrest: {
    image: require('../../../assets/game-ui/scenes/stonecrest_place.png'),
    aspect: 2 / 3,
    spots: [
      { id: 'mine', label: 'Mine', x: 0.52, y: 0.31, gather: ['Mining'] },
      { id: 'board', label: 'Order board', x: 0.67, y: 0.59, orders: true },
      { id: 'camp', label: 'Bandit camp', x: 0.45, y: 0.88, fights: ['bandit'] },
    ],
  },
  bog: {
    image: require('../../../assets/game-ui/scenes/bog_place.png'),
    aspect: 2 / 3,
    spots: [
      { id: 'lair', label: "Warden's lair", x: 0.62, y: 0.78, fights: ['bog-warden'] },
    ],
  },
};

/** Which adventurer pose fits an activity (art bible §6); file ids in ADVENTURER_POSES. */
export function poseFor(activityId: string): string {
  const act = activityOf(activityId);
  if (!act) return 'idle';
  if (act.kind === 'fight') return 'sparring';
  if (act.kind === 'quest') return 'walking_home';
  const m = act.method;
  switch (m.skill) {
    case 'Mining': return 'mining';
    case 'Woodcutting': return 'chopping';
    case 'Fishing': return m.kind === 'gather' && m.tool === 'small_net' ? 'fishing_net' : 'fishing_rod';
    case 'Smithing': return 'smithing';
    case 'Cooking': return 'cooking';
    case 'Prayer': return 'burying';
    default: return 'idle';
  }
}

/** The spot where an activity happens (or the one whose inside it's in), so the scene can show the adventurer there. */
export function spotFor(scene: RegionScene, activityId: string): Spot | undefined {
  const act = activityOf(activityId);
  if (!act || act.kind === 'quest') return undefined;
  if (act.kind === 'fight') return scene.spots.find((s) => s.fights?.includes(act.creature.id));
  const m = act.method;
  const holds = (c: SpotContent) => (m.id.startsWith('smith-') ? !!c.anvil : m.id.startsWith('melt-') ? !!c.melt
    : !!(m.kind === 'gather' ? c.gather : c.make)?.includes(m.skill));
  // A spot with a scene inside counts as holding what its inner spots hold.
  return scene.spots.find((s) => holds(s) || s.inside?.spots.some(holds));
}
