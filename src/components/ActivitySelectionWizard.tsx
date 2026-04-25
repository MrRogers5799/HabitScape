/**
 * Activity Selection Wizard (Phase 2)
 * 
 * Modal dialog allowing users to add new activities to their selection.
 * Flow: Select Skill → Select Activity → Choose Cadence → Confirm
 * 
 * Features:
 * - Step-by-step wizard UI
 * - Shows only activities for selected skill
 * - Displays activity descriptions and base XP
 * - Allows cadence selection with multiplier preview
 * - Prevents duplicate activities (hides already selected)
 */

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
} from 'react-native';
import { UserActivity, Cadence } from '../types';
import { OSRS_SKILLS } from '../constants/osrsSkills';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { getCadenceLabel, getCadenceMultiplier } from '../constants/cadences';

interface ActivitySelectionWizardProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** User's currently selected activities */
  selectedActivities: UserActivity[];
  /** Callback when activity is added */
  onActivityAdded: (activityTemplateId: string, cadence: Cadence) => Promise<void>;
  /** Callback when activity is removed */
  onActivityRemoved?: (activityId: string) => Promise<void>;
  /** Loading state */
  loading?: boolean;
}

/**
 * Wizard Steps
 */
type WizardStep = 'skill-select' | 'activity-select' | 'cadence-select' | 'confirm';
type WizardMode = 'add' | 'remove';

/**
 * Activity Selection Wizard Component
 */
