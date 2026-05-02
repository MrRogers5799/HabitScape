import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivities } from '../context/ActivitiesContext';
import { useSkills } from '../context/SkillsContext';
import { useAuth } from '../context/AuthContext';
import { Cadence, UserActivity, ActivityCompletion } from '../types';
import { getCadenceLabel, CADENCE_CONFIG } from '../constants/cadences';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { SKILL_ICONS } from '../constants/osrsSkills';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';
import * as Haptics from 'expo-haptics';
import { XPDrop } from '../components/XPDrop';
import { LevelUpModal } from '../components/LevelUpModal';
import { HabitDetailModal } from '../components/HabitDetailModal';
import { calculateLevel } from '../utils/xpCalculations';

interface XPDropEntry {
  key: string;
  xp: number;
  skillId: string;
  top: number;
}

interface LevelUpEvent {
  skillName: string;
  newLevel: number;
}

// ── date helpers ──────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeekFor(d: Date, weekStartDay: 0 | 1 = 1): Date {
  const daysFromStart = weekStartDay === 1
    ? (d.getDay() === 0 ? 6 : d.getDay() - 1)
    : d.getDay();
  const start = new Date(d);
  start.setDate(start.getDate() - daysFromStart);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonthFor(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isToday(d: Date): boolean {
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function dateLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const MAX_BACKFILL_DAYS = 14;

export function ActivitiesScreen() {
  const insets = useSafeAreaInsets();
  const {
    userActivities,
    completions,
    loading,
    error,
    completeActivity,
    completeActivityForDate,
    refreshActivities,
    undoCompletion,
  } = useActivities();

  const { skills } = useSkills();
  const { user } = useAuth();
  const weekStartDay: 0 | 1 = user?.weekStartDay ?? 1;
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [xpDrops, setXPDrops] = useState<XPDropEntry[]>([]);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<UserActivity | null>(null);

  // Selected date for browsing — defaults to today
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  const viewing = isToday(selectedDate);

  const canGoBack = useMemo(() => {
    const oldest = startOfDay(new Date());
    oldest.setDate(oldest.getDate() - MAX_BACKFILL_DAYS);
    return selectedDate > oldest;
  }, [selectedDate]);

  const handlePrevDay = () => {
    if (!canGoBack) return;
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const handleNextDay = () => {
    if (viewing) return;
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshActivities();
    } finally {
      setRefreshing(false);
    }
  };

  // ── completion helpers ────────────────────────────────────────────────────

  /**
   * Count unique days an activity was completed within [windowStart, windowEnd].
   */
  const countCompletionDaysInWindow = useCallback(
    (activityId: string, windowStart: Date, windowEnd: Date): number => {
      const days = new Set<number>();
      completions.forEach(c => {
        if (c.activityId !== activityId) return;
        const d = new Date(c.completedAt);
        if (d >= windowStart && d <= windowEnd) {
          const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          days.add(dayKey);
        }
      });
      return days.size;
    },
    [completions]
  );

  const getActivityProgress = useCallback(
    (activity: UserActivity): { count: number; target: number; periodLabel: string } => {
      const { cadence } = activity;
      const config = CADENCE_CONFIG[cadence];
      const end = endOfDay(selectedDate);

      if (cadence === 'daily') {
        const count = countCompletionDaysInWindow(activity.id, startOfDay(selectedDate), end);
        return { count, target: 1, periodLabel: viewing ? 'today' : 'that day' };
      }
      if (cadence === 'weekly') {
        const count = countCompletionDaysInWindow(activity.id, startOfWeekFor(selectedDate, weekStartDay), end);
        return { count, target: 1, periodLabel: viewing ? 'this week' : 'that week' };
      }
      if (cadence === 'monthly') {
        const count = countCompletionDaysInWindow(activity.id, startOfMonthFor(selectedDate), end);
        return { count, target: 1, periodLabel: viewing ? 'this month' : 'that month' };
      }
      // Nx/week
      const count = countCompletionDaysInWindow(activity.id, startOfWeekFor(selectedDate, weekStartDay), end);
      return { count, target: config.timesPerWeek, periodLabel: viewing ? 'this week' : 'that week' };
    },
    [completions, selectedDate, viewing, countCompletionDaysInWindow]
  );

  const isActivityGated = useCallback(
    (activity: UserActivity): boolean => {
      const { count, target } = getActivityProgress(activity);
      if (count >= target) return true;
      // For Nx/week, also gate if already done on the selected date (one per day)
      if (['6x/week', '5x/week', '4x/week', '3x/week', '2x/week'].includes(activity.cadence)) {
        return countCompletionDaysInWindow(
          activity.id,
          startOfDay(selectedDate),
          endOfDay(selectedDate)
        ) > 0;
      }
      return false;
    },
    [getActivityProgress, countCompletionDaysInWindow, selectedDate]
  );

  // ── activity completion ───────────────────────────────────────────────────

  const handleActivityPress = async (activity: UserActivity, rowY: number) => {
    if (completingId) return;
    const skillBefore = skills.find(s => s.skillName === activity.skillId);
    const levelBefore = skillBefore ? calculateLevel(skillBefore.totalXP) : 1;

    try {
      setCompletingId(activity.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (viewing) {
        await completeActivity(activity.id);
      } else {
        // Backfill: use noon of the selected date so the timestamp is unambiguous
        const backfillDate = new Date(selectedDate);
        backfillDate.setHours(12, 0, 0, 0);
        await completeActivityForDate(activity.id, backfillDate);
      }

      setXPDrops(prev => [
        ...prev,
        { key: `${activity.id}-${Date.now()}`, xp: activity.xpPerCompletion, skillId: activity.skillId, top: rowY },
      ]);

      const skillAfter = skills.find(s => s.skillName === activity.skillId);
      const levelAfter = skillAfter ? calculateLevel(skillAfter.totalXP + activity.xpPerCompletion) : levelBefore;
      if (levelAfter > levelBefore) {
        setLevelUpEvent({ skillName: activity.skillId, newLevel: levelAfter });
      }
    } catch {
      Alert.alert('Error', 'Failed to complete activity. Please try again.');
    } finally {
      setCompletingId(null);
    }
  };

  const handleUndoCompletion = useCallback(
    async (completion: ActivityCompletion) => {
      try {
        await undoCompletion(completion.id);
      } catch {
        Alert.alert('Error', 'Failed to undo. Please try again.');
      }
    },
    [undoCompletion]
  );

  // ── completions for selected date ─────────────────────────────────────────

  const dateCompletions = useMemo(() => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return completions.filter(c => {
      const d = new Date(c.completedAt);
      return d >= start && d <= end;
    });
  }, [completions, selectedDate]);

  // ── sections ──────────────────────────────────────────────────────────────

  const sections = useMemo(() => {
    const cadences: Cadence[] = ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly', 'monthly'];
    const allSections = [];

    for (const cadence of cadences) {
      const cadenceActivities = userActivities.filter(a => a.cadence === cadence);
      if (cadenceActivities.length === 0) continue;

      const metQuotaCount = cadenceActivities.filter(a => {
        const { count, target } = getActivityProgress(a);
        return count >= target;
      }).length;

      const periodLabel =
        cadence === 'daily' ? (viewing ? 'today' : 'that day')
        : cadence === 'monthly' ? (viewing ? 'this month' : 'that month')
        : (viewing ? 'this week' : 'that week');

      allSections.push({
        title: getCadenceLabel(cadence),
        subtitle: `${metQuotaCount}/${cadenceActivities.length} done ${periodLabel}`,
        data: cadenceActivities,
        cadence,
      });
    }

    return allSections;
  }, [userActivities, completions, selectedDate, viewing]);

  // ── render ────────────────────────────────────────────────────────────────

  const renderActivityItem = ({ item: activity }: { item: UserActivity }) => {
    const gated = isActivityGated(activity);
    const isLoading = completingId === activity.id;
    const template = ACTIVITY_TEMPLATES.find(t => t.id === activity.id);
    const activityName = template?.activityName || activity.id;
    const { count, target } = getActivityProgress(activity);
    const quotaMet = count >= target;
    const isNxWeek = ['6x/week', '5x/week', '4x/week', '3x/week', '2x/week'].includes(activity.cadence);
    const doneToday = isNxWeek && !quotaMet && gated;

    return (
      <TouchableOpacity
        style={[styles.activityItem, gated && styles.activityItemCompleted]}
        onPress={() => setSelectedActivity(activity)}
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={[styles.checkbox, gated && styles.checkboxCompleted]}
          onPress={(e) => {
            e.stopPropagation();
            if (!!completingId) return;
            if (gated) {
              const completion = [...dateCompletions]
                .filter(c => c.activityId === activity.id)
                .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
              if (completion) handleUndoCompletion(completion);
            } else {
              handleActivityPress(activity, e.nativeEvent.pageY);
            }
          }}
          disabled={!!completingId}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : gated && <Text style={styles.checkmark}>✓</Text>
          }
        </TouchableOpacity>

        <View style={styles.activityInfo}>
          <Text style={[styles.activityName, gated && styles.activityNameCompleted]}>
            {activityName}
          </Text>
          <View style={styles.activityMeta}>
            {SKILL_ICONS[activity.skillId] && (
              <Image source={SKILL_ICONS[activity.skillId]} style={styles.skillIcon} resizeMode="contain" />
            )}
            <Text style={styles.skillMetaText}>+{activity.xpPerCompletion} XP</Text>
            {viewing && (activity.currentStreak ?? 0) > 0 && (
              <Text style={styles.streakFlame}>🔥<Text style={styles.streakText}> {activity.currentStreak}</Text></Text>
            )}
          </View>
        </View>

        {isNxWeek ? (
          <View style={[styles.completedBadge, quotaMet ? styles.quotaMetBadge : styles.progressBadge]}>
            <Text style={styles.completedText}>
              {doneToday ? `${count}/${target} ✓` : `${count}/${target}`}
            </Text>
          </View>
        ) : quotaMet ? (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Done</Text>
          </View>
        ) : null}

        <Text style={styles.rowChevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: any }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
    </View>
  );


  // ── states ────────────────────────────────────────────────────────────────

  if (loading && !userActivities.length) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>❌ Error loading activities</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!userActivities.length) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No Activities Selected</Text>
        <Text style={styles.emptyText}>
          Visit Settings to select activities and start training your skills.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activities</Text>
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={handlePrevDay}
            disabled={!canGoBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.dateNavArrow}
          >
            <Text style={[styles.dateNavArrowText, !canGoBack && styles.dateNavArrowDisabled]}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.dateNavLabel}>{dateLabel(selectedDate)}</Text>

          <TouchableOpacity
            onPress={handleNextDay}
            disabled={viewing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.dateNavArrow}
          >
            <Text style={[styles.dateNavArrowText, viewing && styles.dateNavArrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderActivityItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={<Text style={styles.noActivitiesText}>No activities</Text>}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
          />
        }
      />

      {/* XP drop animations */}
      <View style={styles.xpDropLayer} pointerEvents="none">
        {xpDrops.map(drop => (
          <View key={drop.key} style={[styles.xpDropAnchor, { top: drop.top - 40 }]}>
            <XPDrop
              xp={drop.xp}
              skillId={drop.skillId}
              onComplete={() => setXPDrops(prev => prev.filter(d => d.key !== drop.key))}
            />
          </View>
        ))}
      </View>

      {levelUpEvent && (
        <LevelUpModal
          visible={!!levelUpEvent}
          skillName={levelUpEvent.skillName}
          newLevel={levelUpEvent.newLevel}
          onClose={() => setLevelUpEvent(null)}
        />
      )}

      <HabitDetailModal
        activity={selectedActivity}
        completions={completions}
        onClose={() => setSelectedActivity(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },

  // Header
  header: {
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...bevel.raised,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.gold,
    marginBottom: 1,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateNavArrow: {
    paddingHorizontal: 4,
  },
  dateNavArrowText: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 28,
  },
  dateNavArrowDisabled: {
    color: colors.bevelDark,
  },
  dateNavLabel: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },

  listContent: { paddingVertical: 8 },

  // Section headers
  sectionHeader: {
    backgroundColor: colors.background,
    paddingTop: 14,
    paddingBottom: 5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 9, color: colors.textPrimary },
  sectionSubtitle: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },

  // Activity rows
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  activityItemCompleted: { backgroundColor: colors.successSurface, opacity: 0.85 },
  checkbox: {
    width: 22,
    height: 22,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    ...bevel.inset,
  },
  checkboxCompleted: { backgroundColor: colors.success, ...bevel.inset },
  checkmark: { color: colors.successText, fontWeight: 'bold', fontSize: 13 },
  activityInfo: { flex: 1 },
  activityName: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary, marginBottom: 2 },
  activityNameCompleted: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  skillIcon: { width: 18, height: 18 },
  skillMetaText: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },
  streakFlame: { fontFamily: fonts.display, fontSize: 14, color: colors.gold },
  streakText: { fontFamily: fonts.display, fontSize: 18, color: colors.gold },
  rowChevron: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textSecondary,
    marginLeft: 6,
    lineHeight: 24,
  },
  completedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
    ...bevel.raised,
  },
  quotaMetBadge: { backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8, ...bevel.raised },
  progressBadge: { backgroundColor: colors.surfaceSunken, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8, ...bevel.inset },
  completedText: { fontFamily: fonts.display, fontSize: 16, color: colors.successText },

  // States
  loadingText: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, marginTop: 12 },
  errorText: { fontFamily: fonts.display, fontSize: 20, color: colors.error, marginBottom: 8 },
  errorDetail: { fontFamily: fonts.display, fontSize: 16, color: colors.errorText, textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: colors.gold, paddingHorizontal: 24, paddingVertical: 10, ...bevel.raised },
  retryText: { fontFamily: fonts.display, fontSize: 18, color: colors.background },
  noActivitiesText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary, textAlign: 'center', marginVertical: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.textPrimary, marginBottom: 8 },
  emptyText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary, textAlign: 'center' },

  // XP drops
  xpDropLayer: { ...StyleSheet.absoluteFillObject },
  xpDropAnchor: { position: 'absolute', right: 0, left: 0 },
});
