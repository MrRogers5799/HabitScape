/**
 * The melee valley: content for the first playable slice (PROD-018).
 * Numbers come from the vault's "Content sheet - melee valley" and are first passes.
 */
import { AttackType, Creature, GameSkill, Item, Method, Quest, Region, Slot } from '../types';
import { MELT_SHARE } from '../rules';

export const REGIONS: Record<string, Region> = {
  millbrook: { id: 'millbrook', name: 'Millbrook', travelFraction: 0 },
  greywood: { id: 'greywood', name: 'Greywood', travelFraction: 0.05 },
  stonecrest: { id: 'stonecrest', name: 'Stonecrest Hills', travelFraction: 0.08, questGate: 'road-to-stonecrest' },
  bog: { id: 'bog', name: 'The Sunken Bog', travelFraction: 0.1, questGate: 'drowned-bell' },
};

// ---------- Metal tiers and smithed gear (content sheet §4–5) ----------

const TIERS = [
  { key: 'bronze', name: 'Bronze', tier: 1, base: 1, wear: 1, bar: 'bronze_bar', xpPerBar: 12 },
  { key: 'iron', name: 'Iron', tier: 2, base: 15, wear: 10, bar: 'iron_bar', xpPerBar: 25 },
  { key: 'steel', name: 'Steel', tier: 3, base: 30, wear: 20, bar: 'steel_bar', xpPerBar: 38 },
] as const;

interface Piece {
  key: string;
  name: string;
  bars: number;
  offset: number;
  slot?: Slot;
  attackType?: AttackType;
  /** Per tier: weapon power or armour defence. */
  stat?: [number, number, number];
  tool?: 'pickaxe' | 'hatchet';
}

const PIECES: Piece[] = [
  { key: 'dagger', name: 'dagger', bars: 1, offset: 0, slot: 'mainHand', attackType: 'stab', stat: [4, 8, 12] },
  { key: 'hatchet', name: 'hatchet', bars: 1, offset: 1, tool: 'hatchet' },
  { key: 'mace', name: 'mace', bars: 2, offset: 2, slot: 'mainHand', attackType: 'crush', stat: [6, 11, 17] },
  { key: 'helm', name: 'helm', bars: 2, offset: 3, slot: 'head', stat: [1, 2, 3] },
  { key: 'sword', name: 'sword', bars: 2, offset: 4, slot: 'mainHand', attackType: 'slash', stat: [5, 10, 15] },
  { key: 'pickaxe', name: 'pickaxe', bars: 2, offset: 5, tool: 'pickaxe' },
  { key: 'boots', name: 'boots', bars: 1, offset: 5, slot: 'boots', stat: [1, 1, 2] },
  { key: 'gloves', name: 'gloves', bars: 1, offset: 6, slot: 'gloves', stat: [1, 1, 2] },
  { key: 'shield', name: 'shield', bars: 3, offset: 8, slot: 'offHand', stat: [2, 4, 6] },
  { key: 'platelegs', name: 'platelegs', bars: 3, offset: 10, slot: 'legs', stat: [2, 4, 6] },
  { key: 'chestplate', name: 'chestplate', bars: 5, offset: 13, slot: 'chest', stat: [3, 5, 8] },
];

const SMITHED_ITEMS: Item[] = [];
const SMITHING_METHODS: Method[] = [];
const MELTING_METHODS: Method[] = [];
for (const t of TIERS) {
  for (const p of PIECES) {
    const id = `${t.key}_${p.key}`;
    const item: Item = { id, name: `${t.name} ${p.name}` };
    if (p.tool) item.tool = { type: p.tool, tier: t.tier, level: t.wear };
    if (p.slot) {
      const weapon = p.slot === 'mainHand';
      const skill: GameSkill = weapon ? 'Attack' : 'Defence';
      item.equip = { slot: p.slot, wear: { skill, level: t.wear } };
      if (weapon) { item.equip.attackType = p.attackType; item.equip.power = p.stat![t.tier - 1]; }
      else item.equip.defence = p.stat![t.tier - 1];
    }
    SMITHED_ITEMS.push(item);
    SMITHING_METHODS.push({
      kind: 'process', id: `smith-${id}`, name: `Smith ${item.name.toLowerCase()}s`, skill: 'Smithing',
      level: t.base + p.offset, regions: ['millbrook'], xpEach: p.bars * t.xpPerBar,
      perHour: 120 / p.bars, inputs: { [t.bar]: p.bars }, output: id,
    });
    // Melting (PROG-044): half the bars back, rounded down, and no XP, so smithing and
    // melting can't loop into free Smithing XP. One-bar pieces give nothing, so they have none.
    const back = Math.floor(p.bars * MELT_SHARE);
    if (back > 0) {
      MELTING_METHODS.push({
        kind: 'process', id: `melt-${id}`, name: `Melt ${item.name.toLowerCase()}s`, skill: 'Smithing',
        level: 1, regions: ['millbrook'], xpEach: 0, perHour: 240, inputs: { [id]: 1 }, output: t.bar, outputEach: back,
      });
    }
  }
}

