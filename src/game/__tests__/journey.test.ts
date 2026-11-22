import { newAdventurer } from '../adventurer';
import { claimJourneyStep, currentJourneyStep, JOURNEY, markWelcomed } from '../journey';
import { fromAdventurerDoc, toAdventurerDoc } from '../persistence';
import { GameState } from '../types';

const idle = { queued: false };
const fresh = (): GameState => newAdventurer('W');

describe('the road to the Bog Warden (PROD-032)', () => {
  it('has nine steps, ending at the Warden', () => {
    expect(JOURNEY).toHaveLength(9);
    expect(JOURNEY[JOURNEY.length - 1].id).toBe('bog-warden');
  });

  it('starts at the first habit, not done yet', () => {
    expect(currentJourneyStep(fresh(), idle)).toMatchObject({ index: 0, done: false, step: { id: 'first-habit' } });
  });

  it('collects a done step for its reward, then moves on', () => {
    const s: GameState = { ...fresh(), time: { ...fresh().time, bankHours: 4, weekEarnedHours: 4 } };
    expect(currentJourneyStep(s, idle)?.done).toBe(true);
    const after = claimJourneyStep(s, 'first-habit', idle);
    expect(after.bank.copper_ore).toBe(10);
    expect(after.bank.tin_ore).toBe(10);
    expect(currentJourneyStep(after, idle)?.step.id).toBe('first-block');
    expect(currentJourneyStep(after, { queued: true })?.done).toBe(true);
  });

  it("won't collect a step that isn't done or isn't the current one", () => {
    expect(() => claimJourneyStep(fresh(), 'first-habit', idle)).toThrow(/not done/);
    expect(() => claimJourneyStep(fresh(), 'goblins', idle)).toThrow(/not the current/);
  });

  it('can be walked to the end, each step when its condition holds', () => {
    let s: GameState = { ...fresh(), time: { ...fresh().time, bankHours: 4 } };
    const ctx = { queued: true };
    const setUp: Record<string, (g: GameState) => GameState> = {
      'bronze-weapon': (g) => ({ ...g, bank: { ...g.bank, bronze_sword: 1 } }),
      goblins: (g) => ({ ...g, kills: { ...g.kills, goblin: 10 } }),
      'road-to-stonecrest': (g) => ({ ...g, quests: { ...g.quests, 'road-to-stonecrest': true } }),
      'iron-armour': (g) => ({ ...g, bank: { ...g.bank, iron_helm: 1 } }),
      'drowned-bell': (g) => ({ ...g, quests: { ...g.quests, 'drowned-bell': true } }),
      'steel-and-salmon': (g) => ({ ...g, bank: { ...g.bank, steel_platelegs: 1, salmon: 5 } }),
      'bog-warden': (g) => ({ ...g, kills: { ...g.kills, 'bog-warden': 1 } }),
    };
    for (const step of JOURNEY) {
      if (setUp[step.id]) s = setUp[step.id](s);
      expect(currentJourneyStep(s, ctx)?.step.id).toBe(step.id);
      s = claimJourneyStep(s, step.id, ctx);
    }
    expect(currentJourneyStep(s, ctx)).toBeNull();
    expect(s.bank.salmon).toBe(25);
  });

  it('an iron weapon alone is not iron armour', () => {
    const s = { ...fresh(), bank: { iron_sword: 1 } };
    expect(JOURNEY.find((j) => j.id === 'iron-armour')!.done(s, idle)).toBe(false);
  });

  it('saves and loads, and older saves start the road fresh', () => {
    const s = markWelcomed({ ...fresh(), journey: { claimed: { 'first-habit': true }, welcomed: false } });
    expect(fromAdventurerDoc(toAdventurerDoc(s, null, 1), 'W').state.journey).toEqual({ claimed: { 'first-habit': true }, welcomed: true });
    const old = toAdventurerDoc(fresh(), null, 1) as unknown as Record<string, unknown>;
    delete old.journey;
    expect(fromAdventurerDoc(old, 'W').state.journey).toEqual({ claimed: {}, welcomed: false });
  });
});
