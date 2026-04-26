/**
 * Activities Screen (Phase 2)
 * 
 * Displays user's selected activities organized by cadence.
 * Features:
 * - Show only user's selected activities (from userActivities)
 * - Checkbox to complete activities
 * - Real-time XP updates when activities are checked off
 * - Completed section showing today's activity history
 * - Undo button to revoke XP for completed activities
 * - Real-time sync with Firebase
 */

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
  Pressable,
} from 'react-native';
import { useActivities } from '../context/ActivitiesContext';
import { useSkills } from '../context/SkillsContext';
import { Cadence, UserActivity, ActivityCompletion } from '../types';
import { getCadenceLabel } from '../constants/cadences';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { colors } from '../constants/colors';
import { XPDrop } from '../components/XPDrop';
import { LevelUpModal } from '../components/LevelUpModal';
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

/**
 * Activities Screen Component (Phase 2)
 * 
 * Displays user's selected activities with completion history and undo functionality.
 */
export function ActivitiesScreen() {
  const {
    userActivities,
    completions,
    loading,
    error,
    completeActivity,
    refreshActivities,
    undoCompletion,
  } = useActivities();

  const { skills } = useSkills();
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [xpDrops, setXPDrops] = useState<XPDropEntry[]>([]);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshActivities();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle activity completion
   */
  const handleActivityPress = async (activity: UserActivity, rowY: number) => {
    if (completingId) return;
    // Snapshot level before the write so we can detect a level-up after
    const skillBefore = skills.find(s => s.skillName === activity.skillId);
    const levelBefore = skillBefore ? calculateLevel(skillBefore.totalXP) : 1;
    try {
      setCompletingId(activity.id);
      await completeActivity(activity.id);

      // Show XP drop
      setXPDrops(prev => [
        ...prev,
        { key: `${activity.id}-${Date.now()}`, xp: activity.xpPerCompletion, skillId: activity.skillId, top: rowY },
      ]);

      // Check for level-up (skills are updated in real-time by the context listener)
      const skillAfter = skills.find(s => s.skillName === activity.skillId);
      const levelAfter = skillAfter ? calculateLevel(skillAfter.totalXP + activity.xpPerCompletion) : levelBefore;
      if (levelAfter > levelBefore) {
        setLevelUpEvent({ skillName: activity.skillId, newLevel: levelAfter });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to complete activity. Please try again.');
    } finally {
      setCompletingId(null);
    }
  };

  /**
   * Handle undo completion
   */
  const handleUndoCompletion = useCallback(
    async (completion: ActivityCompletion) => {
      try {
        await undoCompletion(completion.id);
      } catch (err) {
        Alert.alert('Error', 'Failed to undo. Please try again.');
      }
    },
    [undoCompletion]
  );

  /**
   * Check if activity is completed today
   */
  const isActivityCompletedToday = (activityId: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return completions.some(c => {
      const completionDate = new Date(c.completedAt);
      completionDate.setHours(0, 0, 0, 0);
      return c.activityId === activityId && completionDate.getTime() === today.getTime();
    });
  };

  /**
   * Get completion records for today
   */
  const todayCompletions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return completions.filter(c => {
      const completionDate = new Date(c.completedAt);
      completionDate.setHours(0, 0, 0, 0);
      return completionDate.getTime() === today.getTime();
    });
  }, [completions]);

  /**
   * Organize activities by cadence
   */
  const sections = useMemo(() => {
    const cadences: Cadence[] = ['daily', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly', 'monthly'];
    const allSections = [];

    for (const cadence of cadences) {
      const cadenceActivities = userActivities.filter(a => a.cadence === cadence);
      if (cadenceActivities.length > 0) {
        const completedCount = cadenceActivities.filter(a =>
          isActivityCompletedToday(a.id)
        ).length;

        allSections.push({
          title: getCadenceLabel(cadence),
          subtitle: `${completedCount}/${cadenceActivities.length} completed`,
          data: cadenceActivities,
          cadence,
          completedCount,
        });
      }
    }

    return allSections;
  }, [userActivities, completions]);

  /**
   * Render a single activity item
   */
  const renderActivityItem = ({ item: activity }: { item: UserActivity }) => {
    const isCompleted = isActivityCompletedToday(activity.id);
    const isLoading = completingId === activity.id;
    const template = ACTIVITY_TEMPLATES.find(t => t.id === activity.id);
    const activityName = template?.activityName || activity.id;

    return (
      <TouchableOpacity
        style={[styles.activityItem, isCompleted && styles.activityItemCompleted]}
        onPress={(e) => {
          if (!isCompleted && !completingId) {
            handleActivityPress(activity, e.nativeEvent.pageY);
          }
        }}
        disabled={isCompleted || !!completingId}
      >
        {/* Checkbox */}
        <View style={[
          styles.checkbox,
          isCompleted && styles.checkboxCompleted,
        ]}>
          {isLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : isCompleted && <Text style={styles.checkmark}>✓</Text>
          }
        </View>

        {/* Activity Info */}
        <View style={styles.activityInfo}>
          <Text style={[
            styles.activityName,
            isCompleted && styles.activityNameCompleted,
          ]}>
            {activityName}
          </Text>
          <Text style={styles.skillName}>
            {activity.skillId} • +{activity.xpPerCompletion} XP
          </Text>
        </View>

        {/* Status Indicator */}
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Done</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /**
   * Render section header
   */
  const renderSectionHeader = ({ section }: { section: any }) => (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
      </View>
      <View style={styles.progressIndicator}>
        <Text style={styles.progressText}>
          {section.completedCount}/{section.data.length}
        </Text>
      </View>
    </View>
  );

  /**
   * Render completed activities section
   */
  const renderCompletedSection = () => {
    if (todayCompletions.length === 0) return null;

    return (
      <View style={styles.completedSection}>
        <Text style={styles.completedSectionTitle}>Completed Today ({todayCompletions.length})</Text>
        {todayCompletions.map(completion => {
          const activity = userActivities.find(a => a.id === completion.activityId);
          const template = ACTIVITY_TEMPLATES.find(t => t.id === completion.activityId);
          const activityName = template?.activityName || completion.activityId;

          return (
            <View key={completion.id} style={styles.completionItem}>
              <View style={styles.completionInfo}>
                <Text style={styles.completionName}>{activityName}</Text>
                <Text style={styles.completionMeta}>
                  {activity?.skillId} • {completion.xpEarned} XP •{' '}
                  {new Date(completion.completedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Pressable
                onPress={() => handleUndoCompletion(completion)}
                style={({ pressed }) => [
                  styles.undoButton,
                  pressed && styles.undoButtonPressed,
                ]}
              >
                <Text style={styles.undoButtonText}>↶ Undo</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  // Loading state
  if (loading && !userActivities.length) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }

  // Error state
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

  // Empty state
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activities</Text>
        <Text style={styles.headerSubtitle}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderActivityItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderCompletedSection()}
        ListEmptyComponent={<Text style={styles.noActivitiesText}>No activities for today</Text>}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
          />
        }
      />

      {/* XP drop animations — rendered above everything, no touch interception */}
      <View style={styles.xpDropLayer} pointerEvents="none">
        {xpDrops.map(drop => (
          <View key={drop.key} style={[styles.xpDropAnchor, { top: drop.top - 40 }]}>
            <XPDrop
              xp={drop.xp}
              skillId={drop.skillId}
              onComplete={() =>
                setXPDrops(prev => prev.filter(d => d.key !== drop.key))
              }
            />
          </View>
        ))}
      </View>

      {/* Level-up celebration modal */}
      {levelUpEvent && (
        <LevelUpModal
          visible={!!levelUpEvent}
          skillName={levelUpEvent.skillName}
          newLevel={levelUpEvent.newLevel}
          onClose={() => setLevelUpEvent(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  header: {
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listContent: {
    paddingVertical: 8,
  },
  completedSection: {
    backgroundColor: colors.surface,
    marginVertical: 12,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  completedSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 12,
  },
  completionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
  },
  completionInfo: {
    flex: 1,
    marginRight: 8,
  },
  completionName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  completionMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  undoButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  undoButtonPressed: {
    opacity: 0.7,
  },
  undoButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.successText,
  },
  sectionHeader: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  progressIndicator: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.background,
  },
  activityItemCompleted: {
    backgroundColor: '#1a2810',
    opacity: 0.7,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  activityNameCompleted: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  skillName: {
    fontSize: 12,
    color: colors.gold,
  },
  completedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  completedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.successText,
  },
  loadingText: {
    color: colors.textPrimary,
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 12,
    color: colors.errorText,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryText: {
    color: colors.background,
    fontWeight: '600',
  },
  noActivitiesText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  xpDropLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  xpDropAnchor: {
    position: 'absolute',
    right: 0,
    left: 0,
  },
});
