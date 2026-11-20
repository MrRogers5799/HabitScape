import { newAdventurer } from '../adventurer';
import { previewPlan } from '../preview';
import { fightId } from '../trips';
import { GameState } from '../types';

const adventurer = (bank: Record<string, number> = {}): GameState => {
  const s = newAdventurer('W');
  return { ...s, bank: { ...s.bank, ...bank }, time: { ...s.time, bankHours: 24 } };
};

describe('previewPlan', () => {
  it('previews a gathering leg from its rate', () => {
    const p = previewPlan(adventurer(), [{ activityId: 'mine-copper', regionId: 'millbrook', hours: 2 }]);
    const leg = p.legs[0].preview!;
    expect(leg.kind).toBe('method');
    if (leg.kind !== 'method') return;
    expect(leg.count).toBe(140);
    expect(leg.xp).toBe(1400);
    expect(p.totalHours).toBe(2);
  });

  it('carries expected output into the next leg and warns when materials run out', () => {
    const p = previewPlan(adventurer(), [
      { activityId: 'mine-copper', regionId: 'millbrook', hours: 1 },
      { activityId: 'mine-tin', regionId: 'millbrook', hours: 1 },
      { activityId: 'smelt-bronze', regionId: 'millbrook', hours: 2 },
    ]);
    const smelt = p.legs[2].preview!;
    if (smelt.kind !== 'method') throw new Error('expected method');
    expect(smelt.count).toBe(70);
    expect(smelt.uses).toEqual({ copper_ore: 70, tin_ore: 70 });
    expect(smelt.runsOutAfterHours).toBe(1);
  });

  it('previews a fight with win chance, kills and the picked loadout', () => {
    const p = previewPlan(adventurer(), [{ activityId: fightId('goblin'), regionId: 'millbrook', hours: 1 }]);
    const f = p.legs[0].preview!;
    if (f.kind !== 'fight') throw new Error('expected fight');
    expect(f.winChance).toBeGreaterThan(0.9);
    expect(f.loadout.mainHand).toBe('bronze_dagger');
    expect(f.hitsWeakness).toBe(true);
    expect(f.styleXP).toBe(Math.round(f.kills * 40));
  });

  it('lists quest requirements and whether each is met', () => {
    const p = previewPlan(adventurer({ shrimp: 3 }), [{ activityId: 'quest-supper-for-the-smith', regionId: 'millbrook', hours: 1 }]);
    const q = p.legs[0].preview!;
    if (q.kind !== 'quest') throw new Error('expected quest');
    expect(q.requirements.map((r) => r.met)).toEqual([false, false]);
    expect(p.legs[0].problem).toBe('quest-requirements');
  });
});
