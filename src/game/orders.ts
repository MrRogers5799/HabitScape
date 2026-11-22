/**
 * Village orders (PROG-044): each village's board asks for a few items each day, and
 * filling one pays XP straight to the skills that make those items (PROG-048). Spare gear
 * and materials get a use without coins (PROG-013 stands).
 *
 * Boards are worked out, not stored: the same region, day and adventurer give the same
 * orders, seeded by the day. Only which orders were filled today is saved. Orders ask
 * for things the adventurer can already get: made or gathered there (their level, and
 * materials from open regions), or dropped by a creature there they can beat (combat
 * requests, PROG-050). Gear comes one to three at a time, other things about 15 to 45
 * minutes' work. Each board also has one larger weekly order (PROG-054), seeded by the week,
 * about four times a daily order and paying double the bonus. "Craft & deliver" (PROG-050) queues the work orders that make what's
 * missing from the bank, and the last one delivers the order when it finishes.
 */
import { addRewardXP, burnChance, levelOf } from './adventurer';
import { fightPreview } from './combat';
import { CREATURES, ITEMS, METHODS, REGIONS } from './content/valley';
import { hashString, mulberry32 } from './rng';
import { ORDERS_PER_BOARD, WEEKLY_ORDER_SIZE, WEEKLY_ORDER_XP_BONUS } from './rules';
import { GameSkill, GameState, ItemId, LegPlan, Method, TripReport, VillageOrder } from './types';

type SkillXP = Partial<Record<GameSkill, number>>;


/** How much more XP an order pays than making its items did. */
export const ORDER_XP_BONUS = 1.5;
/** A combat request only asks for drops from creatures the adventurer beats at least this often. */
const MIN_WIN_FOR_REQUEST = 0.5;

/** The methods that make each item, gathering and processing alike (melting doesn't count). */
function makersOf(item: ItemId): Method[] {
  return Object.values(METHODS).filter((m) => m.output === item && !m.id.startsWith('melt-'));
}

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
    && (!m.quest || !!state.quests[m.quest])
    && (m.kind !== 'process' || Object.keys(m.inputs).every((input) => obtainable(state, input, next))));
}

interface Candidate { item: ItemId; perHour: number; xpEach: SkillXP; creature?: string }

/**
 * Combat requests (PROG-050): bones and drops that only fights give, from creatures in the
 * region the adventurer beats often enough. XP per item is the fight XP per kill shared
 * over the expected drops, split as a kill's XP is (styles evenly, plus Hitpoints).
 */
function fightCandidates(state: GameState, regionId: string): Candidate[] {
  const out: Candidate[] = [];
  for (const c of Object.values(CREATURES)) {
    if (c.region !== regionId || c.boss) continue;
    const p = fightPreview(state, c);
    if (p.winChance < MIN_WIN_FOR_REQUEST || p.killsPerHour <= 0) continue;
    const drops: [ItemId, number][] = [[c.bones, 1], ...c.drops.map((d) => [d.item, d.chance * (d.min + d.max) / 2] as [ItemId, number])];
    for (const [item, perKill] of drops) {
      // Only things fights alone give; ore from goblins already has Mining as its home.
      if (makersOf(item).length > 0 || ITEMS[item]?.equip || perKill <= 0) continue;
      const style = (4 * c.hp) / perKill / 3;
      out.push({
        item, creature: c.id, perHour: p.killsPerHour * perKill,
        xpEach: { Attack: style, Strength: style, Defence: style, Hitpoints: ((4 / 3) * c.hp) / perKill },
      });
    }
  }
  return out;
}

