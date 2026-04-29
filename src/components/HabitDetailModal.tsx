import React, { useMemo, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import { UserActivity, ActivityCompletion } from '../types';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { SKILL_COLORS } from '../constants/osrsSkills';
import { CADENCE_CONFIG } from '../constants/cadences';
import { formatXP } from '../utils/xpCalculations';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

interface HabitDetailModalProps {
  activity: UserActivity | null;
  completions: ActivityCompletion[];
  onClose: () => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateTime(date: Date): string {
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart}  ·  ${timePart}`;
}

// Monday of the week containing `date`
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sun
  const diff = dow === 0 ? -6 : -(dow - 1);
  d.setDate(d.getDate() + diff);
  return d;
}

// ─── completion rate ──────────────────────────────────────────────────────────

function calculateCompletionRate(
  completions: ActivityCompletion[],
  activityId: string,
  cadence: string,
  timesPerWeek: number,
  selectedAt: Date | undefined,
): number | null {
  const ac = completions.filter(c => c.activityId === activityId);
  if (ac.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(selectedAt ?? new Date(ac[ac.length - 1].completedAt));
  start.setHours(0, 0, 0, 0);

  if (cadence === 'daily') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (start > yesterday) return null;
    const totalDays = Math.max(1, Math.round((yesterday.getTime() - start.getTime()) / 86_400_000) + 1);
    const doneDays = new Set(ac.map(c => localDateKey(new Date(c.completedAt)))).size;
    return Math.round(Math.min(doneDays / totalDays, 1) * 100);
  }

  if (cadence === 'monthly') {
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (startMonth >= thisMonth) return null;
    let hit = 0, total = 0;
    const m = new Date(startMonth);
    while (m < thisMonth) {
      total++;
      const inMonth = ac.filter(c => {
        const d = new Date(c.completedAt);
        return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
      });
      if (inMonth.length >= 1) hit++;
      m.setMonth(m.getMonth() + 1);
    }
    return total === 0 ? null : Math.round((hit / total) * 100);
  }

  // Nx/week + weekly — evaluate closed Mon-Sun weeks
  const firstMonday = getWeekMonday(start);
  const thisMonday = getWeekMonday(today);
  if (firstMonday >= thisMonday) return null;

  let hit = 0, total = 0;
  const weekStart = new Date(firstMonday);
  while (weekStart < thisMonday) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const uniqueDays = new Set(
      ac
        .filter(c => { const d = new Date(c.completedAt); d.setHours(0,0,0,0); return d >= weekStart && d < weekEnd; })
        .map(c => localDateKey(new Date(c.completedAt)))
    ).size;
    total++;
    if (uniqueDays >= timesPerWeek) hit++;
    weekStart.setDate(weekStart.getDate() + 7);
  }
  return total === 0 ? null : Math.round((hit / total) * 100);
}

// ─── calendar ────────────────────────────────────────────────────────────────

interface CalendarDay {
  date: Date | null;
  completed: boolean;
  isToday: boolean;
  isFuture: boolean;
  isMissed: boolean;
}

function buildMonthCalendar(
  year: number,
  month: number,
  completions: ActivityCompletion[],
  activityId: string,
  cadence: string,
  timesPerWeek: number,
): CalendarDay[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedDates = new Set<string>();
  completions.forEach(c => {
    if (c.activityId !== activityId) return;
    completedDates.add(localDateKey(new Date(c.completedAt)));
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();

  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  for (let i = 0; i < startDow; i++) {
    currentWeek.push({ date: null, completed: false, isToday: false, isFuture: false, isMissed: false });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    currentWeek.push({
      date,
      completed: completedDates.has(localDateKey(date)),
      isToday: date.getTime() === today.getTime(),
      isFuture: date > today,
      isMissed: false,
    });
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: null, completed: false, isToday: false, isFuture: false, isMissed: false });
    }
    weeks.push(currentWeek);
  }

  // ── Post-process: mark missed days based on cadence ──
  if (cadence === 'daily') {
    for (const week of weeks) {
      for (const day of week) {
        if (day.date && !day.completed && !day.isFuture && !day.isToday) {
          day.isMissed = true;
        }
      }
    }
  } else if (cadence === 'monthly') {
    // Whole month missed if it has closed with 0 completions
    const monthClosed = today > new Date(year, month + 1, 0);
    if (monthClosed) {
      const monthHits = completions.filter(c => {
        if (c.activityId !== activityId) return false;
        const d = new Date(c.completedAt);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length;
      if (monthHits === 0) {
        for (const week of weeks) {
          for (const day of week) {
            if (day.date && !day.completed && !day.isFuture && !day.isToday) {
              day.isMissed = true;
            }
          }
        }
      }
    }
  } else {
    // Nx/week + weekly: evaluate each visual (Sun-Sat) calendar week
    for (const week of weeks) {
      const realDays = week.filter(d => d.date !== null);
      if (realDays.length === 0) continue;
      const allPast = realDays.every(d => !d.isFuture && !d.isToday);
      if (!allPast) continue; // week still in progress — never mark missed
      const hits = realDays.filter(d => d.completed).length;
      if (hits < timesPerWeek) {
        for (const day of week) {
          if (day.date && !day.completed) day.isMissed = true;
        }
      }
    }
  }

  return weeks;
}

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAY_LABELS = ['S','M','T','W','T','F','S'];
const SPARKLINE_WEEKS = 7;
const BAR_MAX_HEIGHT = 44;

// ─── component ───────────────────────────────────────────────────────────────

export function HabitDetailModal({ activity, completions, onClose }: HabitDetailModalProps) {
  if (!activity) return null;

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const template = ACTIVITY_TEMPLATES.find(t => t.id === activity.id);
  const activityName = template?.activityName ?? activity.id;
  const cadenceConfig = CADENCE_CONFIG[activity.cadence];
  const cadenceLabel = cadenceConfig?.label ?? activity.cadence;
  const timesPerWeek = cadenceConfig?.timesPerWeek ?? 1;

  const activityCompletions = useMemo(
    () => completions.filter(c => c.activityId === activity.id),
    [completions, activity.id]
  );

  const totalXP = useMemo(
    () => activityCompletions.reduce((sum, c) => sum + c.xpEarned, 0),
    [activityCompletions]
  );

  const completionRate = useMemo(
    () => calculateCompletionRate(completions, activity.id, activity.cadence, timesPerWeek, activity.selectedAt),
    [completions, activity.id, activity.cadence, timesPerWeek, activity.selectedAt]
  );

  // Weekly XP for sparkline — 7 most recent Mon-Sun weeks
  const weeklyXP = useMemo(() => {
    const thisMonday = getWeekMonday(now);
    return Array.from({ length: SPARKLINE_WEEKS }, (_, i) => {
      const weekStart = new Date(thisMonday);
      weekStart.setDate(weekStart.getDate() - (SPARKLINE_WEEKS - 1 - i) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const xp = activityCompletions
        .filter(c => { const d = new Date(c.completedAt); d.setHours(0,0,0,0); return d >= weekStart && d < weekEnd; })
        .reduce((sum, c) => sum + c.xpEarned, 0);
      const label = i === SPARKLINE_WEEKS - 1
        ? 'NOW'
        : `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      return { label, xp };
    });
  }, [activityCompletions]);

  const sparklineMax = useMemo(
    () => Math.max(...weeklyXP.map(w => w.xp), 1),
    [weeklyXP]
  );

  const calendarWeeks = useMemo(
    () => buildMonthCalendar(calYear, calMonth, completions, activity.id, activity.cadence, timesPerWeek),
    [calYear, calMonth, completions, activity.id, activity.cadence, timesPerWeek]
  );

  const currentStreak = activity.currentStreak ?? 0;
  const longestStreak = activity.longestStreak ?? 0;
  const isAtCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (isAtCurrentMonth) return;
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const sections = useMemo(
    () => [{ title: '', data: activityCompletions }],
    [activityCompletions]
  );

  return (
    <Modal
      visible={!!activity}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.activityName}>{activityName}</Text>
            <View style={styles.activityMeta}>
              {(() => {
                const c = SKILL_COLORS[activity.skillId] ?? '#888888';
                return (
                  <View style={[styles.skillBadge, { backgroundColor: `${c}22`, borderColor: `${c}88` }]}>
                    <Text style={[styles.skillBadgeText, { color: c }]}>{activity.skillId}</Text>
                  </View>
                );
              })()}
              <Text style={styles.cadenceLabel}>{cadenceLabel}</Text>
            </View>
            {template?.description && (
              <Text style={styles.activityDescription}>{template.description}</Text>
            )}
            {activity.selectedAt && (
              <Text style={styles.trainingSince}>
                Training since {new Date(activity.selectedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={() => null}
          renderItem={({ item }) => (
            <View style={styles.completionRow}>
              <Text style={styles.completionDateTime}>
                {formatDateTime(new Date(item.completedAt))}
              </Text>
              <Text style={styles.completionXP}>+{item.xpEarned} XP</Text>
            </View>
          )}
          ListHeaderComponent={
            <>
              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  {currentStreak > 0 ? (
                    <View style={styles.streakDisplay}>
                      <Text style={styles.streakEmoji}>🔥</Text>
                      <Text style={styles.statValueGold}>{currentStreak}</Text>
                    </View>
                  ) : (
                    <Text style={styles.statValue}>—</Text>
                  )}
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
                <View style={[styles.statItem, styles.statBorder]}>
                  <Text style={styles.statValue}>
                    {longestStreak > 0 ? `${longestStreak}` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Best</Text>
                </View>
                <View style={[styles.statItem, styles.statBorder]}>
                  <Text style={styles.statValue}>{activityCompletions.length}</Text>
                  <Text style={styles.statLabel}>Done</Text>
                </View>
                <View style={[styles.statItem, styles.statBorder]}>
                  <Text style={styles.statValue}>{formatXP(totalXP)}</Text>
                  <Text style={styles.statLabel}>XP</Text>
                </View>
                <View style={[styles.statItem, styles.statBorder]}>
                  {completionRate !== null ? (
                    <Text style={styles.statValueGold}>{completionRate}%</Text>
                  ) : (
                    <Text style={styles.statValue}>—</Text>
                  )}
                  <Text style={styles.statLabel}>Rate</Text>
                </View>
              </View>

              {/* Weekly XP sparkline */}
              <View style={styles.sparklineSection}>
                <Text style={styles.sparklineSectionLabel}>WEEKLY XP</Text>
                <View style={styles.sparklineBars}>
                  {weeklyXP.map((week, i) => {
                    const fillHeight = week.xp > 0
                      ? Math.max(Math.round((week.xp / sparklineMax) * BAR_MAX_HEIGHT), 4)
                      : 0;
                    const isNow = i === SPARKLINE_WEEKS - 1;
                    return (
                      <View key={i} style={styles.sparklineBarWrapper}>
                        <View style={styles.sparklineTrack}>
                          {fillHeight > 0 && (
                            <View style={[
                              styles.sparklineFill,
                              { height: fillHeight },
                              isNow && styles.sparklineFillNow,
                            ]} />
                          )}
                        </View>
                        <Text style={[styles.sparklineLabel, isNow && styles.sparklineLabelNow]}>
                          {week.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Calendar */}
              <View style={styles.calendarSection}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn}>
                    <Text style={styles.monthNavText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.calendarTitle}>
                    {MONTH_NAMES[calMonth]} {calYear}
                  </Text>
                  <TouchableOpacity
                    onPress={nextMonth}
                    style={styles.monthNavBtn}
                    disabled={isAtCurrentMonth}
                  >
                    <Text style={[styles.monthNavText, isAtCurrentMonth && styles.monthNavDisabled]}>
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.calendarDayLabels}>
                  {DAY_LABELS.map((d, i) => (
                    <Text key={i} style={styles.dayLabelText}>{d}</Text>
                  ))}
                </View>

                {calendarWeeks.map((week, wi) => (
                  <View key={wi} style={styles.calendarWeekRow}>
                    {week.map((day, di) => (
                      <View
                        key={di}
                        style={[
                          styles.calendarDayCell,
                          day.date === null                  && styles.dayCellEmpty,
                          day.date !== null && day.isFuture && !day.isToday && styles.dayCellFuture,
                          day.date !== null && day.isMissed  && styles.dayCellMissed,
                          day.date !== null && day.completed && styles.dayCellCompleted,
                          day.isToday                        && styles.dayCellToday,
                        ]}
                      >
                        {day.date !== null && (
                          <Text style={[
                            styles.dayNumber,
                            day.isFuture && !day.isToday && styles.dayNumberFuture,
                            day.completed                && styles.dayNumberCompleted,
                            day.isToday                  && styles.dayNumberToday,
                          ]}>
                            {day.date.getDate()}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}

                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, styles.dayCellCompleted]} />
                    <Text style={styles.legendText}>Done</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, styles.dayCellMissed]} />
                    <Text style={styles.legendText}>Missed</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, styles.dayCellToday]} />
                    <Text style={styles.legendText}>Today</Text>
                  </View>
                </View>
              </View>

              {activityCompletions.length > 0 && (
                <View style={styles.historyHeadingRow}>
                  <Text style={styles.historyHeading}>History</Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No completions yet.</Text>
              <Text style={styles.emptySubtext}>
                Complete this habit to start tracking your progress.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      </View>
    </Modal>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  headerText: { flex: 1 },
  activityName: {
    fontFamily: fonts.heading,
    fontSize: 11,
    color: colors.gold,
    marginBottom: 6,
    lineHeight: 18,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  skillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  skillBadgeText: {
    fontFamily: fonts.display,
    fontSize: 15,
  },
  cadenceLabel: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textSecondary,
  },
  activityDescription: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 20,
  },
  trainingSince: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 3,
  },
  closeButton: {
    paddingLeft: 12,
    paddingTop: 4,
  },
  closeText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textSecondary,
  },
  listContent: { paddingBottom: 40 },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginTop: 12,
    ...bevel.raised,
  },
  statItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statValueGold: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.gold,
    marginBottom: 2,
  },
  streakDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  streakEmoji: {
    fontSize: 18,
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: fonts.heading,
    fontSize: 8,
    color: colors.textSecondary,
  },

  // Sparkline
  sparklineSection: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...bevel.raised,
  },
  sparklineSectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 8,
    color: colors.textSecondary,
    marginBottom: 10,
    letterSpacing: 1,
  },
  sparklineBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  sparklineBarWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  sparklineTrack: {
    width: '100%',
    height: BAR_MAX_HEIGHT,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  sparklineFill: {
    width: '100%',
    backgroundColor: colors.gold,
    opacity: 0.7,
  },
  sparklineFillNow: {
    opacity: 1,
  },
  sparklineLabel: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sparklineLabelNow: {
    color: colors.gold,
  },

  // Calendar panel
  calendarSection: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 10,
    ...bevel.raised,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarTitle: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.textPrimary,
  },
  monthNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: colors.surfaceRaised,
    ...bevel.raised,
  },
  monthNavText: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.gold,
    lineHeight: 24,
  },
  monthNavDisabled: {
    color: colors.textMuted,
  },
  calendarDayLabels: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  dayLabelText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.textSecondary,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  calendarDayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  dayCellEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  dayCellMissed: {
    backgroundColor: '#3a0e0e',
    borderColor: '#5a1818',
  },
  dayCellCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.successLight,
  },
  dayCellFuture: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.borderSubtle,
  },
  dayCellToday: {
    borderWidth: 2,
    borderTopColor: colors.gold,
    borderLeftColor: colors.gold,
    borderBottomColor: colors.goldDark,
    borderRightColor: colors.goldDark,
  },
  dayNumber: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  dayNumberCompleted: { color: colors.successText },
  dayNumberToday: { color: colors.gold },
  dayNumberFuture: { color: colors.textMuted },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  legendText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
  },

  // History
  historyHeadingRow: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 4,
  },
  historyHeading: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.textPrimary,
  },
  completionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  completionDateTime: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textPrimary,
  },
  completionXP: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.gold,
  },

  // Empty state
  emptyContainer: {
    paddingTop: 48,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.textSecondary,
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  emptySubtext: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
