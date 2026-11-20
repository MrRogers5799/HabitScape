import { earnFromHabit, untickHabit } from '../adventureTime';
import { AdventureTime } from '../types';

const fresh = (over: Partial<AdventureTime> = {}): AdventureTime => ({ bankHours: 0, weekId: 'W1', weekEarnedHours: 0, ...over });

describe('earnFromHabit (PROG-022)', () => {
  it('earns 1 hour per 50 XP', () => {
    const { time, grant } = earnFromHabit(fresh(), 200, 'W1');
    expect(grant).toEqual({ weekHours: 4, bankHours: 4 });
    expect(time.bankHours).toBe(4);
    expect(time.weekEarnedHours).toBe(4);
  });

  it('stops earning at the 84-hour weekly cap', () => {
    const { time, grant } = earnFromHabit(fresh({ weekEarnedHours: 82, bankHours: 10 }), 200, 'W1');
    expect(grant.weekHours).toBe(2);
    expect(time.weekEarnedHours).toBe(84);
    expect(earnFromHabit(time, 200, 'W1').grant.weekHours).toBe(0);
  });

  it('resets the weekly count when the week changes', () => {
    const { time, grant } = earnFromHabit(fresh({ weekEarnedHours: 84 }), 200, 'W2');
    expect(grant.weekHours).toBe(4);
    expect(time.weekId).toBe('W2');
    expect(time.weekEarnedHours).toBe(4);
  });

  it('spills hours past the 48-hour bank cap', () => {
    const { time, grant, spilledHours } = earnFromHabit(fresh({ bankHours: 46 }), 200, 'W1');
    expect(grant.bankHours).toBe(2);
    expect(spilledHours).toBe(2);
    expect(time.bankHours).toBe(48);
  });

  it('pays off debt first', () => {
    const { time } = earnFromHabit(fresh({ bankHours: -3 }), 200, 'W1');
    expect(time.bankHours).toBe(1);
  });
});

describe('untickHabit (PROG-025)', () => {
  it('takes back exactly what was granted, even into debt', () => {
    const earned = earnFromHabit(fresh(), 350, 'W1');
    const spent = { ...earned.time, bankHours: 0 };
    const after = untickHabit(spent, earned.grant, 'W1');
    expect(after.bankHours).toBe(-7);
    expect(after.weekEarnedHours).toBe(0);
  });

  it("doesn't touch this week's count for a grant from an earlier week", () => {
    const after = untickHabit(fresh({ weekId: 'W2', weekEarnedHours: 10, bankHours: 10 }), { weekHours: 4, bankHours: 4 }, 'W1');
    expect(after.weekEarnedHours).toBe(10);
    expect(after.bankHours).toBe(6);
  });
});