/** Items this board could ask for today: made, gathered or fought for in the region, that the adventurer can get now. */
function candidates(state: GameState, regionId: string): Candidate[] {
  const byItem = new Map<ItemId, Candidate>();
  for (const m of Object.values(METHODS)) {
    if (!m.output || m.id.startsWith('melt-') || !m.regions.includes(regionId)) continue;
    if (levelOf(state, m.skill) < m.level || !obtainable(state, m.output)) continue;
    const prev = byItem.get(m.output);
    byItem.set(m.output, { item: m.output, perHour: Math.max(prev?.perHour ?? 0, m.perHour), xpEach: itemXPBySkill(m.output) });
  }
  for (const f of fightCandidates(state, regionId)) {
    // The same drop from two creatures: ask for it at the lower XP per item.
    const prev = byItem.get(f.item);
    if (!prev || sumXP(f.xpEach) < sumXP(prev.xpEach)) byItem.set(f.item, f);
  }
  return [...byItem.values()].sort((a, b) => a.item.localeCompare(b.item));
}

/** Gear and tools are asked for one to three at a time; everything else by about 15 to 45 minutes' work. */
function orderCount(item: ItemId, perHour: number, rand: () => number): number {
  if (ITEMS[item]?.equip || ITEMS[item]?.tool) return 1 + Math.floor(rand() * 3);
  return Math.max(1, Math.round(perHour * (0.25 + rand() * 0.5)));
}

/** An order for `count` of a candidate, paying XP (or a combat lamp) times `bonus`. */
function makeOrder(c: Candidate, regionId: string, id: string, count: number, bonus: number, weekId?: string): VillageOrder {
  const xp = Object.fromEntries(
    (Object.entries(c.xpEach) as [GameSkill, number][]).map(([s, v]) => [s, Math.round(count * v * bonus)]),
  ) as SkillXP;
  const period = weekId ? { weekId } : {};
  // A combat request pays a combat XP lamp instead (PROG-053); Slayer XP joins it once Slayer exists.
  if (c.creature) return { id, regionId, item: c.item, count, xp: {}, creature: c.creature, combatLamp: Math.round(sumXP(xp)), ...period };
  return { id, regionId, item: c.item, count, xp, ...period };
}

/**
 * This week's larger order on a region's board (PROG-054; `weekId` from weekIdFor). About
 * four times a daily order (gear four to six pieces) and double the XP bonus.
 */
export function weeklyOrderFor(state: GameState, regionId: string, weekId: string): VillageOrder | null {
  if (!unlocked(state, regionId)) return null;
  const pool = candidates(state, regionId);
  if (pool.length === 0) return null;
  const rand = mulberry32(hashString(`orders-week#${weekId}#${regionId}`));
  const c = pool[Math.floor(rand() * pool.length)];
  const gear = !!(ITEMS[c.item]?.equip || ITEMS[c.item]?.tool);
  const count = gear ? 4 + Math.floor(rand() * 3) : Math.max(WEEKLY_ORDER_SIZE, Math.round(c.perHour * WEEKLY_ORDER_SIZE * (0.25 + rand() * 0.5)));
  return makeOrder(c, regionId, `${regionId}-week-${c.item}`, count, WEEKLY_ORDER_XP_BONUS, weekId);
}

/**
 * Today's orders on a region's board (`dayId` is the player's local date, e.g. '2026-11-21').
 * With `weekId`, they never ask for the same item as this week's order.
 */
export function ordersFor(state: GameState, regionId: string, dayId: string, weekId?: string): VillageOrder[] {
  if (!unlocked(state, regionId)) return [];
  const weeklyItem = weekId ? weeklyOrderFor(state, regionId, weekId)?.item : undefined;
  const pool = candidates(state, regionId).filter((c) => c.item !== weeklyItem);
  const rand = mulberry32(hashString(`orders#${dayId}#${regionId}`));
  // Seeded shuffle, then the first few.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, ORDERS_PER_BOARD).map((c) => makeOrder(c, regionId, `${regionId}-${c.item}`, orderCount(c.item, c.perHour, rand), ORDER_XP_BONUS));
}

/** A daily order is marked filled for its day; a weekly one for its week, as `W<weekId>`. */
const filledKey = (dayId: string, order: string | VillageOrder) =>
  typeof order !== 'string' && order.weekId ? `W${order.weekId}:${order.id}` : `${dayId}:${typeof order === 'string' ? order : order.id}`;

