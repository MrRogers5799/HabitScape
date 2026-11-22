import { newAdventurer } from '../adventurer';
import { fillOrder, itemXPValue, orderFilled, ordersFor } from '../orders';
import { fromAdventurerDoc, toAdventurerDoc } from '../persistence';
import { GameState } from '../types';

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
        expect(o.lampXP).toBeGreaterThan(0);
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

  it('takes the items, pays a lamp and marks the order filled', () => {
    const day = '2026-11-21';
    const [o] = ordersFor(adventurer(), 'millbrook', day);
    const s = adventurer({ [o.item]: o.count + 2 });
    s.ordersFilled = { '2026-11-20:old': true };
    const after = fillOrder(s, 'millbrook', o.id, day);
    expect(after.bank[o.item]).toBe(2);
    expect(after.lamps).toEqual([o.lampXP]);
    expect(orderFilled(after, day, o.id)).toBe(true);
    expect(after.ordersFilled['2026-11-20:old']).toBeUndefined();
    expect(() => fillOrder(after, 'millbrook', o.id, day)).toThrow(/already/);
  });

  it("won't fill an order without enough items", () => {
    const [o] = ordersFor(adventurer(), 'millbrook', '2026-11-21');
    expect(() => fillOrder(adventurer({ [o.item]: 0 }), 'millbrook', o.id, '2026-11-21')).toThrow(/enough/);
  });

  it('saves and loads filled orders, and older saves load with none', () => {
    const s = { ...adventurer(), ordersFilled: { '2026-11-21:millbrook-logs': true as const } };
    expect(fromAdventurerDoc(toAdventurerDoc(s, null, 3), 'W').state.ordersFilled).toEqual(s.ordersFilled);
    const old = toAdventurerDoc(adventurer(), null, 1) as unknown as Record<string, unknown>;
    delete old.ordersFilled;
    expect(fromAdventurerDoc(old, 'W').state.ordersFilled).toEqual({});
  });
});
