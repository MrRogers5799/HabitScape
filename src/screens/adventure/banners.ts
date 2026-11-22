/**
 * The Planner's activity banners (PROD-038): the adventurer painted into the exact place,
 * doing the exact activity, so the banner says where they are and what they're doing.
 * Art from art/game/specs/planner-banners.json. A banner not painted yet falls back to the
 * region's scene with the pose on top.
 */
import { ImageSourcePropType } from 'react-native';
import { activityOf } from '../../game';
import { REGION_SCENES, spotFor } from './regionScenes';

export const BANNERS: Partial<Record<string, ImageSourcePropType>> = {
  bog_lair: require('../../../assets/game-ui/banners/bog_lair.png'),
  camp: require('../../../assets/game-ui/banners/camp.png'),
  greywood_den: require('../../../assets/game-ui/banners/greywood_den.png'),
  greywood_river: require('../../../assets/game-ui/banners/greywood_river.png'),
  greywood_trees: require('../../../assets/game-ui/banners/greywood_trees.png'),
  millbrook_anvil: require('../../../assets/game-ui/banners/millbrook_anvil.png'),
  millbrook_cairn: require('../../../assets/game-ui/banners/millbrook_cairn.png'),
  millbrook_chickens: require('../../../assets/game-ui/banners/millbrook_chickens.png'),
  millbrook_fire: require('../../../assets/game-ui/banners/millbrook_fire.png'),
  millbrook_furnace: require('../../../assets/game-ui/banners/millbrook_furnace.png'),
  millbrook_goblins: require('../../../assets/game-ui/banners/millbrook_goblins.png'),
  millbrook_melt: require('../../../assets/game-ui/banners/millbrook_melt.png'),
  millbrook_mine: require('../../../assets/game-ui/banners/millbrook_mine.png'),
  millbrook_pier: require('../../../assets/game-ui/banners/millbrook_pier.png'),
  millbrook_trees: require('../../../assets/game-ui/banners/millbrook_trees.png'),
  road: require('../../../assets/game-ui/banners/road.png'),
  stonecrest_camp: require('../../../assets/game-ui/banners/stonecrest_camp.png'),
  stonecrest_mine: require('../../../assets/game-ui/banners/stonecrest_mine.png'),
};

/** Fights by creature: each creature's banner is where it lives. */
const FIGHT_BANNER: Record<string, string> = {
  chicken: 'millbrook_chickens', goblin: 'millbrook_goblins', wolf: 'greywood_den', bandit: 'stonecrest_camp', 'bog-warden': 'bog_lair',
};

/** Which banner shows an activity in a region: a fight by its creature, the forge by its station, else the region's spot. */
export function bannerKey(activityId: string, regionId: string): string {
  const act = activityOf(activityId);
  if (!act) return 'camp';
  if (act.kind === 'quest') return 'road';
  if (act.kind === 'fight') return FIGHT_BANNER[act.creature.id] ?? `${regionId}_fight`;
  const id = act.method.id;
  if (id.startsWith('smith-')) return 'millbrook_anvil';
  if (id.startsWith('melt-')) return 'millbrook_melt';
  if (id.startsWith('smelt-')) return 'millbrook_furnace';
  const scene = REGION_SCENES[regionId];
  const spot = scene ? spotFor(scene, activityId) : undefined;
  return spot ? `${regionId}_${spot.id}` : `${regionId}_${act.method.skill.toLowerCase()}`;
}
