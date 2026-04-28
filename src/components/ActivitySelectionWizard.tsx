import React, { useState, useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
  Alert,
  SafeAreaView,
} from 'react-native';
import { UserActivity, Cadence } from '../types';
import { OSRS_SKILLS, SKILL_ICONS } from '../constants/osrsSkills';
import { ACTIVITY_TEMPLATES, ActivityTemplate } from '../constants/activities';
import { getCadenceLabel } from '../constants/cadences';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

interface ActivitySelectionWizardProps {
  visible: boolean;
  onClose: () => void;
  selectedActivities: UserActivity[];
  onActivityAdded: (activityTemplateId: string, cadence: Cadence) => Promise<void>;
  onActivityRemoved?: (activityId: string) => Promise<void>;
  loading?: boolean;
}

type WizardStep = 'browse' | 'cadence-select' | 'confirm';
type WizardMode = 'add' | 'remove';

type BrowseItem =
  | { type: 'header'; skill: string }
  | { type: 'activity'; activity: ActivityTemplate };

export function ActivitySelectionWizard({
  visible,
  onClose,
  selectedActivities,
  onActivityAdded,
  onActivityRemoved,
  loading = false,
}: ActivitySelectionWizardProps) {
  const [step, setStep] = useState<WizardStep>('browse');
  const [mode, setMode] = useState<WizardMode>('add');
  const [filterSkill, setFilterSkill] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedCadence, setSelectedCadence] = useState<Cadence>('3x/week');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // UserActivity.id === activityTemplateId (Firestore doc ID = template ID)
  const selectedIds = useMemo(
    () => new Set(selectedActivities.map(a => a.id)),
    [selectedActivities]
  );

  const availableActivities = useMemo(
    () => ACTIVITY_TEMPLATES.filter(a => !selectedIds.has(a.id)),
    [selectedIds]
  );

  // Only show filter chips for skills that have at least one available activity
  const availableSkills = useMemo(
    () => OSRS_SKILLS.filter(s => availableActivities.some(a => a.skillId === s)),
    [availableActivities]
  );

  const browseItems = useMemo<BrowseItem[]>(() => {
    const filtered = filterSkill
      ? availableActivities.filter(a => a.skillId === filterSkill)
      : availableActivities;

    // When filtering to one skill, flat list — no section headers needed
    if (filterSkill) {
      return filtered.map(a => ({ type: 'activity', activity: a }));
    }

    // Group by skill in OSRS order
    const bySkill: Record<string, ActivityTemplate[]> = {};
    filtered.forEach(a => {
      if (!bySkill[a.skillId]) bySkill[a.skillId] = [];
      bySkill[a.skillId].push(a);
    });

    const items: BrowseItem[] = [];
    for (const skill of OSRS_SKILLS) {
      if (bySkill[skill]?.length) {
        items.push({ type: 'header', skill });
        bySkill[skill].forEach(a => items.push({ type: 'activity', activity: a }));
      }
    }
    return items;
  }, [filterSkill, availableActivities]);

  const activityTemplate = useMemo(
    () => ACTIVITY_TEMPLATES.find(a => a.id === selectedActivity) ?? null,
    [selectedActivity]
  );

  const handleSelectActivity = (activityId: string) => {
    const tmpl = ACTIVITY_TEMPLATES.find(a => a.id === activityId);
    setSelectedActivity(activityId);
    if (tmpl?.defaultCadence) setSelectedCadence(tmpl.defaultCadence);
    setStep('cadence-select');
  };

  const handleBack = () => {
    if (step === 'cadence-select') {
      setStep('browse');
      setSelectedActivity(null);
    } else if (step === 'confirm') {
      setStep('cadence-select');
    }
  };

  const handleConfirm = async () => {
    if (!selectedActivity) return;
    try {
      setIsSubmitting(true);
      await onActivityAdded(selectedActivity, selectedCadence);
      resetAndClose();
    } catch (err) {
      console.error('Error adding activity:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveActivity = async (activityId: string) => {
    if (!onActivityRemoved) return;
    try {
      setIsRemoving(true);
      await onActivityRemoved(activityId);
    } catch (err) {
      console.error('Error removing activity:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRemoveAll = () => {
    if (!onActivityRemoved || selectedActivities.length === 0) return;
    Alert.alert(
      'Remove All Activities',
      `Remove all ${selectedActivities.length} activities? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRemoving(true);
              for (const activity of selectedActivities) {
                await onActivityRemoved(activity.id);
              }
            } catch (err) {
              console.error('Error removing all activities:', err);
            } finally {
              setIsRemoving(false);
            }
          },
        },
      ]
    );
  };

  const resetAndClose = () => {
    setStep('browse');
    setFilterSkill(null);
    setSelectedActivity(null);
    setSelectedCadence('3x/week');
    onClose();
  };

  const getStepProgress = (): string | null => {
    if (step === 'browse') return null;
    return step === 'cadence-select' ? 'Step 1 of 2' : 'Step 2 of 2';
  };

  // ── Browse step ──────────────────────────────────────────────────────────────
  const renderBrowse = () => (
    <View style={styles.stepContainer}>
      {/* Skill filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        <Pressable
          style={[styles.filterChip, filterSkill === null && styles.filterChipActive]}
          onPress={() => setFilterSkill(null)}
        >
          <Text style={[styles.filterChipText, filterSkill === null && styles.filterChipTextActive]}>
            ALL
          </Text>
        </Pressable>
        {availableSkills.map(skill => (
          <Pressable
            key={skill}
            style={[styles.filterChip, filterSkill === skill && styles.filterChipActive]}
            onPress={() => setFilterSkill(filterSkill === skill ? null : skill)}
          >
            <Image source={SKILL_ICONS[skill]} style={styles.filterChipIcon} resizeMode="contain" />
            <Text style={[styles.filterChipText, filterSkill === skill && styles.filterChipTextActive]}>
              {skill.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Activity list */}
      {browseItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>All done!</Text>
          <Text style={styles.emptyText}>
            {filterSkill
              ? `All ${filterSkill} activities are already added.`
              : 'All available activities have been added.'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.browseList} showsVerticalScrollIndicator={false}>
          {browseItems.map(item => {
            if (item.type === 'header') {
              return (
                <View key={`h-${item.skill}`} style={styles.skillSectionHeader}>
                  <Image
                    source={SKILL_ICONS[item.skill]}
                    style={styles.skillSectionIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.skillSectionText}>{item.skill.toUpperCase()}</Text>
                </View>
              );
            }
            const { activity } = item;
            return (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityRow}
                onPress={() => handleSelectActivity(activity.id)}
                activeOpacity={0.7}
              >
                <Image
                  source={SKILL_ICONS[activity.skillId]}
                  style={styles.activityRowIcon}
                  resizeMode="contain"
                />
                <View style={styles.activityRowBody}>
                  <Text style={styles.activityRowName}>{activity.activityName}</Text>
                  <Text style={styles.activityRowDesc} numberOfLines={1}>
                    {activity.description}
                  </Text>
                </View>
                <Text style={styles.activityRowXP}>{activity.baseXP} XP</Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 16 }} />
        </ScrollView>
      )}
    </View>
  );

  // ── Cadence step ─────────────────────────────────────────────────────────────
  const renderCadenceSelect = () => (
    <View style={styles.stepContainer}>
      {/* Activity preview card */}
      {activityTemplate && (
        <View style={styles.previewCard}>
          <Image
            source={SKILL_ICONS[activityTemplate.skillId]}
            style={styles.previewIcon}
            resizeMode="contain"
          />
          <View style={styles.previewBody}>
            <Text style={styles.previewName}>{activityTemplate.activityName}</Text>
            <Text style={styles.previewSkill}>{activityTemplate.skillId}</Text>
          </View>
        </View>
      )}

      <Text style={styles.stepSectionLabel}>HOW OFTEN?</Text>

      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {activityTemplate?.availableCadences.map(cadence => {
          const isSelected = selectedCadence === cadence;
          return (
            <TouchableOpacity
              key={cadence}
              style={[styles.cadenceOption, isSelected && styles.cadenceOptionSelected]}
              onPress={() => setSelectedCadence(cadence)}
              activeOpacity={0.7}
            >
              <View style={styles.cadenceOptionBody}>
                <Text style={[styles.cadenceOptionLabel, isSelected && styles.cadenceOptionLabelSelected]}>
                  {getCadenceLabel(cadence)}
                </Text>
                <Text style={[styles.cadenceOptionXP, isSelected && styles.cadenceOptionXPSelected]}>
                  {activityTemplate.baseXP} XP per completion
                </Text>
              </View>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );

  // ── Confirm step ─────────────────────────────────────────────────────────────
  const renderConfirm = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepSectionLabel}>CONFIRM SELECTION</Text>
      <View style={styles.confirmList}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmCardLabel}>SKILL</Text>
          <Text style={styles.confirmCardValue}>{activityTemplate?.skillId}</Text>
        </View>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmCardLabel}>ACTIVITY</Text>
          <Text style={styles.confirmCardValue}>{activityTemplate?.activityName}</Text>
          <Text style={styles.confirmCardDesc}>{activityTemplate?.description}</Text>
        </View>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmCardLabel}>CADENCE</Text>
          <Text style={styles.confirmCardValue}>{getCadenceLabel(selectedCadence)}</Text>
        </View>
        <View style={[styles.confirmCard, styles.confirmCardHighlight]}>
          <Text style={styles.confirmCardLabel}>XP PER COMPLETION</Text>
          <Text style={styles.confirmXPValue}>{activityTemplate?.baseXP ?? 0} XP</Text>
        </View>
      </View>
    </View>
  );

  // ── Remove tab ───────────────────────────────────────────────────────────────
  const renderRemove = () => (
    <View style={styles.stepContainer}>
      {selectedActivities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No activities</Text>
          <Text style={styles.emptyText}>Head to "+ Add Activity" to get started.</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.removeList} showsVerticalScrollIndicator={false}>
            {selectedActivities.map(activity => {
              const template = ACTIVITY_TEMPLATES.find(a => a.id === activity.activityTemplateId);
              return (
                <View key={activity.id} style={styles.removeRow}>
                  <Image
                    source={SKILL_ICONS[activity.skillId]}
                    style={styles.removeRowIcon}
                    resizeMode="contain"
                  />
                  <View style={styles.removeRowBody}>
                    <Text style={styles.removeRowName}>{template?.activityName}</Text>
                    <View style={styles.removeRowMeta}>
                      <Text style={styles.removeRowSkillTag}>{activity.skillId}</Text>
                      <Text style={styles.removeRowCadenceTag}>{getCadenceLabel(activity.cadence)}</Text>
                      <Text style={styles.removeRowXPTag}>{activity.xpPerCompletion} XP</Text>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.removeBtn,
                      pressed && { opacity: 0.7 },
                      isRemoving && { opacity: 0.5 },
                    ]}
                    onPress={() => handleRemoveActivity(activity.id)}
                    disabled={isRemoving}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={styles.removeAllBar}>
            <Pressable
              style={({ pressed }) => [
                styles.removeAllBtn,
                pressed && { opacity: 0.7 },
                isRemoving && { opacity: 0.5 },
              ]}
              onPress={handleRemoveAll}
              disabled={isRemoving}
            >
              <Text style={styles.removeAllBtnText}>🗑️  Remove All Activities</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={resetAndClose}
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle}>Activity Manager</Text>
            {mode === 'add' && getStepProgress() && (
              <Text style={styles.headerProgress}>{getStepProgress()}</Text>
            )}
          </View>
        </View>

        {/* Mode tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, mode === 'add' && styles.tabActive]}
            onPress={() => { setMode('add'); setStep('browse'); setFilterSkill(null); }}
          >
            <Text style={[styles.tabText, mode === 'add' && styles.tabTextActive]}>
              + ADD ACTIVITY
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'remove' && styles.tabActive]}
            onPress={() => setMode('remove')}
          >
            <Text style={[styles.tabText, mode === 'remove' && styles.tabTextActive]}>
              - REMOVE ACTIVITY
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {mode === 'remove'
            ? renderRemove()
            : step === 'browse'
            ? renderBrowse()
            : step === 'cadence-select'
            ? renderCadenceSelect()
            : renderConfirm()}
        </View>

        {/* Footer — shown only during add flow after the browse step */}
        {mode === 'add' && step !== 'browse' && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={handleBack}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.btnSecondaryText}>← Back</Text>
            </TouchableOpacity>

            {step === 'confirm' ? (
              <TouchableOpacity
                style={[styles.btnPrimary, (isSubmitting || loading) && styles.btnDisabled]}
                onPress={handleConfirm}
                disabled={isSubmitting || loading}
                activeOpacity={0.7}
              >
                {isSubmitting || loading ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Add Activity</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => setStep('confirm')}
                activeOpacity={0.7}
              >
                <Text style={styles.btnPrimaryText}>Continue →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.surface,
    ...bevel.raised,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closeButtonText: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.gold,
  },
  headerBody: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    color: colors.gold,
  },
  headerProgress: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 3,
  },

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.bevelDark,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: colors.gold,
  },
  tabText: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.gold,
  },

  // ── Layout ───────────────────────────────────────────────────────────────────
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },

  // ── Filter chips ─────────────────────────────────────────────────────────────
  filterBar: {
    backgroundColor: colors.surfaceSunken,
    flexGrow: 0,
    borderBottomWidth: 2,
    borderBottomColor: colors.bevelDark,
  },
  filterBarContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    ...bevel.raised,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: colors.gold,
    borderTopColor: '#f0d060',
    borderLeftColor: '#f0d060',
    borderBottomColor: colors.bevelDark,
    borderRightColor: colors.bevelDark,
  },
  filterChipIcon: {
    width: 14,
    height: 14,
  },
  filterChipText: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.background,
  },

  // ── Browse list ───────────────────────────────────────────────────────────────
  browseList: {
    flex: 1,
    paddingTop: 4,
  },
  skillSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: colors.background,
    marginTop: 4,
    gap: 6,
  },
  skillSectionIcon: {
    width: 14,
    height: 14,
    opacity: 0.7,
  },
  skillSectionText: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.surface,
    ...bevel.raised,
    gap: 10,
  },
  activityRowIcon: {
    width: 26,
    height: 26,
  },
  activityRowBody: {
    flex: 1,
  },
  activityRowName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activityRowDesc: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textMuted,
  },
  activityRowXP: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.gold,
    minWidth: 56,
    textAlign: 'right',
  },

  // ── Cadence step ─────────────────────────────────────────────────────────────
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    ...bevel.raised,
    gap: 10,
  },
  previewIcon: {
    width: 28,
    height: 28,
  },
  previewBody: {
    flex: 1,
  },
  previewName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
  },
  previewSkill: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.textSecondary,
  },
  stepSectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 8,
    color: colors.textSecondary,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    letterSpacing: 1,
  },
  optionsList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  cadenceOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  cadenceOptionSelected: {
    backgroundColor: colors.surfaceRaised,
    borderTopColor: colors.gold,
    borderLeftColor: colors.gold,
    borderBottomColor: colors.goldDark,
    borderRightColor: colors.goldDark,
  },
  cadenceOptionBody: {
    flex: 1,
  },
  cadenceOptionLabel: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cadenceOptionLabelSelected: {
    color: colors.gold,
  },
  cadenceOptionXP: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.textSecondary,
  },
  cadenceOptionXPSelected: {
    color: colors.textSecondary,
  },
  checkmark: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.gold,
    marginLeft: 12,
  },

  // ── Confirm step ─────────────────────────────────────────────────────────────
  confirmList: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    ...bevel.raised,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  confirmCardHighlight: {
    backgroundColor: colors.surfaceRaised,
    borderTopColor: colors.gold,
    borderLeftColor: colors.gold,
    borderBottomColor: colors.goldDark,
    borderRightColor: colors.goldDark,
  },
  confirmCardLabel: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  confirmCardValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textPrimary,
  },
  confirmCardDesc: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
  confirmXPValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.gold,
  },

  // ── Remove tab ───────────────────────────────────────────────────────────────
  removeList: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 12,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.surface,
    ...bevel.raised,
    gap: 10,
  },
  removeRowIcon: {
    width: 26,
    height: 26,
  },
  removeRowBody: {
    flex: 1,
  },
  removeRowName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 5,
  },
  removeRowMeta: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  removeRowSkillTag: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  removeRowCadenceTag: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.gold,
    backgroundColor: '#3a3a2a',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  removeRowXPTag: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.textSecondary,
    backgroundColor: '#3a3a2a',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  removeBtn: {
    width: 30,
    height: 30,
    backgroundColor: colors.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderTopColor: '#dd3333',
    borderLeftColor: '#dd3333',
    borderBottomColor: colors.bevelDark,
    borderRightColor: colors.bevelDark,
  },
  removeBtnText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  removeAllBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 2,
    borderTopColor: colors.bevelDark,
    backgroundColor: colors.surfaceSunken,
  },
  removeAllBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    borderWidth: 2,
    borderTopColor: '#dd3333',
    borderLeftColor: '#dd3333',
    borderBottomColor: colors.bevelDark,
    borderRightColor: colors.bevelDark,
  },
  removeAllBtnText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textPrimary,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: 10,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 2,
    borderTopColor: colors.bevelDark,
    backgroundColor: colors.surfaceSunken,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    ...bevel.raised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderTopColor: '#f0d060',
    borderLeftColor: '#f0d060',
    borderBottomColor: colors.bevelDark,
    borderRightColor: colors.bevelDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.background,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
