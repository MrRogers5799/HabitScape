import { newAdventurer } from '../adventurer';
import { CHUNK_MS } from '../rules';
import { advanceTrip, emptyReport, sendTrip } from '../trips';
import {
  fromAdventurerDoc, fromTripDoc, GAME_SCHEMA_VERSION, mergeReports, toAdventurerDoc, toTripDoc, weekIdFor,
} from '../persistence';

const T0 = Date.UTC(2026, 10, 19, 8, 0);

describe('adventurer documents', () => {
  it('round-trips a game state', () => {
    const s = newAdventurer('2026-11-16');
    s.xp.Mining = 1234;
    s.bank.copper_ore = 50;
    s.quests['supper-for-the-smith'] = true;
    s.kills.goblin = 7;
    s.lamps.push(500);
    const doc = toAdventurerDoc(s, 'trip-1', 3);
    expect(doc.schemaVersion).toBe(GAME_SCHEMA_VERSION);
    expect(doc.rev).toBe(3);
    const back = fromAdventurerDoc(JSON.parse(JSON.stringify(doc)), '2026-11-16');
    expect(back.state).toEqual(s);
    expect(back.activeTripId).toBe('trip-1');
    expect(back.rev).toBe(3);
  });

  it('leaves zero counts out of the stored bank', () => {
    const s = newAdventurer('W');
    s.bank.coal = 0;
    expect('coal' in toAdventurerDoc(s, null, 0).bank).toBe(false);
  });

  it('fills missing fields with defaults so older documents still load', () => {
    const { state, activeTripId, rev } = fromAdventurerDoc({ xp: { Mining: 100 } }, '2026-11-16');
    expect(state.xp.Mining).toBe(100);
    expect(state.xp.Hitpoints).toBe(newAdventurer('x').xp.Hitpoints);
    expect(state.time).toEqual({ bankHours: 0, weekId: '2026-11-16', weekEarnedHours: 0 });
    expect(state.kills).toEqual({});
    expect(activeTripId).toBeNull();
    expect(rev).toBe(0);
  });

  it('ignores junk values', () => {
    const { state } = fromAdventurerDoc({ xp: { Mining: 'lots' }, bank: { coal: 'x', iron_ore: 4 }, lamps: [500, 'no'] }, 'W');
    expect(state.xp.Mining).toBe(0);
    expect(state.bank).toEqual({ iron_ore: 4 });
    expect(state.lamps).toEqual([500]);
  });
});

describe('trip documents', () => {
  it('round-trips a trip and its running report', () => {
    const s = newAdventurer('W');
    s.time.bankHours = 10;
    const sent = sendTrip(s, [{ activityId: 'mine-copper', regionId: 'millbrook', hours: 2 }], 'trip-9', T0);
    const step = advanceTrip(sent.state, sent.trip, T0 + 2 * CHUNK_MS);
    const doc = toTripDoc(step.trip, step.report);
    const back = fromTripDoc('trip-9', JSON.parse(JSON.stringify(doc)));
    expect(back.trip).toEqual(step.trip);
    expect(back.report).toEqual(step.report);
    expect(back.seenMs).toBeNull();
  });

  it('adds reports together across visits', () => {
    const a = { ...emptyReport(), gained: { coal: 3 }, xp: { Mining: 100 }, found: ['x'] };
    const b = { ...emptyReport(), gained: { coal: 2, iron_ore: 1 }, xp: { Mining: 50 }, refundedHours: 0.5 };
    const m = mergeReports(a, b);
    expect(m.gained).toEqual({ coal: 5, iron_ore: 1 });
    expect(m.xp).toEqual({ Mining: 150 });
    expect(m.found).toEqual(['x']);
    expect(m.refundedHours).toBe(0.5);
  });
});

describe('weekIdFor (PROG-006)', () => {
  it('names the week by the date it started, for either week start', () => {
    const thu = new Date(2026, 10, 19, 15, 0).getTime(); // Thursday 19 Nov 2026, local time
    expect(weekIdFor(thu, 1)).toBe('2026-11-16'); // Monday start
    expect(weekIdFor(thu, 0)).toBe('2026-11-15'); // Sunday start
    const sun = new Date(2026, 10, 22, 9, 0).getTime();
    expect(weekIdFor(sun, 1)).toBe('2026-11-16');
    expect(weekIdFor(sun, 0)).toBe('2026-11-22');
  });
});
