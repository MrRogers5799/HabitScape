import { newAdventurer } from '../adventurer';
import { craftAndDeliverPlan, craftPlan, fillOrder, itemXPBySkill, itemXPValue, orderFilled, ordersFor } from '../orders';
import { advanceTrip, sendTrip } from '../trips';
import { XP_TABLE } from '../../constants/xpTable';
import { fromAdventurerDoc, toAdventurerDoc } from '../persistence';
import { GameState, VillageOrder } from '../types';

const adventurer = (bank: Record<string, number> = {}): GameState => {
  const s = newAdventurer('W');
  return { ...s, bank: { ...s.bank, ...bank } };
};

describe('village orders (PROG-044)', () => {
  it('puts the same three orders on a board for the same day', () => {
    const s = adventurer();
    const a = ordersFor(s, 'millbrook', '2026-11-21');
    expect(a).toHaveLength(3);
    expect(ordersFor(s, 'millbrook', '2026-11-21')).toEqual(a);
    expect(new Set(a.map((o) => o.item)).size).toBe(3);
    const days = ['2026-11-22', '2026-11-23', '2026-11-24'].map((d) => ordersFor(s, 'millbrook', d).map((o) => o.item).join());
    expect(days.some((d) => d !== a.map((o) => o.item).join())).toBe(true);
  });

  it('only asks for things the adventurer can make there now', () => {
    for (const day of ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25']) {
      for (const o of ordersFor(adventurer(), 'millbrook', day)) {
        expect(['iron_bar', 'steel_bar', 'trout', 'salmon', 'oak_logs']).not.toContain(o.item);
        expect(o.count).toBeGreaterThanOrEqual(1);
        expect(Object.values(o.xp).some((n) => (n ?? 0) > 0)).toBe(true);
      }
    }
  });

  it('asks for gear a few at a time, and nothing whose materials are out of reach', () => {
    const s = adventurer();
    s.xp = { ...s.xp, Smithing: 50000 };
    for (const day of ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']) {
      for (const o of ordersFor(s, 'millbrook', day)) {
        expect(o.item.startsWith('iron_') || o.item.startsWith('steel_')).toBe(false);
        if (o.item.startsWith('bronze_') && o.item !== 'bronze_bar') expect(o.count).toBeLessThanOrEqual(3);
      }
    }
  });

  it('has no board in a locked region', () => {
    expect(ordersFor(adventurer(), 'stonecrest', '2026-11-21')).toEqual([]);
  });

  it('values an item by the XP of its whole chain', () => {
    expect(itemXPValue('copper_ore')).toBe(10);
    expect(itemXPValue('bronze_bar')).toBe(6 + 10 + 10);
    expect(itemXPValue('bronze_helm')).toBe(24 + 2 * 26);
  });

  it('splits an order\'s XP over the skills that make the item (PROG-048)', () => {
    expect(itemXPBySkill('bronze_helm')).toEqual({ Smithing: 24 + 2 * 6, Mining: 2 * 20 });
  });

  it('takes the items, pays XP to the skills and marks the order filled', () => {
    const day = '2026-11-21';
    const [o] = ordersFor(adventurer(), 'millbrook', day);
    const s = adventurer({ [o.item]: o.count + 2 });
    s.ordersFilled = { '2026-11-20:old': true };
    const after = fillOrder(s, o, day);
    expect(after.bank[o.item]).toBe(2);
    expect(after.lamps).toEqual([]);
    for (const [skill, n] of Object.entries(o.xp)) expect(after.xp[skill as keyof typeof after.xp]).toBe((s.xp[skill as keyof typeof s.xp] ?? 0) + (n ?? 0));
    expect(orderFilled(after, day, o.id)).toBe(true);
    expect(after.ordersFilled['2026-11-20:old']).toBeUndefined();
    expect(() => fillOrder(after, o, day)).toThrow(/already/);
  });

  it("won't fill an order without enough items", () => {
    const [o] = ordersFor(adventurer(), 'millbrook', '2026-11-21');
    expect(() => fillOrder(adventurer({ [o.item]: 0 }), o, '2026-11-21')).toThrow(/enough/);
  });

  it('saves and loads filled orders, and older saves load with none', () => {
    const s = { ...adventurer(), ordersFilled: { '2026-11-21:millbrook-logs': true as const } };
    expect(fromAdventurerDoc(toAdventurerDoc(s, null, 3), 'W').state.ordersFilled).toEqual(s.ordersFilled);
    const old = toAdventurerDoc(adventurer(), null, 1) as unknown as Record<string, unknown>;
    delete old.ordersFilled;
    expect(fromAdventurerDoc(old, 'W').state.ordersFilled).toEqual({});
  });
});