// ---------- Items ----------

const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({ id, name, ...extra });

export const ITEMS: Record<string, Item> = Object.fromEntries(
  ([
    item('copper_ore', 'Copper ore'), item('tin_ore', 'Tin ore'), item('iron_ore', 'Iron ore'), item('coal', 'Coal'),
    item('bronze_bar', 'Bronze bar'), item('iron_bar', 'Iron bar'), item('steel_bar', 'Steel bar'),
    item('logs', 'Logs'), item('oak_logs', 'Oak logs'), item('willow_logs', 'Willow logs'),
    item('raw_shrimp', 'Raw shrimp'), item('raw_trout', 'Raw trout'), item('raw_salmon', 'Raw salmon'), item('raw_chicken', 'Raw chicken'),
    item('shrimp', 'Shrimp', { food: 3 }), item('cooked_chicken', 'Cooked chicken', { food: 3 }),
    item('trout', 'Trout', { food: 7 }), item('salmon', 'Salmon', { food: 9 }),
    item('burnt_food', 'Burnt food'),
    item('bones', 'Bones'), item('wolf_bones', 'Wolf bones'), item('big_bones', 'Big bones'), item('warden_remains', "Warden's remains"),
    item('wolf_pelt', 'Wolf pelt'),
    item('small_net', 'Small fishing net', { tool: { type: 'small_net', tier: 1, level: 1 } }),
    item('fishing_rod', 'Fishing rod', { tool: { type: 'fishing_rod', tier: 1, level: 1 } }),
    item('wardens_maul', "Warden's maul", { equip: { slot: 'mainHand', wear: { skill: 'Attack', level: 30 }, attackType: 'crush', power: 22 } }),
    item('bog_iron_helm', 'Bog-iron helm', { equip: { slot: 'head', wear: { skill: 'Defence', level: 30 }, defence: 6 } }),
    item('bogling', 'Bogling (pet)'),
    ...SMITHED_ITEMS,
  ] as Item[]).map((i) => [i.id, i]),
);

// ---------- Methods ----------

const cookBurn = { chanceAtUnlock: 0.3, levelsToZero: 20, burntItem: 'burnt_food' };
const bury = (id: string, bones: string, name: string, xpEach: number): Method => ({
  kind: 'process', id, name, skill: 'Prayer', level: 1, regions: ['millbrook'], xpEach, perHour: 600, inputs: { [bones]: 1 },
});

