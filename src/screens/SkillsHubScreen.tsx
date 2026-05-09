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

import React, { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSkills } from '../context/SkillsContext';
import { useActivities } from '../context/ActivitiesContext';
import { Skill } from '../types';
import { calculateLevel, calculateProgress } from '../utils/xpCalculations';
import { ProgressBar } from '../components/ProgressBar';
import { SkillGuideModal } from '../components/SkillGuideModal';
import { ActivitySelectionWizard } from '../components/ActivitySelectionWizard';
import { Cadence } from '../types';
import { SKILL_ICONS, OSRS_SKILLS } from '../constants/osrsSkills';
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
  const insets = useSafeAreaInsets();
  const { skills, loading, error } = useSkills();
  const { userActivities } = useActivities();
  const [gridHeight, setGridHeight] = useState(0);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [wizardSkill, setWizardSkill] = useState<string | null>(null);
  const [addingActivity, setAddingActivity] = useState(false);

  async function handleActivityAdded(activityTemplateId: string, cadence: Cadence) {
    try {
      setAddingActivity(true);
      await addActivity(activityTemplateId, cadence);
    } finally {
      setAddingActivity(false);
    }
  }

  function handleAddActivityFromGuide() {
    const skill = selectedSkill;
    setSelectedSkill(null);
    setWizardSkill(skill);
  }

  const activeSkillIds = useMemo(
    () => new Set(userActivities.map(a => a.skillId)),
    [userActivities]
  );

  // Build display list from OSRS_SKILLS as source of truth so skills added
  // after account creation (Hunter, Sailing) always appear even if the
  // Firestore documents don't exist yet for existing users.
  const visibleSkills = useMemo(() => {
    const byName = new Map(skills.map(s => [s.skillName, s]));
    return OSRS_SKILLS.map(name => byName.get(name) ?? {
      id: name,
      skillName: name,
      totalXP: 0,
      level: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, [skills]);

  const totalLevel = useMemo(() => {
    return visibleSkills.reduce((sum, skill) => sum + calculateLevel(skill.totalXP), 0);
  }, [visibleSkills]);

  /**
   * Render a single skill cell in the grid
   */
  const renderSkillCell = (skill: Skill) => {
    const currentLevel = calculateLevel(skill.totalXP);
    const progress = calculateProgress(skill.totalXP);
    const isActive = skill.totalXP > 0 || activeSkillIds.has(skill.skillName);

    return (
      <TouchableOpacity
        key={skill.skillName}
        style={[styles.skillCell, !isActive && styles.skillCellInactive]}
        onPress={() => setSelectedSkill(skill.skillName)}
        activeOpacity={0.75}
      >
        {/* Top row: icon left, level right */}
        <View style={styles.skillCellTop}>
          {SKILL_ICONS[skill.skillName] ? (
            <Image
              source={SKILL_ICONS[skill.skillName] as any}
              style={styles.skillIcon}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.skillIcon} />
          )}
          <Text style={styles.levelRow}>
            <Text style={styles.levelValue}>{currentLevel}</Text>
            <Text style={styles.levelMax}>/99</Text>
          </Text>
        </View>

        {/* Skill name */}
        <Text style={styles.skillName} numberOfLines={1}>
          {skill.skillName}
        </Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={progress}
            height={2}
            barColor={isActive ? colors.gold : colors.bevelDark}
            backgroundColor={colors.surfaceSunken}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Chunk skills into rows of 3 for the flex grid
  const skillRows = useMemo(() => {
    const rows: Skill[][] = [];
    for (let i = 0; i < visibleSkills.length; i += 3) {
      rows.push(visibleSkills.slice(i, i + 3) as Skill[]);
    }
    return rows;
  }, [visibleSkills]);

  const numRows = skillRows.length;
  const totalGap = (numRows - 1) * 5;
  const gridPaddingVertical = 12; // paddingVertical: 6 × top + bottom
  const rowHeight = gridHeight > 0
    ? (gridHeight - gridPaddingVertical - totalGap) / numRows
    : 80;

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Skills</Text>
      </View>

      {/* Skills Grid — measures available space, then sets a concrete row height */}
      <View style={styles.grid} onLayout={e => setGridHeight(e.nativeEvent.layout.height)}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
        >
          {skillRows.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.gridRow, { height: rowHeight }]}>
              {row.map(skill => renderSkillCell(skill))}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Footer with Total Level */}
      <View style={styles.footer}>
        <Text style={styles.totalLevelLabel}>TOTAL LEVEL</Text>
        <Text style={styles.totalLevelValue}>{totalLevel}</Text>
      </View>

      <SkillGuideModal
        skill={selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onAddActivity={handleAddActivityFromGuide}
      />

      <ActivitySelectionWizard
        visible={wizardSkill !== null}
        onClose={() => setWizardSkill(null)}
        selectedActivities={userActivities}
        onActivityAdded={handleActivityAdded}
        onActivityRemoved={async (id) => { await removeActivity(id); }}
        loading={addingActivity}
        initialFilterSkill={wizardSkill ?? undefined}
        mode="manage"
      />
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...bevel.raised,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.gold,
  },
  grid: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  gridContent: {
    gap: 5,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 5,
  },
  skillCell: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...bevel.raised,
  },
  skillCellInactive: {
    opacity: 0.4,
  },
  skillCellTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  skillIcon: {
    width: 30,
    height: 30,
    imageRendering: 'pixelated',
  } as any,
  skillName: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  levelRow: {
    lineHeight: 24,
  },
  levelValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.gold,
    lineHeight: 30,
  },
  levelMax: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 30,
  },
  progressContainer: {
    width: '100%',
    marginTop: 4,
  },
  footer: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
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
    fontSize: 26,
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
