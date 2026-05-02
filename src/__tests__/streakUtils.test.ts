import {
  computeCompletionStreakUpdate,
  computeUndoStreakUpdate,
  computeStreakResets,
  recomputeStreakFromHistory,
  toDateStr,
  getWeekMonday,
  getWeekStart,
} from '../utils/streakUtils';
import { UserActivity, ActivityCompletion } from '../types';

// ── test helpers ──────────────────────────────────────────────────────────────

/** Returns a Date at noon, N days before today. daysAgo(0) = today at noon. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Returns a Date at noon, N days before the Monday of the current week. */
function weeksAgo(n: number, dayOffset = 0): Date {
  const monday = getWeekMonday(new Date());
  const d = new Date(monday);
  d.setDate(d.getDate() - n * 7 + dayOffset);
  d.setHours(12, 0, 0, 0);
  return d;
}

let _completionId = 0;
function makeCompletion(
  activityId: string,
  date: Date,
  overrides: Partial<ActivityCompletion> = {}
): ActivityCompletion {
  return {
    id: `c-${++_completionId}`,
    activityId,
    skillId: 'Agility',
    completedAt: date,
    xpEarned: 50,
    ...overrides,
  };
}

function makeActivity(overrides: Partial<UserActivity> = {}): UserActivity {
  return {
    id: 'run',
    activityTemplateId: 'run',
    skillId: 'Agility',
    cadence: 'daily',
    cadenceMultiplier: 1,
    xpPerCompletion: 50,
    isActive: true,
    selectedAt: daysAgo(60),
    nextResetTime: daysAgo(0),
    currentStreak: 0,
    longestStreak: 0,
    ...overrides,
  };
}

// ── computeCompletionStreakUpdate ─────────────────────────────────────────────

describe('computeCompletionStreakUpdate', () => {
  describe('monthly cadence', () => {
    it('returns null', () => {
      const activity = makeActivity({ cadence: 'monthly' });
      expect(computeCompletionStreakUpdate(activity, [])).toBeNull();
    });
  });

  describe('daily cadence', () => {
    it('starts streak at 1 on first ever completion (no lastStreakCheckDate)', () => {
      const activity = makeActivity({ currentStreak: 0, longestStreak: 0 });
      const result = computeCompletionStreakUpdate(activity, []);
      expect(result?.currentStreak).toBe(1);
      expect(result?.longestStreak).toBe(1);
      expect(result?.lastStreakCheckDate).toBe(toDateStr(new Date()));
    });

    it('backfills from history on first run when prior completions exist', () => {
      const activity = makeActivity({ currentStreak: 0, longestStreak: 0 });
      // Yesterday and the day before were already logged
      const completions = [
        makeCompletion('run', daysAgo(2)),
        makeCompletion('run', daysAgo(1)),
      ];
      // Adding today's completion → should see 3-day run
      const result = computeCompletionStreakUpdate(activity, completions);
      expect(result?.currentStreak).toBe(3);
      expect(result?.longestStreak).toBe(3);
    });

    it('does not double-increment when already logged today', () => {
      const today = toDateStr(new Date());
      const activity = makeActivity({
        currentStreak: 5,
        longestStreak: 5,
        lastStreakCheckDate: today,
      });
      expect(computeCompletionStreakUpdate(activity, [])).toBeNull();
    });

    it('increments when last check was yesterday', () => {
      const yesterday = toDateStr(daysAgo(1));
      const activity = makeActivity({
        currentStreak: 4,
        longestStreak: 4,
        lastStreakCheckDate: yesterday,
      });
      const result = computeCompletionStreakUpdate(activity, []);
      expect(result?.currentStreak).toBe(5);
      expect(result?.longestStreak).toBe(5);
    });

    it('resets streak to 1 when there is a gap', () => {
      const twoDaysAgo = toDateStr(daysAgo(2));
      const activity = makeActivity({
        currentStreak: 10,
        longestStreak: 10,
        lastStreakCheckDate: twoDaysAgo,
      });
      const result = computeCompletionStreakUpdate(activity, []);
      expect(result?.currentStreak).toBe(1);
      expect(result?.longestStreak).toBe(10); // best preserved
    });

    it('updates longestStreak when current surpasses it', () => {
      const yesterday = toDateStr(daysAgo(1));
      const activity = makeActivity({
        currentStreak: 7,
        longestStreak: 7,
        lastStreakCheckDate: yesterday,
      });
      const result = computeCompletionStreakUpdate(activity, []);
      expect(result?.currentStreak).toBe(8);
      expect(result?.longestStreak).toBe(8);
    });
  });

  describe('non-daily cadence (2x/week)', () => {
    it('increments streak on each completion', () => {
      const activity = makeActivity({ cadence: '2x/week', currentStreak: 3, longestStreak: 3 });
      const result = computeCompletionStreakUpdate(activity, []);
      expect(result?.currentStreak).toBe(4);
      expect(result?.longestStreak).toBe(4);
    });
  });
});