export const METHODS: Record<string, Method> = Object.fromEntries(
  ([
    // Mining
    { kind: 'gather', id: 'mine-copper', name: 'Mine copper', skill: 'Mining', level: 1, regions: ['millbrook', 'stonecrest'], xpEach: 10, perHour: 70, output: 'copper_ore', tool: 'pickaxe', toolTiered: true },
    { kind: 'gather', id: 'mine-tin', name: 'Mine tin', skill: 'Mining', level: 1, regions: ['millbrook', 'stonecrest'], xpEach: 10, perHour: 70, output: 'tin_ore', tool: 'pickaxe', toolTiered: true },
    { kind: 'gather', id: 'mine-iron', name: 'Mine iron', skill: 'Mining', level: 15, regions: ['stonecrest'], xpEach: 30, perHour: 45, output: 'iron_ore', tool: 'pickaxe', toolTiered: true },
    { kind: 'gather', id: 'mine-coal', name: 'Mine coal', skill: 'Mining', level: 30, regions: ['stonecrest'], xpEach: 70, perHour: 32, output: 'coal', tool: 'pickaxe', toolTiered: true },
    // Woodcutting
    { kind: 'gather', id: 'chop-tree', name: 'Chop trees', skill: 'Woodcutting', level: 1, regions: ['millbrook'], xpEach: 10, perHour: 70, output: 'logs', tool: 'hatchet', toolTiered: true },
    { kind: 'gather', id: 'chop-oak', name: 'Chop oaks', skill: 'Woodcutting', level: 15, regions: ['millbrook', 'greywood'], xpEach: 30, perHour: 45, output: 'oak_logs', tool: 'hatchet', toolTiered: true },
    { kind: 'gather', id: 'chop-willow', name: 'Chop willows', skill: 'Woodcutting', level: 30, regions: ['greywood'], xpEach: 70, perHour: 32, output: 'willow_logs', tool: 'hatchet', toolTiered: true },
    // Fishing (tools untiered in the slice; rates set higher to match)
    { kind: 'gather', id: 'net-shrimp', name: 'Net shrimp', skill: 'Fishing', level: 1, regions: ['millbrook'], xpEach: 12, perHour: 91, output: 'raw_shrimp', tool: 'small_net', toolTiered: false },
    { kind: 'gather', id: 'rod-trout', name: 'Fish for trout', skill: 'Fishing', level: 15, regions: ['greywood'], xpEach: 35, perHour: 62, output: 'raw_trout', tool: 'fishing_rod', toolTiered: false },
    { kind: 'gather', id: 'rod-salmon', name: 'Fish for salmon', skill: 'Fishing', level: 30, regions: ['greywood'], xpEach: 80, perHour: 49, output: 'raw_salmon', tool: 'fishing_rod', toolTiered: false },
    // Smelting
    { kind: 'process', id: 'smelt-bronze', name: 'Smelt bronze bars', skill: 'Smithing', level: 1, regions: ['millbrook'], xpEach: 6, perHour: 120, output: 'bronze_bar', inputs: { copper_ore: 1, tin_ore: 1 } },
    { kind: 'process', id: 'smelt-iron', name: 'Smelt iron bars', skill: 'Smithing', level: 15, regions: ['millbrook'], xpEach: 12, perHour: 120, output: 'iron_bar', inputs: { iron_ore: 1 } },
    { kind: 'process', id: 'smelt-steel', name: 'Smelt steel bars', skill: 'Smithing', level: 30, regions: ['millbrook'], xpEach: 18, perHour: 120, output: 'steel_bar', inputs: { iron_ore: 1, coal: 2 } },
    // Cooking
    { kind: 'process', id: 'cook-shrimp', name: 'Cook shrimp', skill: 'Cooking', level: 1, regions: ['millbrook'], xpEach: 15, perHour: 150, output: 'shrimp', inputs: { raw_shrimp: 1 }, burn: cookBurn },
    { kind: 'process', id: 'cook-chicken', name: 'Cook chicken', skill: 'Cooking', level: 1, regions: ['millbrook'], xpEach: 15, perHour: 150, output: 'cooked_chicken', inputs: { raw_chicken: 1 }, burn: cookBurn },
    { kind: 'process', id: 'cook-trout', name: 'Cook trout', skill: 'Cooking', level: 15, regions: ['millbrook'], xpEach: 40, perHour: 150, output: 'trout', inputs: { raw_trout: 1 }, burn: cookBurn },
    { kind: 'process', id: 'cook-salmon', name: 'Cook salmon', skill: 'Cooking', level: 25, regions: ['millbrook'], xpEach: 70, perHour: 150, output: 'salmon', inputs: { raw_salmon: 1 }, burn: cookBurn },
    // Prayer: burying bones at camp (PROG-033), bone XP per PROG-042
    bury('bury-bones', 'bones', 'Bury bones', 6),
    bury('bury-wolf-bones', 'wolf_bones', 'Bury wolf bones', 18),
    bury('bury-big-bones', 'big_bones', 'Bury big bones', 33),
    bury('bury-warden-remains', 'warden_remains', "Bury the Warden's remains", 180),
    ...SMITHING_METHODS,
    ...MELTING_METHODS,
  ] as Method[]).map((m) => [m.id, m]),
);

