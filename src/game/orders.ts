/**
 * Village orders (PROG-044): each village's board asks for a few items each day, and
 * filling one pays XP straight to the skills that make those items (PROG-048). Spare gear and materials get a use without coins
 * (PROG-013 stands).
 *
 * Boards are worked out, not stored: the same region, day and adventurer give the same
 * orders, seeded by the day. Only which orders were filled today is saved. Orders ask
 * for things the adventurer can already get (their level, and materials from open
 * regions): gear one to three at a time, other things about 15 to 45 minutes' work.
 */
import { levelOf } from './adventurer';
import { ITEMS, METHODS, REGIONS } from './content/valley';
import { hashString, mulberry32 } from './rng';
import { ORDERS_PER_BOARD } from './rules';
import { addRewardXP } from './trips';
import { GameSkill, GameState, ItemId, Method } from './types';

export interface VillageOrder {
  /** `<region>-<item>`, unique on a board for the day. */
  id: string;
  regionId: string;
  item: ItemId;
  count: number;
  /** XP paid on delivery, to the skills that make the items: half again what making them gave (PROG-048). */
  xp: Partial<Record<GameSkill, number>>;
}

/** How much more XP an order pays than making its items did. */
export const ORDER_XP_BONUS = 1.5;

/** The methods that make each item, gathering and processing alike (melting doesn't count). */
function makersOf(item: ItemId): Method[] {
  return Object.values(METHODS).filter((m) => m.output === item && !m.id.startsWith('melt-'));
}

type SkillXP = Partial<Record<GameSkill, number>>;
const sumXP = (xp: SkillXP) => Object.values(xp).reduce<number>((a, n) => a + (n ?? 0), 0);

/** XP per skill it takes to make one of an item from scratch, inputs included (cheapest way). */
export function itemXPBySkill(item: ItemId, seen: ReadonlySet<ItemId> = new Set()): SkillXP {
  if (seen.has(item)) return {};
  const next = new Set(seen).add(item);
  let best: SkillXP | null = null;
  for (const m of makersOf(item)) {
    const xp: SkillXP = { [m.skill]: m.xpEach / (m.kind === 'process' ? m.outputEach ?? 1 : 1) };
    if (m.kind === 'process') {
      for (const [input, n] of Object.entries(m.inputs)) {
        for (const [s, v] of Object.entries(itemXPBySkill(input, next)) as [GameSkill, number][]) xp[s] = (xp[s] ?? 0) + n * v;
      }
    }
    if (!best || sumXP(xp) < sumXP(best)) best = xp;
  }
  return best ?? {};
}

/** XP it takes to make one of an item from scratch, inputs included (cheapest way). */
export const itemXPValue = (item: ItemId): number => sumXP(itemXPBySkill(item));

const unlocked = (state: GameState, regionId: string) => {
  const gate = REGIONS[regionId]?.questGate;
  return !!REGIONS[regionId] && (!gate || !!state.quests[gate]);
};

/** The adventurer can get this item now: some method they can use, in an open region, from things they can get. */
function obtainable(state: GameState, item: ItemId, seen: ReadonlySet<ItemId> = new Set()): boolean {
  if (seen.has(item)) return false;
  const next = new Set(seen).add(item);
  return makersOf(item).some((m) => levelOf(state, m.skill) >= m.level && m.regions.some((r) => unlocked(state, r))
    && (m.kind !== 'process' || Object.keys(m.inputs).every((input) => obtainable(state, input, next))));
}

/** Items this board could ask for today: made or gathered in the region, that the adventurer can get now. */
function candidates(state: GameState, regionId: string): { item: ItemId; perHour: number }[] {
  const byItem = new Map<ItemId, number>();
  for (const m of Object.values(METHODS)) {
    if (!m.output || m.id.startsWith('melt-') || !m.regions.includes(regionId)) continue;
    if (levelOf(state, m.skill) < m.level || !obtainable(state, m.output)) continue;
    byItem.set(m.output, Math.max(byItem.get(m.output) ?? 0, m.perHour));
  }
  return [...byItem.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([item, perHour]) => ({ item, perHour }));
}

/** Gear and tools are asked for one to three at a time; everything else by about 15 to 45 minutes' work. */
function orderCount(item: ItemId, perHour: number, rand: () => number): number {
  if (ITEMS[item]?.equip || ITEMS[item]?.tool) return 1 + Math.floor(rand() * 3);
  return Math.max(1, Math.round(perHour * (0.25 + rand() * 0.5)));
}

/** Today's orders on a region's board (`dayId` is the player's local date, e.g. '2026-11-21'). */
export function ordersFor(state: GameState, regionId: string, dayId: string): VillageOrder[] {
  const region = REGIONS[regionId];
  if (!region || (region.questGate && !state.quests[region.questGate])) return [];
  const pool = candidates(state, regionId);
  const rand = mulberry32(hashString(`orders#${dayId}#${regionId}`));
  // Seeded shuffle, then the first few.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, ORDERS_PER_BOARD).map(({ item, perHour }) => {
    const count = orderCount(item, perHour, rand);
    const xp = Object.fromEntries(
      (Object.entries(itemXPBySkill(item)) as [GameSkill, number][]).map(([s, v]) => [s, Math.round(count * v * ORDER_XP_BONUS)]),
    ) as SkillXP;
    return { id: `${regionId}-${item}`, regionId, item, count, xp };
  });
}

const filledKey = (dayId: string, orderId: string) => `${dayId}:${orderId}`;

export const orderFilled = (state: GameState, dayId: string, orderId: string): boolean => !!state.ordersFilled[filledKey(dayId, orderId)];

/** Hands an order's items over from the bank and pays its XP to the skills. Older days' marks are dropped. */
export function fillOrder(state: GameState, regionId: string, orderId: string, dayId: string): GameState {
  const order = ordersFor(state, regionId, dayId).find((o) => o.id === orderId);
  if (!order) throw new Error('That order is no longer on the board');
  if (orderFilled(state, dayId, orderId)) throw new Error('That order is already filled');
  if ((state.bank[order.item] ?? 0) < order.count) throw new Error("You don't have enough for that order");
  const today = Object.fromEntries(Object.keys(state.ordersFilled).filter((k) => k.startsWith(`${dayId}:`)).map((k) => [k, true as const]));
  const next: GameState = {
    ...state,
    xp: { ...state.xp },
    bank: { ...state.bank, [order.item]: state.bank[order.item] - order.count },
    ordersFilled: { ...today, [filledKey(dayId, orderId)]: true },
  };
  for (const [s, n] of Object.entries(order.xp) as [GameSkill, number][]) addRewardXP(next, null, s, n);
  return next;
}
