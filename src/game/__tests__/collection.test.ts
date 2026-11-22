import { unlocksBetween } from '../unlocks';
import { newAdventurer } from '../adventurer';
import { backfillCollection, collectionItems, collectionLog, collectionProgress } from '../collection';
import { ITEMS, SKILL_PETS } from '../content/valley';
import { fromAdventurerDoc, toAdventurerDoc } from '../persistence';
import { PET_XP } from '../rules';
import { GAME_SKILLS } from '../types';

describe('skilling pets (PROG-046)', () => {
  it('every skill has its own pet item', () => {
    const pets = GAME_SKILLS.map((s) => SKILL_PETS[s]);
    expect(new Set(pets).size).toBe(GAME_SKILLS.length);
    for (const p of pets) expect(ITEMS[p]?.name).toMatch(/\(pet\)$/);
  });

  it('rolls per XP: about 63% by the rate in XP, as a 1-in-N chance per point gives', () => {
    expect(1 - Math.exp(-PET_XP / PET_XP)).toBeCloseTo(0.632, 3);
    expect(PET_XP).toBe(5_000_000);
  });
});

describe('collection log (PROG-047)', () => {
  it('lists each boss with its uniques and pet, then the skilling pets', () => {
    const log = collectionLog();
    expect(log[0]).toEqual({ id: 'bog-warden', title: 'The Bog Warden', items: ['wardens_maul', 'bog_iron_helm', 'bogling'] });
    expect(log[log.length - 1].items).toHaveLength(GAME_SKILLS.length);
    expect(new Set(collectionItems()).size).toBe(collectionItems().length);
  });

  it('counts what has been found', () => {
    const s = { ...newAdventurer('W'), collection: { bogling: { atMs: 1, kc: 145 } } };
    expect(collectionProgress(s)).toEqual({ found: 1, total: collectionItems().length });
  });

  it('marks uniques already in the bank as found, date unknown', () => {
    expect(backfillCollection({ wardens_maul: 1, logs: 5 }, {})).toEqual({ wardens_maul: { atMs: 0 } });
    expect(backfillCollection({ wardens_maul: 1 }, { wardens_maul: { atMs: 9, kc: 20 } })).toEqual({ wardens_maul: { atMs: 9, kc: 20 } });
  });

  it('saves and loads, and older saves fill in from the bank', () => {
    const s = { ...newAdventurer('W'), collection: { pet_pebble: { atMs: 5, level: 72 } } };
    expect(fromAdventurerDoc(toAdventurerDoc(s, null, 1), 'W').state.collection).toEqual(s.collection);
    const old = toAdventurerDoc({ ...newAdventurer('W'), bank: { bogling: 1 } }, null, 1) as unknown as Record<string, unknown>;
    delete old.collection;
    expect(fromAdventurerDoc(old, 'W').state.collection).toEqual({ bogling: { atMs: 0 } });
  });
});

describe('skill unlocks (level-up notices)', () => {
  it('lists what a level range unlocks, from the content', () => {
    const titles = unlocksBetween('Mining', 14, 15).map((u) => u.title);
    expect(titles).toContain('Mine iron');
    expect(unlocksBetween('Mining', 15, 15)).toEqual([]);
  });
});
