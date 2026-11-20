import { adventureActive, adventureVisible } from '../constants/features';

describe('Adventure visibility (PROD-020)', () => {
  const g = globalThis as { __DEV__?: boolean };
  afterEach(() => { delete g.__DEV__; });

  describe('in a player (release) build', () => {
    beforeEach(() => { g.__DEV__ = false; });

    it('is hidden from ordinary players, even if they joined earlier', () => {
      expect(adventureVisible({})).toBe(false);
      expect(adventureVisible(null)).toBe(false);
      expect(adventureActive({ adventureBeta: true })).toBe(false);
    });

    it('shows for an account given access', () => {
      expect(adventureVisible({ adventureAccess: true })).toBe(true);
      expect(adventureActive({ adventureAccess: true })).toBe(false);
      expect(adventureActive({ adventureAccess: true, adventureBeta: true })).toBe(true);
    });
  });

  it('always shows in development builds', () => {
    g.__DEV__ = true;
    expect(adventureVisible({})).toBe(true);
    expect(adventureActive({ adventureBeta: true })).toBe(true);
  });
});