describe('craft & deliver (PROG-050)', () => {
  const smith = (bank: Record<string, number>): GameState => {
    const s = adventurer(bank);
    return { ...s, xp: { ...s.xp, Smithing: XP_TABLE[20] }, time: { ...s.time, bankHours: 5 } };
  };
  const helmOrder: VillageOrder = { id: 'millbrook-bronze_helm', regionId: 'millbrook', item: 'bronze_helm', count: 1, xp: { Smithing: 54, Mining: 60 } };

  it('plans bars from ore, then the piece, from what the bank holds', () => {
    expect(craftPlan(smith({ copper_ore: 2, tin_ore: 2 }), 'bronze_helm', 1)).toEqual([
      { activityId: 'smelt-bronze', regionId: 'millbrook', hours: 0, count: 2 },
      { activityId: 'smith-bronze_helm', regionId: 'millbrook', hours: 0, count: 1 },
    ]);
    expect(craftPlan(smith({ bronze_bar: 1, copper_ore: 1, tin_ore: 1 }), 'bronze_helm', 1)).toHaveLength(2);
    expect(craftPlan(smith({ copper_ore: 1, tin_ore: 1 }), 'bronze_helm', 1)).toBeNull();
    // Cooking can burn, so it never plans it.
    expect(craftPlan(adventurer({ raw_shrimp: 50 }), 'shrimp', 10)).toBeNull();
  });

  it('makes the items and delivers the order when the last block finishes', () => {
    const s = smith({ copper_ore: 2, tin_ore: 2 });
    const plan = craftAndDeliverPlan(s, helmOrder, '2026-11-21')!;
    const sent = sendTrip(s, plan, 'cd-1', Date.UTC(2026, 10, 21, 8));
    const { state, report } = advanceTrip(sent.state, sent.trip, Date.UTC(2026, 10, 21, 9));
    expect(state.bank.bronze_helm ?? 0).toBe(0);
    expect(orderFilled(state, '2026-11-21', helmOrder.id)).toBe(true);
    expect(report.xp.Mining).toBe(60);
    expect(report.notes).toContain('Delivered 1 Bronze helm to the order board.');
  });

  it("keeps the items and says why when it can't deliver", () => {
    const s = { ...smith({ bronze_bar: 2 }), ordersFilled: { [`2026-11-21:${helmOrder.id}`]: true as const } };
    const plan = [{ activityId: 'smith-bronze_helm', regionId: 'millbrook', hours: 0, count: 1, deliver: { order: helmOrder, dayId: '2026-11-21' } }];
    const sent = sendTrip(s, plan, 'cd-2', Date.UTC(2026, 10, 21, 8));
    const { state, report } = advanceTrip(sent.state, sent.trip, Date.UTC(2026, 10, 21, 9));
    expect(state.bank.bronze_helm).toBe(1);
    expect(report.notes[0]).toMatch(/Couldn't deliver Bronze helm: that order is already filled/);
  });
});

describe('combat requests (PROG-050)', () => {
  it('asks for fight drops from creatures the adventurer beats, paying combat XP', () => {
    const s = adventurer({ bronze_sword: 1 });
    s.xp = { ...s.xp, Attack: XP_TABLE[20], Strength: XP_TABLE[20], Defence: XP_TABLE[20] };
    const days = Array.from({ length: 20 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`);
    const fights = days.flatMap((d) => ordersFor(s, 'millbrook', d)).filter((o) => o.creature);
    expect(fights.length).toBeGreaterThan(0);
    for (const o of fights) {
      expect(['bones', 'raw_chicken']).toContain(o.item);
      expect(o.xp.Hitpoints).toBeGreaterThan(0);
      expect(o.xp.Attack).toBe(o.xp.Strength);
    }
  });
});