// ── computeUndoStreakUpdate ───────────────────────────────────────────────────

describe('computeUndoStreakUpdate', () => {
  describe('monthly cadence', () => {
    it('returns null', () => {
      const activity = makeActivity({ cadence: 'monthly' });
      expect(computeUndoStreakUpdate(activity, [])).toBeNull();
    });
  });

  describe('daily cadence', () => {
    it('returns streak 0 and longest 0 when no completions remain', () => {
      const activity = makeActivity({ currentStreak: 1, longestStreak: 1 });
      const result = computeUndoStreakUpdate(activity, []);
      expect(result?.currentStreak).toBe(0);
      expect(result?.longestStreak).toBe(0);
    });

    it('returns streak 1 when only today remains after undo', () => {
      const activity = makeActivity({ currentStreak: 2, longestStreak: 2 });
      const remaining = [makeCompletion('run', daysAgo(0))];
      const result = computeUndoStreakUpdate(activity, remaining);
      expect(result?.currentStreak).toBe(1);
      expect(result?.longestStreak).toBe(1);
    });

    it('resets current streak to 0 when most recent remaining is older than yesterday', () => {
      const activity = makeActivity({ currentStreak: 3, longestStreak: 5 });
      const remaining = [makeCompletion('run', daysAgo(5))];
      const result = computeUndoStreakUpdate(activity, remaining);
      expect(result?.currentStreak).toBe(0);
      expect(result?.longestStreak).toBe(1); // one isolated completion = longest run of 1
    });

    it('correctly lowers longestStreak when the undone completion was its sole basis — the regression', () => {
      // Scenario: backfill yesterday → complete today → undo yesterday
      // After undo, only today remains. The best streak should be 1, not 2.
      const activity = makeActivity({ currentStreak: 2, longestStreak: 2 });
      const remaining = [makeCompletion('run', daysAgo(0))]; // only today
      const result = computeUndoStreakUpdate(activity, remaining);
      expect(result?.currentStreak).toBe(1);
      expect(result?.longestStreak).toBe(1); // was incorrectly staying at 2 before the fix
    });

    it('preserves a legitimate historical longestStreak after undo of recent completion', () => {
      // Had a 7-day run 2 weeks ago, then a 2-day run now; undo today → streak drops to 1
      // but longestStreak should remain 7
      const activity = makeActivity({ currentStreak: 2, longestStreak: 7 });
      const remaining = [
        // the old 7-day run (14–8 days ago)
        makeCompletion('run', daysAgo(14)),
        makeCompletion('run', daysAgo(13)),
        makeCompletion('run', daysAgo(12)),
        makeCompletion('run', daysAgo(11)),
        makeCompletion('run', daysAgo(10)),
        makeCompletion('run', daysAgo(9)),
        makeCompletion('run', daysAgo(8)),
        // yesterday is still present; today was undone
        makeCompletion('run', daysAgo(1)),
      ];
      const result = computeUndoStreakUpdate(activity, remaining);
      expect(result?.currentStreak).toBe(1); // only yesterday active
      expect(result?.longestStreak).toBe(7); // old 7-day run preserved
    });

    it('walks consecutive days correctly across a multi-day run', () => {
      const activity = makeActivity({ currentStreak: 4, longestStreak: 4 });
      // Undo 4 days ago; 3-day run (today, yesterday, 2 days ago) remains
      const remaining = [
        makeCompletion('run', daysAgo(0)),
        makeCompletion('run', daysAgo(1)),
        makeCompletion('run', daysAgo(2)),
      ];
      const result = computeUndoStreakUpdate(activity, remaining);
      expect(result?.currentStreak).toBe(3);
      expect(result?.longestStreak).toBe(3);
    });
  });

  describe('non-daily cadence (3x/week)', () => {
    it('recomputes current streak from remaining week completions', () => {
      const activity = makeActivity({
        cadence: '3x/week',
        currentStreak: 4,
        longestStreak: 4,
      });
      // 3 completions this week remain after undo
      const remaining = [
        makeCompletion('run', weeksAgo(0, 0)),
        makeCompletion('run', weeksAgo(0, 1)),
        makeCompletion('run', weeksAgo(0, 2)),
      ];
      const result = computeUndoStreakUpdate(activity, remaining);
      expect(result?.currentStreak).toBe(3); // 3 this week, no prior weeks
    });

    it('drops longestStreak when undo removes completions from the peak run', () => {
      const activity = makeActivity({
        cadence: '2x/week',
        currentStreak: 2,
        longestStreak: 6,
      });
      // Only 2 this week remain, no prior weeks → longest = 2
      const remaining = [
        makeCompletion('run', weeksAgo(0, 0)),
        makeCompletion('run', weeksAgo(0, 1)),
      ];
      const result = computeUndoStreakUpdate(activity, remaining);
      expect(result?.longestStreak).toBe(2);
    });
  });
});

