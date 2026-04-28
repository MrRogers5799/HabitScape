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

// Uses local time — avoids UTC-offset mismatches with toISOString()
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

// ─── calendar ────────────────────────────────────────────────────────────────

interface CalendarDay {
  date: Date | null;
  completed: boolean;
  isToday: boolean;
  isFuture: boolean;
}

function buildMonthCalendar(
  year: number,
  month: number,
  completions: ActivityCompletion[],
  activityId: string
): CalendarDay[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use local date keys so evening completions aren't shifted to the next UTC day
  const completedDates = new Set<string>();
  completions.forEach(c => {
    if (c.activityId !== activityId) return;
    completedDates.add(localDateKey(new Date(c.completedAt)));
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0 = Sunday

  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  for (let i = 0; i < startDow; i++) {
    currentWeek.push({ date: null, completed: false, isToday: false, isFuture: false });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    const isFuture = date > today;
    const isToday = date.getTime() === today.getTime();

    currentWeek.push({
      date,
      completed: completedDates.has(localDateKey(date)),
      isToday,
      isFuture,
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: null, completed: false, isToday: false, isFuture: false });
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAY_LABELS = ['S','M','T','W','T','F','S'];

// ─── component ───────────────────────────────────────────────────────────────

export function HabitDetailModal({ activity, completions, onClose }: HabitDetailModalProps) {
  if (!activity) return null;

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const template = ACTIVITY_TEMPLATES.find(t => t.id === activity.id);
  const activityName = template?.activityName ?? activity.id;

  const activityCompletions = useMemo(
    () => completions.filter(c => c.activityId === activity.id),
    [completions, activity.id]
  );

  const totalXP = useMemo(
    () => activityCompletions.reduce((sum, c) => sum + c.xpEarned, 0),
    [activityCompletions]
  );

  const calendarWeeks = useMemo(
    () => buildMonthCalendar(calYear, calMonth, completions, activity.id),
    [calYear, calMonth, completions, activity.id]
  );

  const cadenceLabel = CADENCE_CONFIG[activity.cadence]?.label ?? activity.cadence;
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

  // Single flat section — date is shown inline on each row, no group headers needed
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
            <Text style={styles.activityMeta}>{activity.skillId} · {cadenceLabel}</Text>
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
                  <Text style={styles.statValue}>
                    {currentStreak > 0 ? `🔥 ${currentStreak}` : '—'}
                  </Text>
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
              </View>

              {/* Calendar */}
              <View style={styles.calendarSection}>
                {/* Month navigation */}
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

                {/* Day-of-week labels */}
                <View style={styles.calendarDayLabels}>
                  {DAY_LABELS.map((d, i) => (
                    <Text key={i} style={styles.dayLabelText}>{d}</Text>
                  ))}
                </View>

                {/* Week rows */}
                {calendarWeeks.map((week, wi) => (
                  <View key={wi} style={styles.calendarWeekRow}>
                    {week.map((day, di) => (
                      <View
                        key={di}
                        style={[
                          styles.calendarDayCell,
                          day.date === null                                         && styles.dayCellEmpty,
                          day.date !== null && day.isFuture && !day.isToday        && styles.dayCellFuture,
                          day.date !== null && !day.isFuture && !day.isToday && !day.completed && styles.dayCellMissed,
                          day.date !== null && day.completed                       && styles.dayCellCompleted,
                          day.isToday                                              && styles.dayCellToday,
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

                {/* Legend */}
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
  headerText: {
    flex: 1,
  },
  activityName: {
    fontFamily: fonts.heading,
    fontSize: 11,
    color: colors.gold,
    marginBottom: 6,
    lineHeight: 18,
  },
  activityMeta: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textSecondary,
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
  listContent: {
    paddingBottom: 40,
  },

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
    fontSize: 22,
    color: colors.gold,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.textSecondary,
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

  // Day-of-week header
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

  // Week row
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },

  // Day cell base
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

  // Day number text
  dayNumber: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  dayNumberCompleted: {
    color: colors.successText,
  },
  dayNumberToday: {
    color: colors.gold,
  },
  dayNumberFuture: {
    color: colors.textMuted,
  },

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

  // History heading
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

  // Completion rows — date+time on left, XP on right
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
    fontSize: 17,
    color: colors.textPrimary,
  },
  completionXP: {
    fontFamily: fonts.display,
    fontSize: 18,
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
