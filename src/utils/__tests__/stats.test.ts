import { getTotalLevel, getTotalXP } from '../stats';

const ROSTER = ['Attack', 'Magic', 'Hunter'];

describe('getTotalLevel', () => {
  it('counts every roster skill, missing ones as level 1', () => {
    expect(getTotalLevel([], ROSTER)).toBe(3);
  });

  it('adds trained levels on top (the Profile/Skills mismatch case)', () => {
    // 165 XP in Magic is level 2; everything else level 1.
    expect(getTotalLevel([{ skillName: 'Magic', totalXP: 165 }], ROSTER)).toBe(4);
  });

  it('ignores skills that are not in the roster', () => {
    expect(getTotalLevel([{ skillName: 'Woodworking', totalXP: 5000 }], ROSTER)).toBe(3);
  });
});

describe('getTotalXP', () => {
  it('sums XP and tolerates missing values', () => {
    expect(getTotalXP([{ skillName: 'A', totalXP: 80 }, { skillName: 'B', totalXP: 165 }])).toBe(245);
  });
});
