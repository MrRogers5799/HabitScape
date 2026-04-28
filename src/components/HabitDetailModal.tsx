import React, { useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  SectionList,
  ScrollView,
} from 'react-native';
import { UserActivity, ActivityCompletion } from '../types';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { CADENCE_CONFIG } from '../constants/cadences';
import { formatXP } from '../utils/xpCalculations';
import { getWeekMonday, toDateStr } from '../utils/streakUtils';
import { colors } from '../constants/colors';

interface HabitDetailModalProps {
  activity: UserActivity | null;
  completions: ActivityCompletion[];
  onClose: () => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function sectionLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Builds a last-N-weeks consistency array, newest week first.
 * Each entry: { label, status: 'met' | 'missed' | 'current' }
 */
function buildWeeklyConsistency(
  activity: UserActivity,
  completions: ActivityCompletion[],
  weekCount = 8
): { label: string; status: 'met' | 'missed' | 'current' }[] {
  if (activity.cadence === 'monthly') return [];

  const target = CADENCE_CONFIG[activity.cadence].timesPerWeek;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const thisWeekMonday = getWeekMonday(new Date());
  const results = [];

  for (let i = 0; i < weekCount; i++) {
    const weekStart = new Date(thisWeekMonday.getTime() - i * msPerWeek);
    const weekEnd = new Date(weekStart.getTime() + msPerWeek);
    const isCurrent = i === 0;

    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const uniqueDays = new Set<string>();
    completions.forEach(c => {
      if (c.activityId !== activity.id) return;
      const d = new Date(c.completedAt);
      if (d >= weekStart && d < weekEnd) {
        uniqueDays.add(toDateStr(d));
      }
    });

    const met = uniqueDays.size >= target;
    results.push({
      label,
      status: isCurrent ? 'current' : met ? 'met' : 'missed',
    } as const);
  }

  return results;
}

// ─── component ───────────────────────────────────────────────────────────────

export function HabitDetailModal({ activity, completions, onClose }: HabitDetailModalProps) {
  if (!activity) return null;

  const template = ACTIVITY_TEMPLATES.find(t => t.id === activity.id);
  const activityName = template?.activityName ?? activity.id;

  // Completions for this activity only, newest first
  const activityCompletions = useMemo(
    () => completions.filter(c => c.activityId === activity.id),
    [completions, activity.id]
  );

  const totalXP = useMemo(
    () => activityCompletions.reduce((sum, c) => sum + c.xpEarned, 0),
    [activityCompletions]
  );

  const weeklyConsistency = useMemo(
    () => buildWeeklyConsistency(activity, completions),
    [activity, completions]
  );

  // Group completions by date for the history list
  const sections = useMemo(() => {
    const groups = new Map<string, ActivityCompletion[]>();
    for (const c of activityCompletions) {
      const label = sectionLabel(new Date(c.completedAt));
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(c);
    }
    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [activityCompletions]);

  const cadenceLabel = CADENCE_CONFIG[activity.cadence]?.label ?? activity.cadence;
  const currentStreak = activity.currentStreak ?? 0;
  const longestStreak = activity.longestStreak ?? 0;

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
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.completionRow}>
              <Text style={styles.completionTime}>{formatTime(new Date(item.completedAt))}</Text>
              <Text style={styles.completionXP}>+{item.xpEarned} XP</Text>
            </View>
          )}
          ListHeaderComponent={
            <>
              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {currentStreak > 0 ? `🔥 ${currentStreak}w` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
                <View style={[styles.statItem, styles.statBorder]}>
                  <Text style={styles.statValue}>
                    {longestStreak > 0 ? `${longestStreak}w` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Best</Text>
                </View>
                <View style={[styles.statItem, styles.statBorder]}>
                  <Text style={styles.statValue}>{activityCompletions.length}</Text>
                  <Text style={styles.statLabel}>Done</Text>
                </View>
                <View style={[styles.statItem, styles.statBorder]}>
                  <Text style={styles.statValue}>{formatXP(totalXP)}</Text>
                  <Text style={styles.statLabel}>XP Earned</Text>
                </View>
              </View>

              {/* Weekly consistency */}
              {weeklyConsistency.length > 0 && (
                <View style={styles.consistencySection}>
                  <Text style={styles.consistencyTitle}>Last 8 Weeks</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.consistencyRow}
                  >
                    {[...weeklyConsistency].reverse().map((week, i) => (
                      <View key={i} style={styles.weekCell}>
                        <View style={[
                          styles.weekDot,
                          week.status === 'met' && styles.weekDotMet,
                          week.status === 'missed' && styles.weekDotMissed,
                          week.status === 'current' && styles.weekDotCurrent,
                        ]} />
                        <Text style={styles.weekLabel}>{week.label}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, styles.weekDotMet]} />
                      <Text style={styles.legendText}>Target met</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, styles.weekDotMissed]} />
                      <Text style={styles.legendText}>Missed</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, styles.weekDotCurrent]} />
                      <Text style={styles.legendText}>This week</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* History heading */}
              {sections.length > 0 && (
                <Text style={styles.historyHeading}>History</Text>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No completions yet.</Text>
              <Text style={styles.emptySubtext}>Complete this habit to start tracking your progress.</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
  },
  activityName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 4,
  },
  activityMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  closeButton: {
    paddingLeft: 12,
    paddingTop: 2,
  },
  closeText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: 40,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Weekly consistency
  consistencySection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  consistencyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  consistencyRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  weekCell: {
    alignItems: 'center',
    gap: 4,
  },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surfaceRaised,
  },
  weekDotMet: {
    backgroundColor: colors.success,
  },
  weekDotMissed: {
    backgroundColor: colors.destructive,
    opacity: 0.7,
  },
  weekDotCurrent: {
    backgroundColor: colors.gold,
    opacity: 0.5,
  },
  weekLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // History
  historyHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  completionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  completionTime: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  completionXP: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
  },

  // Empty
  emptyContainer: {
    paddingTop: 48,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