// ── recomputeStreakFromHistory ─────────────────────────────────────────────────

describe('recomputeStreakFromHistory', () => {
  describe('monthly cadence', () => {
    it('returns null', () => {
      const activity = makeActivity({ cadence: 'monthly' });
      expect(recomputeStreakFromHistory(activity, [])).toBeNull();
    });
  });

  describe('daily cadence', () => {
    it('returns streak 0 and longest 0 when no completions', () => {
      const activity = makeActivity();
      const result = recomputeStreakFromHistory(activity, []);
      expect(result?.currentStreak).toBe(0);
      expect(result?.longestStreak).toBe(0);
    });

    it('returns streak 0 when only old (pre-yesterday) completions exist', () => {
      const activity = makeActivity();
      const completions = [makeCompletion('run', daysAgo(5))];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(0);
      expect(result?.longestStreak).toBe(1);
    });

    it('counts a consecutive run ending today', () => {
      const activity = makeActivity();
      const completions = [
        makeCompletion('run', daysAgo(2)),
        makeCompletion('run', daysAgo(1)),
        makeCompletion('run', daysAgo(0)),
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(3);
      expect(result?.longestStreak).toBe(3);
    });

    it('backfill bridges a gap: today + backfill yesterday → streak 2', () => {
      const activity = makeActivity({ currentStreak: 1, longestStreak: 1 });
      // Optimistically include the backfilled yesterday
      const completions = [
        makeCompletion('run', daysAgo(1)), // backfilled
        makeCompletion('run', daysAgo(0)), // today
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(2);
      expect(result?.longestStreak).toBe(2);
    });

    it('finds longest historical run even when current streak is 0', () => {
      // Best ever was 5 days two weeks ago; nothing recent
      const activity = makeActivity({ currentStreak: 0, longestStreak: 0 });
      const completions = [
        makeCompletion('run', daysAgo(18)),
        makeCompletion('run', daysAgo(17)),
        makeCompletion('run', daysAgo(16)),
        makeCompletion('run', daysAgo(15)),
        makeCompletion('run', daysAgo(14)),
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(0);
      expect(result?.longestStreak).toBe(5);
    });

    it('handles a gap in the middle: old run + recent run, picks larger', () => {
      // 3-day run last week, 2-day run ending today
      const activity = makeActivity();
      const completions = [
        makeCompletion('run', daysAgo(10)),
        makeCompletion('run', daysAgo(9)),
        makeCompletion('run', daysAgo(8)),
        // gap: days 7, 6, 5, 4, 3, 2 missing
        makeCompletion('run', daysAgo(1)),
        makeCompletion('run', daysAgo(0)),
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(2);
      expect(result?.longestStreak).toBe(3);
    });

    it('ignores duplicate completions on the same day', () => {
      const activity = makeActivity();
      const completions = [
        makeCompletion('run', daysAgo(1)),
        makeCompletion('run', daysAgo(1)), // duplicate
        makeCompletion('run', daysAgo(0)),
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(2);
      expect(result?.longestStreak).toBe(2);
    });

    it('only counts completions for the correct activity', () => {
      const activity = makeActivity({ id: 'run' });
      const completions = [
        makeCompletion('swim', daysAgo(0)), // different activity
        makeCompletion('run', daysAgo(1)),
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(1); // yesterday only, no today
      expect(result?.longestStreak).toBe(1);
    });
  });

  describe('non-daily cadence (2x/week)', () => {
    it('counts completions this week as current streak', () => {
      const activity = makeActivity({ cadence: '2x/week', currentStreak: 0, longestStreak: 0 });
      const completions = [
        makeCompletion('run', weeksAgo(0, 0)),
        makeCompletion('run', weeksAgo(0, 1)),
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(2);
    });

    it('includes prior weeks that met target in current streak', () => {
      const activity = makeActivity({ cadence: '2x/week', currentStreak: 0, longestStreak: 0 });
      const completions = [
        // last week: 2 completions (met target)
        makeCompletion('run', weeksAgo(1, 0)),
        makeCompletion('run', weeksAgo(1, 1)),
        // this week: 1 so far
        makeCompletion('run', weeksAgo(0, 0)),
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      expect(result?.currentStreak).toBe(3); // 2 last week + 1 this week
    });

    it('breaks streak on a missed week', () => {
      const activity = makeActivity({ cadence: '2x/week', currentStreak: 0, longestStreak: 0 });
      const completions = [
        // 2 weeks ago: 2 (met target)
        makeCompletion('run', weeksAgo(2, 0)),
        makeCompletion('run', weeksAgo(2, 1)),
        // last week: 1 (missed — needed 2)
        makeCompletion('run', weeksAgo(1, 0)),
        // this week: 2
        makeCompletion('run', weeksAgo(0, 0)),
        makeCompletion('run', weeksAgo(0, 1)),
      ];
      const result = recomputeStreakFromHistory(activity, completions);
      // Current streak: only this week (last week broke it)
      expect(result?.currentStreak).toBe(2);
    });
  });
});

// ── computeStreakResets ───────────────────────────────────────────────────────

describe('computeStreakResets', () => {
  it('skips monthly activities', () => {
    const activities = [makeActivity({ cadence: 'monthly', currentStreak: 5 })];
    const updates = computeStreakResets(activities, []);
    expect(updates).toHaveLength(0);
  });

  describe('daily cadence', () => {
    it('does nothing when last check was yesterday and streak is active', () => {
      const yesterday = toDateStr(daysAgo(1));
      const activities = [
        makeActivity({ currentStreak: 3, longestStreak: 3, lastStreakCheckDate: yesterday, streakVersion: 2 }),
      ];
      const updates = computeStreakResets(activities, []);
      expect(updates).toHaveLength(0);
    });

    it('does nothing when last check is today', () => {
      const today = toDateStr(daysAgo(0));
      const activities = [
        makeActivity({ currentStreak: 3, longestStreak: 3, lastStreakCheckDate: today, streakVersion: 2 }),
      ];
      const updates = computeStreakResets(activities, []);
      expect(updates).toHaveLength(0);
    });

    it('resets streak to 0 when last check was 2+ days ago', () => {
      const twoDaysAgo = toDateStr(daysAgo(2));
      const activities = [
        makeActivity({ currentStreak: 5, longestStreak: 10, lastStreakCheckDate: twoDaysAgo, streakVersion: 2 }),
      ];
      const updates = computeStreakResets(activities, []);
      expect(updates).toHaveLength(1);
      expect(updates[0].currentStreak).toBe(0);
      expect(updates[0].longestStreak).toBe(10); // preserved
    });

    it('does not reset when streak is already 0', () => {
      const twoDaysAgo = toDateStr(daysAgo(2));
      const activities = [
        makeActivity({ currentStreak: 0, longestStreak: 5, lastStreakCheckDate: twoDaysAgo, streakVersion: 2 }),
      ];
      // Streak is 0 — no reset needed
      const updates = computeStreakResets(activities, []);
      expect(updates).toHaveLength(0);
    });

    it('backfills streak from history when lastStreakCheckDate is unset', () => {
      const activities = [makeActivity({ currentStreak: 0, longestStreak: 0 })];
      const completions = [
        makeCompletion('run', daysAgo(2)),
        makeCompletion('run', daysAgo(1)),
        makeCompletion('run', daysAgo(0)),
      ];
      const updates = computeStreakResets(activities, completions);
      expect(updates).toHaveLength(1);
      expect(updates[0].currentStreak).toBe(3);
      expect(updates[0].longestStreak).toBe(3);
    });

    it('sets streak to 0 during backfill when most recent completion is old', () => {
      const activities = [makeActivity({ currentStreak: 0, longestStreak: 0 })];
      const completions = [makeCompletion('run', daysAgo(10))];
      const updates = computeStreakResets(activities, completions);
      expect(updates).toHaveLength(1);
      expect(updates[0].currentStreak).toBe(0);
    });
  });

  describe('non-daily cadence (3x/week)', () => {
    it('does nothing when already evaluated this week', () => {
      const thisMonday = toDateStr(getWeekMonday(new Date()));
      const activities = [
        makeActivity({
          cadence: '3x/week',
          currentStreak: 6,
          longestStreak: 6,
          lastStreakCheckWeek: thisMonday,
          streakVersion: 2,
        }),
      ];
      const updates = computeStreakResets(activities, []);
      expect(updates).toHaveLength(0);
    });

    it('resets streak when a full week was skipped', () => {
      // Last evaluated 2 weeks ago → streak broken
      const twoWeeksAgoMonday = toDateStr(weeksAgo(2, 0));
      const activities = [
        makeActivity({
          cadence: '3x/week',
          currentStreak: 9,
          longestStreak: 9,
          lastStreakCheckWeek: twoWeeksAgoMonday,
          streakVersion: 2,
        }),
      ];
      const updates = computeStreakResets(activities, []);
      expect(updates).toHaveLength(1);
      expect(updates[0].currentStreak).toBe(0);
    });

    it('resets streak when the just-ended week missed its target', () => {
      // Last evaluated was last week's Monday → evaluate last week now
      const lastMonday = toDateStr(weeksAgo(1, 0));
      const activities = [
        makeActivity({
          cadence: '3x/week',
          currentStreak: 6,
          longestStreak: 6,
          lastStreakCheckWeek: lastMonday,
          streakVersion: 2,
        }),
      ];
      // Only 2 completions last week (needed 3)
      const completions = [
        makeCompletion('run', weeksAgo(1, 0)),
        makeCompletion('run', weeksAgo(1, 1)),
      ];
      const updates = computeStreakResets(activities, completions);
      expect(updates).toHaveLength(1);
      expect(updates[0].currentStreak).toBe(0);
    });

    it('keeps streak when the just-ended week met its target', () => {
      const lastMonday = toDateStr(weeksAgo(1, 0));
      const activities = [
        makeActivity({
          cadence: '3x/week',
          currentStreak: 6,
          longestStreak: 6,
          lastStreakCheckWeek: lastMonday,
          streakVersion: 2,
        }),
      ];
      // 3 completions last week (target met)
      const completions = [
        makeCompletion('run', weeksAgo(1, 0)),
        makeCompletion('run', weeksAgo(1, 1)),
        makeCompletion('run', weeksAgo(1, 2)),
      ];
      const updates = computeStreakResets(activities, completions);
      expect(updates).toHaveLength(1);
      expect(updates[0].currentStreak).toBe(6); // unchanged
    });
  });
});

// ── getWeekStart ──────────────────────────────────────────────────────────────

describe('getWeekStart', () => {
  // Use a fixed Wednesday to make assertions unambiguous
  const wednesday = new Date('2026-04-29T12:00:00'); // Wednesday

  it('Monday start: returns the Monday of the given week', () => {
    const result = getWeekStart(wednesday, 1);
    expect(toDateStr(result)).toBe('2026-04-27'); // Monday
  });

  it('Sunday start: returns the Sunday of the given week', () => {
    const result = getWeekStart(wednesday, 0);
    expect(toDateStr(result)).toBe('2026-04-26'); // Sunday
  });

  it('Monday start: Sunday input rolls back 6 days to the previous Monday', () => {
    const sunday = new Date('2026-04-26T12:00:00');
    expect(toDateStr(getWeekStart(sunday, 1))).toBe('2026-04-20');
  });

  it('Sunday start: Sunday input stays on that Sunday', () => {
    const sunday = new Date('2026-04-26T12:00:00');
    expect(toDateStr(getWeekStart(sunday, 0))).toBe('2026-04-26');
  });

  it('Monday start: Monday input stays on that Monday', () => {
    const monday = new Date('2026-04-27T12:00:00');
    expect(toDateStr(getWeekStart(monday, 1))).toBe('2026-04-27');
  });

  it('Sunday start: Saturday input rolls back 6 days to the previous Sunday', () => {
    const saturday = new Date('2026-05-02T12:00:00');
    expect(toDateStr(getWeekStart(saturday, 0))).toBe('2026-04-26');
  });

  it('defaults to Monday when weekStartDay is omitted', () => {
    expect(toDateStr(getWeekStart(wednesday))).toBe(toDateStr(getWeekStart(wednesday, 1)));
  });
});

// ── computeStreakResets — weekStartDay ────────────────────────────────────────

describe('computeStreakResets with weekStartDay', () => {
  // Pin "today" to Wednesday 2026-04-29 by using weeksAgo relative to Monday 2026-04-27
  // so closed weeks are well-defined regardless of when the test runs.
  // We use absolute dates to avoid sensitivity to the real current date.

  function makeSundayWeeksAgo(n: number, dayOffset = 0): Date {
    // Current Sunday-based week start (most recent Sunday)
    const now = new Date();
    const thisSunday = getWeekStart(now, 0);
    const d = new Date(thisSunday);
    d.setDate(d.getDate() - n * 7 + dayOffset);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  it('Monday start: marks streak reset when previous Mon-Sun week was missed', () => {
    const activity = makeActivity({
      cadence: '3x/week',
      currentStreak: 3,
      lastStreakCheckWeek: toDateStr(getWeekStart(new Date(), 1)), // not yet this week
    });
    // Override lastStreakCheckWeek to last Monday so we evaluate the completed week
    const lastMonday = getWeekStart(new Date(), 1);
    const prevMonday = new Date(lastMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    activity.lastStreakCheckWeek = toDateStr(prevMonday);

    // Only 1 completion in that week — misses the 3x target
    const completions = [makeCompletion('run', new Date(prevMonday.getTime() + 86400000))];
    const updates = computeStreakResets([activity], completions, 1);
    expect(updates[0].currentStreak).toBe(0);
  });

  it('Sunday start: marks streak reset when previous Sun-Sat week was missed', () => {
    const activity = makeActivity({
      cadence: '3x/week',
      currentStreak: 3,
    });
    const thisSunday = getWeekStart(new Date(), 0);
    const prevSunday = new Date(thisSunday);
    prevSunday.setDate(prevSunday.getDate() - 7);
    activity.lastStreakCheckWeek = toDateStr(prevSunday);

    // Only 1 completion in that Sun-Sat week
    const completions = [makeCompletion('run', new Date(prevSunday.getTime() + 86400000))];
    const updates = computeStreakResets([activity], completions, 0);
    expect(updates[0].currentStreak).toBe(0);
  });

  it('Sunday start: does NOT reset when previous Sun-Sat week met the target', () => {
    const activity = makeActivity({
      cadence: '3x/week',
      currentStreak: 9,
      streakVersion: 2, // must be set to bypass the migration/backfill path
    });
    const thisSunday = getWeekStart(new Date(), 0);
    const prevSunday = new Date(thisSunday);
    prevSunday.setDate(prevSunday.getDate() - 7);
    activity.lastStreakCheckWeek = toDateStr(prevSunday);

    // 3 completions on Mon, Tue, Wed of that week
    const completions = [
      makeCompletion('run', new Date(prevSunday.getTime() + 1 * 86400000)),
      makeCompletion('run', new Date(prevSunday.getTime() + 2 * 86400000)),
      makeCompletion('run', new Date(prevSunday.getTime() + 3 * 86400000)),
    ];
    const updates = computeStreakResets([activity], completions, 0);
    expect(updates[0].currentStreak).toBe(9); // unchanged
  });

  it('Sunday vs Monday start produce different week boundaries for the same date', () => {
    // A completion on Sunday 2026-04-26 at noon
    const sundayCompletion = new Date('2026-04-26T12:00:00');
    // With Monday start: Apr 26 (Sun) belongs to the PREVIOUS week (Mon Apr 20 – Sun Apr 26)
    expect(toDateStr(getWeekStart(sundayCompletion, 1))).toBe('2026-04-20');
    // With Sunday start: Apr 26 (Sun) is the START of a new week
    expect(toDateStr(getWeekStart(sundayCompletion, 0))).toBe('2026-04-26');
  });
});