export function ActivitySelectionWizard({
  visible,
  onClose,
  selectedActivities,
  onActivityAdded,
  onActivityRemoved,
  loading = false,
}: ActivitySelectionWizardProps) {
  const [step, setStep] = useState<WizardStep>('skill-select');
  const [mode, setMode] = useState<WizardMode>('add');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedCadence, setSelectedCadence] = useState<Cadence>('3x/week');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  /**
   * Get activities available for selected skill
   */
  const activitiesForSkill = useMemo(() => {
    if (!selectedSkill) return [];

    // Get all activities for this skill
    const skillActivities = ACTIVITY_TEMPLATES.filter(
      a => a.skillId === selectedSkill
    );

    // Filter out already selected activities
    const selectedIds = selectedActivities.map(a => a.id);
    return skillActivities.filter(a => !selectedIds.includes(a.id));
  }, [selectedSkill, selectedActivities]);

  /**
   * Get the selected activity template
   */
  const activityTemplate = useMemo(() => {
    if (!selectedActivity) return null;
    return ACTIVITY_TEMPLATES.find(a => a.id === selectedActivity);
  }, [selectedActivity]);

  /**
   * Calculate XP for selected cadence
   */
  const xpPerCompletion = useMemo(() => {
    if (!activityTemplate) return 0;
    const multiplier = getCadenceMultiplier(selectedCadence);
    return Math.round(activityTemplate.baseXP * multiplier);
  }, [activityTemplate, selectedCadence]);

  /**
   * Handle skill selection and move to next step
   */
  const handleSelectSkill = (skill: string) => {
    setSelectedSkill(skill);
    setSelectedActivity(null);
    setStep('activity-select');
  };

  /**
   * Handle activity selection and move to cadence step
   */
  const handleSelectActivity = (activityId: string) => {
    setSelectedActivity(activityId);
    setStep('cadence-select');
  };

  /**
   * Handle cadence selection and move to confirm
   */
  const handleSelectCadence = (cadence: Cadence) => {
    setSelectedCadence(cadence);
    setStep('confirm');
  };

  /**
   * Handle final confirmation and add activity
   */
  const handleConfirm = async () => {
    if (!selectedActivity) return;

    try {
      setIsSubmitting(true);
      await onActivityAdded(selectedActivity, selectedCadence);
      // Reset wizard and close
      setStep('skill-select');
      setSelectedSkill(null);
      setSelectedActivity(null);
      setSelectedCadence('3x/week');
      onClose();
    } catch (err) {
      console.error('Error adding activity:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle going back to previous step
   */
  const handleBack = () => {
    if (step === 'activity-select') {
      setStep('skill-select');
      setSelectedActivity(null);
    } else if (step === 'cadence-select') {
      setStep('activity-select');
    } else if (step === 'confirm') {
      setStep('cadence-select');
    }
  };

  /**
   * Handle removing an activity
   */
  const handleRemoveActivity = async (activityId: string) => {
    if (!onActivityRemoved) return;

    try {
      setIsRemoving(true);
      console.log(`🗑️ Removing activity ${activityId}`);
      await onActivityRemoved(activityId);
      console.log(`✅ Activity ${activityId} removed successfully`);
    } catch (err) {
      console.error('Error removing activity:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  /**
   * Handle removing all activities
   */
  const handleRemoveAll = async () => {
    if (!onActivityRemoved || selectedActivities.length === 0) return;

    const confirmed = window.confirm(
      `Remove all ${selectedActivities.length} activities? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setIsRemoving(true);
      console.log(`🗑️ Removing all ${selectedActivities.length} activities`);
      
      // Remove each activity sequentially
      for (const activity of selectedActivities) {
        await onActivityRemoved(activity.id);
      }
      
      console.log(`✅ All activities removed successfully`);
    } catch (err) {
      console.error('Error removing activities:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  /**
   * Render skill selection step
   */
  const renderSkillSelect = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select a Skill</Text>
      <Text style={styles.stepSubtitle}>
        Choose which skill to train with a new activity
      </Text>

      <ScrollView style={styles.optionsList}>
        {OSRS_SKILLS.map(skill => (
          <TouchableOpacity
            key={skill}
            style={styles.skillOption}
            onPress={() => handleSelectSkill(skill)}
          >
            <Text style={styles.skillOptionText}>{skill}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  /**
   * Render activity selection step
   */
  const renderActivitySelect = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select Activity</Text>
      <Text style={styles.stepSubtitle}>
        Available activities for {selectedSkill}
      </Text>

      {activitiesForSkill.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No more activities available for this skill
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.optionsList}>
          {activitiesForSkill.map(activity => (
            <TouchableOpacity
              key={activity.id}
              style={styles.activityOption}
              onPress={() => handleSelectActivity(activity.id)}
            >
              <View>
                <Text style={styles.activityName}>{activity.activityName}</Text>
                <Text style={styles.activityDesc}>{activity.description}</Text>
                <Text style={styles.baseXP}>{activity.baseXP} base XP</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  /**
   * Render cadence selection step
   */
  const renderCadenceSelect = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Cadence</Text>
      <Text style={styles.stepSubtitle}>
        How often will you do this activity?
      </Text>

      <ScrollView style={styles.optionsList}>
        {activityTemplate?.availableCadences.map(cadence => {
          const multiplier = getCadenceMultiplier(cadence);
          const xp = Math.round(activityTemplate.baseXP * multiplier);
          return (
            <TouchableOpacity
              key={cadence}
              style={[
                styles.cadenceOption,
                selectedCadence === cadence && styles.cadenceOptionSelected,
              ]}
              onPress={() => handleSelectCadence(cadence)}
            >
              <View style={styles.cadenceInfo}>
                <Text
                  style={[
                    styles.cadenceLabel,
                    selectedCadence === cadence && styles.cadenceLabelSelected,
                  ]}
                >
                  {getCadenceLabel(cadence)}
                </Text>
                <Text
                  style={[
                    styles.cadenceXP,
                    selectedCadence === cadence && styles.cadenceXPSelected,
                  ]}
                >
                  {xp} XP per completion (×{multiplier.toFixed(2)})
                </Text>
              </View>
              {selectedCadence === cadence && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  /**
   * Render confirmation step
   */
  const renderConfirm = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Confirm Selection</Text>

      <View style={styles.confirmContainer}>
        <View style={styles.confirmItem}>
          <Text style={styles.confirmLabel}>Skill</Text>
          <Text style={styles.confirmValue}>{selectedSkill}</Text>
        </View>

        <View style={styles.confirmItem}>
          <Text style={styles.confirmLabel}>Activity</Text>
          <Text style={styles.confirmValue}>{activityTemplate?.activityName}</Text>
          <Text style={styles.confirmDesc}>{activityTemplate?.description}</Text>
        </View>

        <View style={styles.confirmItem}>
          <Text style={styles.confirmLabel}>Cadence</Text>
          <Text style={styles.confirmValue}>{getCadenceLabel(selectedCadence)}</Text>
        </View>

        <View style={[styles.confirmItem, styles.highlightItem]}>
          <Text style={styles.confirmLabel}>XP per Completion</Text>
          <Text style={styles.xpValue}>{xpPerCompletion} XP</Text>
        </View>
      </View>
    </View>
  );

  /**
   * Render manage activities view (showing all selected activities)
   */
  const renderRemoveActivities = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Remove Activities</Text>
      <Text style={styles.stepSubtitle}>
        Click the ✕ button to remove an activity
      </Text>

      {selectedActivities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No activities selected. Head to "+ Add Activity" to add one!
          </Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.optionsList}>
            {selectedActivities.map(activity => {
              const template = ACTIVITY_TEMPLATES.find(
                a => a.id === activity.activityTemplateId
              );
              return (
                <View key={activity.id} style={styles.selectedActivityItem}>
                  <View style={styles.selectedActivityInfo}>
                    <Text style={styles.selectedActivityName}>
                      {template?.activityName}
                    </Text>
                    <Text style={styles.selectedActivitySkill}>
                      {activity.skillId}
                    </Text>
                    <View style={styles.cadenceTag}>
                      <Text style={styles.cadenceTagText}>
                        {getCadenceLabel(activity.cadence)}
                      </Text>
                      <Text style={styles.xpTag}>
                        {activity.xpPerCompletion} XP
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed && styles.removeButtonPressed,
                      isRemoving && styles.removeButtonDisabled,
                    ]}
                    onPress={() => handleRemoveActivity(activity.id)}
                    disabled={isRemoving}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          {/* Remove All Button */}
          <View style={styles.removeAllContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.removeAllButton,
                pressed && styles.removeAllButtonPressed,
                isRemoving && styles.removeAllButtonDisabled,
              ]}
              onPress={handleRemoveAll}
              disabled={isRemoving}
            >
              <Text style={styles.removeAllButtonText}>
                🗑️ Remove All Activities
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  /**
   * Render step content
   */
  const renderStepContent = () => {
    if (mode === 'remove') {
      return renderRemoveActivities();
    }

    switch (step) {
      case 'skill-select':
        return renderSkillSelect();
      case 'activity-select':
        return renderActivitySelect();
      case 'cadence-select':
        return renderCadenceSelect();
      case 'confirm':
        return renderConfirm();
    }
  };

  /**
   * Get step progress text
   */
  const getStepProgress = () => {
    const steps = ['skill-select', 'activity-select', 'cadence-select', 'confirm'];
    const currentIndex = steps.indexOf(step);
    return `Step ${currentIndex + 1} of ${steps.length}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Activity Manager</Text>
            {mode === 'add' && (
              <Text style={styles.headerProgress}>{getStepProgress()}</Text>
            )}
          </View>
        </View>

        {/* Mode Tabs */}
        <View style={styles.tabsContainer}>
          <Pressable
            style={[
              styles.tab,
              mode === 'add' && styles.tabActive,
            ]}
            onPress={() => {
              setMode('add');
              setStep('skill-select');
            }}
          >
            <Text style={[styles.tabText, mode === 'add' && styles.tabTextActive]}>
              + Add Activity
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              mode === 'remove' && styles.tabActive,
            ]}
            onPress={() => setMode('remove')}
          >
            <Text style={[styles.tabText, mode === 'remove' && styles.tabTextActive]}>
              - Remove Activity
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>{renderStepContent()}</View>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          {mode === 'add' && step !== 'skill-select' && (
            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={handleBack}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonSecondaryText}>← Back</Text>
            </TouchableOpacity>
          )}

          {mode === 'add' && step === 'confirm' ? (
            <TouchableOpacity
              style={[
                styles.buttonPrimary,
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isSubmitting || loading}
            >
              {isSubmitting || loading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.buttonPrimaryText}>Add Activity</Text>
              )}
            </TouchableOpacity>
          ) : mode === 'add' ? (
            <TouchableOpacity
              style={[
                styles.buttonPrimary,
                !selectedSkill &&
                  step === 'skill-select' &&
                  styles.buttonDisabled,
                !selectedActivity &&
                  step === 'activity-select' &&
                  styles.buttonDisabled,
              ]}
              onPress={() => {
                if (step === 'skill-select' && selectedSkill) {
                  handleSelectSkill(selectedSkill);
                } else if (step === 'activity-select' && selectedActivity) {
                  handleSelectActivity(selectedActivity);
                } else if (step === 'cadence-select') {
                  handleSelectCadence(selectedCadence);
                }
              }}
              disabled={
                (step === 'skill-select' && !selectedSkill) ||
                (step === 'activity-select' && !selectedActivity)
              }
            >
              <Text style={styles.buttonPrimaryText}>Continue →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingTop: 40,
  },
  header: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#D4AF37',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerProgress: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },  headerContent: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: '#D4AF37',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#D4AF37',
  },  content: {
    flex: 1,
    paddingVertical: 16,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D4AF37',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  optionsList: {
    flex: 1,
  },
  skillOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
  },
  skillOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  activityOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  activityDesc: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  baseXP: {
    fontSize: 11,
    color: '#D4AF37',
    fontWeight: '600',
  },
  cadenceOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#444',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cadenceOptionSelected: {
    borderColor: '#D4AF37',
    backgroundColor: '#2d3a2a',
  },
  cadenceInfo: {
    flex: 1,
  },
  cadenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  cadenceLabelSelected: {
    color: '#D4AF37',
  },
  cadenceXP: {
    fontSize: 12,
    color: '#999',
  },
  cadenceXPSelected: {
    color: '#D4AF37',
  },
  checkmark: {
    fontSize: 20,
    color: '#D4AF37',
    fontWeight: 'bold',
    marginLeft: 12,
  },
  confirmContainer: {
    flex: 1,
    paddingVertical: 16,
  },
  confirmItem: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#666',
  },
  highlightItem: {
    borderLeftColor: '#D4AF37',
    backgroundColor: '#2d3a2a',
  },
  confirmLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  confirmDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  xpValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#D4AF37',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  buttonSecondary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  buttonPrimary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#D4AF37',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  selectedActivityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
  },
  selectedActivityInfo: {
    flex: 1,
  },
  selectedActivityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  selectedActivitySkill: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  cadenceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cadenceTagText: {
    fontSize: 11,
    color: '#D4AF37',
    fontWeight: '600',
    backgroundColor: '#3a3a2a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
  },
  xpTag: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    backgroundColor: '#3a3a2a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  removeButtonPressed: {
    backgroundColor: '#ff5252',
  },
  removeButtonDisabled: {
    opacity: 0.6,
  },
  removeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  removeAllContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  removeAllButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ff6b6b',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAllButtonPressed: {
    backgroundColor: '#ff5252',
  },
  removeAllButtonDisabled: {
    opacity: 0.6,
  },
  removeAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