export const orderFilled = (state: GameState, dayId: string, order: string | VillageOrder): boolean => !!state.ordersFilled[filledKey(dayId, order)];

/** The date six days before `dayId`: a weekly mark older than this belongs to a past week. */
function weekAgo(dayId: string): string {
  const [y, m, d] = dayId.split('-').map(Number);
  const t = new Date(y, m - 1, d - 6);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/**
 * Hands an order's items over from the bank and pays its XP to the skills. Takes the
 * order itself (as the board showed it), so a board that shifts after a level-up can't
 * strand a delivery already on its way. Older days' marks are dropped.
 */
export function fillOrder(state: GameState, order: VillageOrder, dayId: string, report: TripReport | null = null): GameState {
  if (orderFilled(state, dayId, order)) throw new Error('That order is already filled');
  if ((state.bank[order.item] ?? 0) < order.count) throw new Error("You don't have enough for that order");
  // Keep this day's marks and any later day's (a craft & deliver can land after midnight), and
  // this week's weekly marks; drop older ones.
  const keep = (k: string) => (k.startsWith('W') ? k.slice(1, 11) >= weekAgo(dayId) : k.slice(0, 10) >= dayId);
  const today = Object.fromEntries(Object.keys(state.ordersFilled).filter(keep).map((k) => [k, true as const]));
  const next: GameState = {
    ...state,
    xp: { ...state.xp },
    bank: { ...state.bank, [order.item]: state.bank[order.item] - order.count },
    ordersFilled: { ...today, [filledKey(dayId, order)]: true },
  };
  for (const [s, n] of Object.entries(order.xp) as [GameSkill, number][]) addRewardXP(next, report, s, n);
  if (order.combatLamp) next.lamps = [...next.lamps, { xp: order.combatLamp, kind: 'combat' }];
  return next;
}

/**
 * Craft & deliver (PROG-050): the work orders, innermost first, that make `count` of an
 * item from what the bank holds now (bars from ore, then gear from bars). Null when the
 * bank can't cover it, a step needs a level, quest or locked region the adventurer
 * lacks, or a step can burn (a burnt item would leave the order short).
 */
export function craftPlan(state: GameState, item: ItemId, count: number): LegPlan[] | null {
  const bank = { ...state.bank };
  const plan: LegPlan[] = [];
  const make = (want: ItemId, n: number, depth: number): boolean => {
    const use = Math.min(bank[want] ?? 0, n);
    bank[want] = (bank[want] ?? 0) - use;
    const short = n - use;
    if (short === 0) return true;
    if (depth > 4) return false;
    const m = makersOf(want).find((x) => x.kind === 'process' && levelOf(state, x.skill) >= x.level
      && (!x.quest || !!state.quests[x.quest]) && x.regions.some((r) => unlocked(state, r))
      && burnChance(x, levelOf(state, x.skill)) === 0);
    if (!m || m.kind !== 'process') return false;
    const actions = Math.ceil(short / (m.outputEach ?? 1));
    for (const [input, k] of Object.entries(m.inputs)) if (!make(input, actions * k, depth + 1)) return false;
    plan.push({ activityId: m.id, regionId: m.regions.find((r) => unlocked(state, r))!, hours: 0, count: actions });
    bank[want] = (bank[want] ?? 0) + actions * (m.outputEach ?? 1) - short;
    return true;
  };
  return make(item, count, 0) ? plan : null;
}

/** Craft & deliver as blocks for the queue: the craft plan, with the last block delivering the order. Null if it can't. */
export function craftAndDeliverPlan(state: GameState, order: VillageOrder, dayId: string): LegPlan[] | null {
  const plan = craftPlan(state, order.item, order.count);
  if (!plan || plan.length === 0) return null;
  plan[plan.length - 1] = { ...plan[plan.length - 1], deliver: { order, dayId } };
  return plan;
}
