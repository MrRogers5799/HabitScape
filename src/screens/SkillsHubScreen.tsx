/**
 * Skills Hub Screen - OSRS Grid Layout
 * 
 * Displays all 23 user skills in a compact 3-column grid layout
 * matching the classic OSRS skills interface.
 * 
 * Shows:
 * - Skill icon
 * - Skill name
 * - Current level
 * - Total XP
 * - Total level at bottom (sum of all skill levels)
 * 
 * Real-time updates: When XP changes, grid updates instantly via Firebase listeners.
 */

import React, { useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSkills } from '../context/SkillsContext';
import { useActivities } from '../context/ActivitiesContext';
import { Skill } from '../types';
import { calculateLevel, calculateProgress, formatXP } from '../utils/xpCalculations';
import { ProgressBar } from '../components/ProgressBar';
import { SKILL_ICONS } from '../constants/osrsSkills';
import { colors } from '../constants/colors';

/**
 * Skills Hub Screen Component
 * 
 * Displays all skills in a 3-column grid matching OSRS layout.
 * Each skill cell shows icon, name, level, and total XP.
 * Bottom displays total level (sum of all skill levels).
 */
export function SkillsHubScreen() {
  const { skills, loading, error } = useSkills();
  const { userActivities } = useActivities();

  // Only show skills the user has engaged with — either XP earned or an active habit attached.
  // This keeps the grid clean and motivating rather than showing 22 greyed-out level-1 skills.
  const visibleSkills = useMemo(() => {
    const activeSkillIds = new Set(userActivities.map(a => a.skillId));
    return [...skills]
      .filter(skill => skill.totalXP > 0 || activeSkillIds.has(skill.skillName))
      .sort((a, b) => a.skillName.localeCompare(b.skillName));
  }, [skills, userActivities]);

  const totalLevel = useMemo(() => {
    return visibleSkills.reduce((sum, skill) => sum + calculateLevel(skill.totalXP), 0);
  }, [visibleSkills]);

  /**
   * Render a single skill cell in the grid
   */
  const renderSkillCell = ({ item: skill }: { item: Skill }) => {
    const currentLevel = calculateLevel(skill.totalXP);
    const progress = calculateProgress(skill.totalXP);

    return (
      <View style={styles.skillCell}>
        {/* Skill Icon */}
        {SKILL_ICONS[skill.skillName] ? (
          <Image
            source={SKILL_ICONS[skill.skillName]}
            style={styles.skillIcon}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.skillIcon} />
        )}

        {/* Skill Name */}
        <Text style={styles.skillName} numberOfLines={2}>
          {skill.skillName}
        </Text>

        {/* Level X/99 */}
        <Text style={styles.levelText}>{currentLevel}/99</Text>

        {/* Current XP */}
        <Text style={styles.xpLabel}>XP: {formatXP(skill.totalXP)}</Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={progress}
            height={4}
            barColor={colors.gold}
            backgroundColor={colors.background}
          />
        </View>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Loading skills...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>❌ Error loading skills</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  // Main skills grid
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Skills</Text>
      </View>

      {/* Skills Grid or empty state */}
      {visibleSkills.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No skills trained yet</Text>
          <Text style={styles.emptySubtext}>Add habits in Settings to start earning XP</Text>
        </View>
      ) : (
        <FlatList
          data={visibleSkills}
          renderItem={renderSkillCell}
          keyExtractor={item => item.id}
          numColumns={3}
          scrollEnabled={true}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
        />
      )}

      {/* Footer with Total Level */}
      <View style={styles.footer}>
        <Text style={styles.totalLevelLabel}>Total Level:</Text>
        <Text style={styles.totalLevelValue}>{totalLevel}</Text>
      </View>
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
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  skillCell: {
    width: '32%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillIcon: {
    width: 36,
    height: 36,
    marginBottom: 4,
    imageRendering: 'pixelated',
  } as any,
  skillName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 3,
    height: 24,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 2,
  },
  xpLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  progressContainer: {
    width: '90%',
    marginTop: 2,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLevelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  totalLevelValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gold,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    fontWeight: '600',
  },
  errorDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
