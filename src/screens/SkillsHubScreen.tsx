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
import { Skill } from '../types';
import { calculateLevel, calculateProgress, formatXP } from '../utils/xpCalculations';
import { ProgressBar } from '../components/ProgressBar';
import { SKILL_ICONS } from '../constants/osrsSkills';

/**
 * Skills Hub Screen Component
 * 
 * Displays all skills in a 3-column grid matching OSRS layout.
 * Each skill cell shows icon, name, level, and total XP.
 * Bottom displays total level (sum of all skill levels).
 */
export function SkillsHubScreen() {
  const { skills, loading, error } = useSkills();

  /**
   * Calculate total level (sum of all skill levels)
   */
  const totalLevel = useMemo(() => {
    return skills.reduce((sum, skill) => {
      const level = calculateLevel(skill.totalXP);
      return sum + level;
    }, 0);
  }, [skills]);

  /**
   * Sort skills by name for consistent grid order
   */
  const sortedSkills = useMemo(() => {
    return [...skills].sort((a, b) => a.skillName.localeCompare(b.skillName));
  }, [skills]);

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
            barColor="#D4AF37"
            backgroundColor="#1a1a1a"
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

      {/* Skills Grid */}
      <FlatList
        data={sortedSkills}
        renderItem={renderSkillCell}
        keyExtractor={item => item.id}
        numColumns={3}
        scrollEnabled={true}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
      />

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
    backgroundColor: '#1a1a1a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#D4AF37',
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
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
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
    color: '#fff',
    textAlign: 'center',
    marginBottom: 3,
    height: 24,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D4AF37',
    marginBottom: 2,
  },
  xpLabel: {
    fontSize: 9,
    color: '#999',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressContainer: {
    width: '90%',
    marginTop: 2,
  },
  footer: {
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLevelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  totalLevelValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#D4AF37',
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    fontWeight: '600',
  },
  errorDetail: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
