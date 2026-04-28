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
import { SKILL_ICONS, SKILL_COLORS } from '../constants/osrsSkills';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

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
            style={[
              styles.skillIcon,
              { filter: `drop-shadow(0 0 4px ${SKILL_COLORS[skill.skillName] ?? '#888888'}66)` } as any,
            ]}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.skillIcon} />
        )}

        {/* Skill Name */}
        <Text style={styles.skillName} numberOfLines={2}>
          {skill.skillName}
        </Text>

        {/* Level — large number + /99 in smaller muted text */}
        <Text style={styles.levelRow}>
          <Text style={styles.levelValue}>{currentLevel}</Text>
          <Text style={styles.levelMax}>/99</Text>
        </Text>

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
        <Text style={styles.totalLevelLabel}>TOTAL LEVEL</Text>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...bevel.raised,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.gold,
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  skillCell: {
    width: '32%',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...bevel.raised,
  },
  skillIcon: {
    width: 38,
    height: 38,
    marginBottom: 7,
    imageRendering: 'pixelated',
  } as any,
  skillName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 1,
    height: 22,
  },
  levelRow: {
    lineHeight: 28,
    marginBottom: 1,
  },
  levelValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.gold,
    lineHeight: 28,
  },
  levelMax: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.textSecondary,
    lineHeight: 28,
  },
  xpLabel: {
    fontFamily: fonts.display,
    fontSize: 13,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...bevel.raised,
  },
  totalLevelLabel: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.textSecondary,
  },
  totalLevelValue: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: colors.gold,
  },
  loadingText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 8,
  },
  emptyText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.error,
  },
  errorDetail: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
