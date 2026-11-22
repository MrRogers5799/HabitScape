import { activitiesIn, fightId, REGIONS } from '../../../game';
import { bannerKey, BANNERS } from '../banners';

describe('Planner banners (PROD-038)', () => {
  it('has a painted banner for every activity in every region', () => {
    const missing: string[] = [];
    for (const r of Object.keys(REGIONS)) {
      const { methods, recipes, melts, fights } = activitiesIn(r);
      const ids = [...methods, ...recipes, ...melts].map((m) => m.id).concat(fights.map((c) => fightId(c.id)));
      for (const id of ids) {
        const key = bannerKey(id, r);
        if (!BANNERS[key]) missing.push(`${r}/${id} -> ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has the camp and road banners', () => {
    expect(BANNERS.camp).toBeTruthy();
    expect(BANNERS.road).toBeTruthy();
  });
});