// ---------- Creatures and the boss (content sheet §6, §8) ----------

export const CREATURES: Record<string, Creature> = Object.fromEntries(
  ([
    { id: 'chicken', name: 'Chicken', level: 1, hp: 3, region: 'millbrook', baseKph: 60, refPower: 10, attack: -15, foodPerAttempt: 0, bones: 'bones',
      drops: [{ item: 'raw_chicken', chance: 1, min: 1, max: 1 }] },
    { id: 'goblin', name: 'Goblin', level: 5, hp: 10, region: 'millbrook', weakness: 'stab', baseKph: 30, refPower: 20, attack: -10, foodPerAttempt: 0, bones: 'bones',
      drops: [{ item: 'copper_ore', chance: 0.3, min: 1, max: 3 }, { item: 'tin_ore', chance: 0.3, min: 1, max: 3 }, { item: 'bronze_sword', chance: 1 / 64, min: 1, max: 1 }] },
    { id: 'wolf', name: 'Wolf', level: 15, hp: 30, region: 'greywood', weakness: 'slash', baseKph: 16, refPower: 48, attack: 20, foodPerAttempt: 0, bones: 'wolf_bones',
      drops: [{ item: 'wolf_pelt', chance: 0.5, min: 1, max: 1 }] },
    { id: 'bandit', name: 'Bandit', level: 25, hp: 55, region: 'stonecrest', weakness: 'crush', baseKph: 13, refPower: 77, attack: 44, foodPerAttempt: 0, bones: 'big_bones',
      drops: [{ item: 'iron_ore', chance: 0.3, min: 1, max: 4 }, { item: 'coal', chance: 0.3, min: 1, max: 3 }, { item: 'iron_bar', chance: 0.1, min: 1, max: 2 }, { item: 'steel_mace', chance: 1 / 128, min: 1, max: 1 }] },
    { id: 'bog-warden', name: 'The Bog Warden', level: 40, hp: 300, region: 'bog', weakness: 'crush', baseKph: 4, refPower: 92, attack: 80, foodPerAttempt: 2, bones: 'warden_remains',
      drops: [{ item: 'coal', chance: 1, min: 3, max: 6 }, { item: 'steel_bar', chance: 0.5, min: 1, max: 3 }],
      boss: { uniques: [{ item: 'wardens_maul', oneIn: 30 }, { item: 'bog_iron_helm', oneIn: 30 }], pet: { item: 'bogling', oneIn: 400 } } },
  ] as Creature[]).map((c) => [c.id, c]),
);

// ---------- Quests (content sheet §9) ----------

export const QUESTS: Record<string, Quest> = Object.fromEntries(
  ([
    { id: 'supper-for-the-smith', name: 'Supper for the Smith', region: 'millbrook', hours: 1,
      requirements: [{ kind: 'skill', skill: 'Cooking', level: 5 }, { kind: 'item', item: 'shrimp', count: 20 }],
      takes: { shrimp: 20 }, rewards: { items: { fishing_rod: 1 }, lampXP: 500 } },
    { id: 'road-to-stonecrest', name: 'The Road to Stonecrest', region: 'millbrook', hours: 2,
      requirements: [{ kind: 'skill', skill: 'Attack', level: 15 }, { kind: 'kills', creature: 'wolf', count: 10 }],
      rewards: { lampXP: 1500 } },
    { id: 'drowned-bell', name: 'The Drowned Bell', region: 'millbrook', hours: 2,
      requirements: [{ kind: 'skill', skill: 'Fishing', level: 20 }, { kind: 'skill', skill: 'Woodcutting', level: 20 }, { kind: 'kills', creature: 'bandit', count: 10 }],
      rewards: { lampXP: 3000 } },
  ] as Quest[]).map((q) => [q.id, q]),
);

/** What a new adventurer starts with (content sheet §10). */
export const STARTING_BANK: Record<string, number> = {
  bronze_dagger: 1,
  bronze_pickaxe: 1,
  bronze_hatchet: 1,
  small_net: 1,
  shrimp: 5,
};
