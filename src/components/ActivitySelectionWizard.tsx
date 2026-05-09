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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserActivity, Cadence } from '../types';
import { OSRS_SKILLS, SKILL_ICONS, SKILL_COLORS } from '../constants/osrsSkills';
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
  initialFilterSkill?: string;
  mode?: 'add' | 'manage';
}

type AddStep = 'browse' | 'cadence-select' | 'confirm';
type ManageStep = 'browse' | 'cadence';

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
  initialFilterSkill,
  mode = 'add',
}: ActivitySelectionWizardProps) {

  // ── Shared ────────────────────────────────────────────────────────────────────
  const [filterSkill, setFilterSkill] = useState<string | null>(initialFilterSkill ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Add mode ──────────────────────────────────────────────────────────────────
  const [addStep, setAddStep] = useState<AddStep>('browse');
  const [addTab, setAddTab] = useState<'add' | 'remove'>('add');
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedCadence, setSelectedCadence] = useState<Cadence>('3x/week');
  const [isRemoving, setIsRemoving] = useState(false);

  // ── Manage mode ───────────────────────────────────────────────────────────────
  const [manageStep, setManageStep] = useState<ManageStep>('browse');
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(new Set());
  const [pendingCadences, setPendingCadences] = useState<Record<string, Cadence>>({});
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const originalIds = useMemo(
    () => new Set(selectedActivities.map(a => a.id)),
    [selectedActivities]
  );

  const toAdd = useMemo(
    () => [...pendingSelected].filter(id => !originalIds.has(id)),
    [pendingSelected, originalIds]
  );

  const toRemove = useMemo(
    () => [...originalIds].filter(id => !pendingSelected.has(id)),
    [pendingSelected, originalIds]
  );

  const hasChanges = toAdd.length > 0 || toRemove.length > 0;

  // ── Sync on open ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (visible) {
      setFilterSkill(initialFilterSkill ?? null);
      setSearchQuery('');
      if (mode === 'manage') {
        setPendingSelected(new Set(selectedActivities.map(a => a.id)));
        const cadences: Record<string, Cadence> = {};
        selectedActivities.forEach(a => { cadences[a.activityTemplateId] = a.cadence; });
        setPendingCadences(cadences);
        setManageStep('browse');
        setShowSelectedOnly(false);
      } else {
        setAddStep('browse');
        setAddTab('add');
        setSelectedActivity(null);
      }
    }
  }, [visible, initialFilterSkill]);

  const resetAndClose = () => {
    setFilterSkill(initialFilterSkill ?? null);
    setSearchQuery('');
    setSelectedActivity(null);
    setSelectedCadence('3x/week');
    onClose();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ADD MODE
  // ─────────────────────────────────────────────────────────────────────────────

  const addSelectedIds = useMemo(
    () => new Set(selectedActivities.map(a => a.id)),
    [selectedActivities]
  );

  const availableActivities = useMemo(
    () => ACTIVITY_TEMPLATES.filter(a => !addSelectedIds.has(a.id)),
    [addSelectedIds]
  );

  const availableSkills = useMemo(
    () => OSRS_SKILLS.filter(s => availableActivities.some(a => a.skillId === s)),
    [availableActivities]
  );

  const addBrowseItems = useMemo<BrowseItem[]>(() => {
    const filtered = filterSkill
      ? availableActivities.filter(a => a.skillId === filterSkill)
      : availableActivities;

    if (filterSkill) {
      return filtered.map(a => ({ type: 'activity', activity: a }));
    }

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
    setAddStep('cadence-select');
  };

  const handleAddBack = () => {
    if (addStep === 'cadence-select') { setAddStep('browse'); setSelectedActivity(null); }
    else if (addStep === 'confirm') setAddStep('cadence-select');
  };

  const handleAddConfirm = async () => {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // MANAGE MODE
  // ─────────────────────────────────────────────────────────────────────────────

  const manageBrowseItems = useMemo<BrowseItem[]>(() => {
    let filtered = ACTIVITY_TEMPLATES;

    if (showSelectedOnly) {
      filtered = filtered.filter(a => pendingSelected.has(a.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a => a.activityName.toLowerCase().includes(q));
    }

    if (filterSkill) {
      return filtered
        .filter(a => a.skillId === filterSkill)
        .map(a => ({ type: 'activity', activity: a }));
    }

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
  }, [searchQuery, filterSkill, showSelectedOnly, pendingSelected]);

  const toggleManageActivity = (id: string) => {
    setPendingSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!pendingCadences[id]) {
          const tmpl = ACTIVITY_TEMPLATES.find(a => a.id === id);
          if (tmpl) {
            setPendingCadences(c => ({
              ...c,
              [id]: tmpl.defaultCadence ?? tmpl.availableCadences[0],
            }));
          }
        }
      }
      return next;
    });
  };

  const handleManageBrowseAction = () => {
    if (!hasChanges) { resetAndClose(); return; }
    if (toAdd.length > 0) { setManageStep('cadence'); return; }
    Alert.alert(
      'Remove Activities',
      `Remove ${toRemove.length} activit${toRemove.length === 1 ? 'y' : 'ies'} from your tracker?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: handleManageConfirm },
      ]
    );
  };

  const handleManageConfirm = async () => {
    setIsSubmitting(true);
    try {
      for (const id of toAdd) {
        const tmpl = ACTIVITY_TEMPLATES.find(a => a.id === id);
        const cadence = pendingCadences[id] ?? tmpl?.defaultCadence ?? tmpl?.availableCadences[0] ?? 'weekly';
        await onActivityAdded(id, cadence as Cadence);
      }
      if (onActivityRemoved) {
        for (const id of toRemove) {
          await onActivityRemoved(id);
        }
      }
      resetAndClose();
    } catch (err) {
      console.error('Error saving activity changes:', err);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Browse action button label ─────────────────────────────────────────────
  const browseActionLabel = !hasChanges
    ? 'Done'
    : toAdd.length > 0 && toRemove.length > 0
    ? `Next  → (+${toAdd.length} / -${toRemove.length})`
    : toAdd.length > 0
    ? `Next  → (+${toAdd.length})`
    : `Remove ${toRemove.length}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: ADD MODE
  // ─────────────────────────────────────────────────────────────────────────────

  const renderAddBrowse = () => (
    <View style={styles.stepContainer}>
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
          <Text style={[styles.filterChipText, filterSkill === null && styles.filterChipTextActive]}>ALL</Text>
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

      {addBrowseItems.length === 0 ? (
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
          {addBrowseItems.map(item => {
            if (item.type === 'header') {
              return (
                <View key={`h-${item.skill}`} style={styles.skillSectionHeader}>
                  <Image source={SKILL_ICONS[item.skill]} style={styles.skillSectionIcon} resizeMode="contain" />
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
                <Image source={SKILL_ICONS[activity.skillId]} style={styles.activityRowIcon} resizeMode="contain" />
                <View style={styles.activityRowBody}>
                  <Text style={styles.activityRowName}>{activity.activityName}</Text>
                  <Text style={styles.activityRowDesc} numberOfLines={1}>{activity.description}</Text>
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

  const renderCadenceSelect = () => (
    <View style={styles.stepContainer}>
      {activityTemplate && (
        <View style={styles.previewCard}>
          <Image source={SKILL_ICONS[activityTemplate.skillId]} style={styles.previewIcon} resizeMode="contain" />
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

  const renderAddRemove = () => (
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
                  <Image source={SKILL_ICONS[activity.skillId]} style={styles.removeRowIcon} resizeMode="contain" />
                  <View style={styles.removeRowBody}>
                    <Text style={styles.removeRowName}>{template?.activityName}</Text>
                    <View style={styles.removeRowMeta}>
                      <Text style={styles.removeRowSkillTag}>{activity.skillId}</Text>
                      <Text style={styles.removeRowCadenceTag}>{getCadenceLabel(activity.cadence)}</Text>
                      <Text style={styles.removeRowXPTag}>{activity.xpPerCompletion} XP</Text>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }, isRemoving && { opacity: 0.5 }]}
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
              style={({ pressed }) => [styles.removeAllBtn, pressed && { opacity: 0.7 }, isRemoving && { opacity: 0.5 }]}
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

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: MANAGE MODE
  // ─────────────────────────────────────────────────────────────────────────────

  const renderManageBrowse = () => (
    <View style={styles.stepContainer}>
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search activities..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Skill filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        <Pressable
          style={[styles.filterChip, !showSelectedOnly && filterSkill === null && styles.filterChipActive]}
          onPress={() => { setFilterSkill(null); setShowSelectedOnly(false); }}
        >
          <Text style={[styles.filterChipText, !showSelectedOnly && filterSkill === null && styles.filterChipTextActive]}>ALL</Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, showSelectedOnly && styles.filterChipSelected]}
          onPress={() => { setShowSelectedOnly(s => !s); setFilterSkill(null); }}
        >
          <Text style={[styles.filterChipText, showSelectedOnly && styles.filterChipTextActive]}>
            SELECTED ({pendingSelected.size})
          </Text>
        </Pressable>
        {OSRS_SKILLS.map(skill => (
          <Pressable
            key={skill}
            style={[styles.filterChip, !showSelectedOnly && filterSkill === skill && styles.filterChipActive]}
            onPress={() => { setShowSelectedOnly(false); setFilterSkill(filterSkill === skill ? null : skill); }}
          >
            <Image source={SKILL_ICONS[skill]} style={styles.filterChipIcon} resizeMode="contain" />
            <Text style={[styles.filterChipText, !showSelectedOnly && filterSkill === skill && styles.filterChipTextActive]}>
              {skill.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Activity list with checkboxes */}
      <ScrollView style={styles.browseList} showsVerticalScrollIndicator={false}>
        {manageBrowseItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>Try a different search or filter.</Text>
          </View>
        ) : (
          manageBrowseItems.map(item => {
            if (item.type === 'header') {
              return (
                <View key={`h-${item.skill}`} style={styles.skillSectionHeader}>
                  <Image source={SKILL_ICONS[item.skill]} style={styles.skillSectionIcon} resizeMode="contain" />
                  <Text style={styles.skillSectionText}>{item.skill.toUpperCase()}</Text>
                </View>
              );
            }
            const { activity } = item;
            const isChecked = pendingSelected.has(activity.id);
            return (
              <TouchableOpacity
                key={activity.id}
                style={[styles.activityRow, isChecked && styles.activityRowChecked]}
                onPress={() => toggleManageActivity(activity.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.manageCheckbox, isChecked && styles.manageCheckboxChecked]}>
                  {isChecked && <Text style={styles.manageCheckmark}>✓</Text>}
                </View>
                <Image source={SKILL_ICONS[activity.skillId]} style={styles.activityRowIcon} resizeMode="contain" />
                <View style={styles.activityRowBody}>
                  <Text style={[styles.activityRowName, isChecked && styles.activityRowNameChecked]}>
                    {activity.activityName}
                  </Text>
                  <Text style={styles.activityRowDesc} numberOfLines={1}>{activity.description}</Text>
                </View>
                <Text style={styles.activityRowXP}>{activity.baseXP} XP</Text>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );

  const renderManageCadence = () => {
    const newActivities = toAdd
      .map(id => ACTIVITY_TEMPLATES.find(a => a.id === id))
      .filter((a): a is ActivityTemplate => !!a);

    return (
      <View style={styles.stepContainer}>
        <View style={styles.cadenceStepHeader}>
          <Text style={styles.cadenceStepTitle}>Set Your Schedule</Text>
          <Text style={styles.cadenceStepSubtitle}>How often will you train each new activity?</Text>
        </View>

        <ScrollView contentContainerStyle={styles.cadenceCardList}>
          {newActivities.map(activity => {
            const chosen = pendingCadences[activity.id] ?? activity.defaultCadence ?? activity.availableCadences[0];
            const skillColor = SKILL_COLORS[activity.skillId] ?? colors.gold;
            return (
              <View key={activity.id} style={[styles.cadenceCard, { borderLeftColor: skillColor }]}>
                <View style={styles.cadenceCardHeader}>
                  <Image source={SKILL_ICONS[activity.skillId]} style={styles.cadenceSkillIcon} resizeMode="contain" />
                  <Text style={styles.cadenceCardName}>{activity.activityName}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cadencePills}>
                  {activity.availableCadences.map(cadence => {
                    const active = cadence === chosen;
                    return (
                      <TouchableOpacity
                        key={cadence}
                        style={[styles.cadencePill, active && styles.cadencePillActive]}
                        onPress={() => setPendingCadences(prev => ({ ...prev, [activity.id]: cadence }))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.cadencePillText, active && styles.cadencePillTextActive]}>
                          {getCadenceLabel(cadence)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            );
          })}

          {toRemove.length > 0 && (
            <View style={styles.manageSummaryBlock}>
              <Text style={styles.manageSummaryLabel}>ALSO REMOVING</Text>
              {toRemove.map(id => {
                const tmpl = ACTIVITY_TEMPLATES.find(a => a.id === id);
                return (
                  <Text key={id} style={styles.manageSummaryItem}>· {tmpl?.activityName ?? id}</Text>
                );
              })}
            </View>
          )}
          <View style={{ height: 16 }} />
        </ScrollView>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const headerTitle = mode === 'manage' ? 'Activity Manager' : 'Activity Manager';
  const headerSubtitle = mode === 'manage'
    ? (manageStep === 'browse' ? 'Select activities to track' : 'Set cadence for new activities')
    : (addStep !== 'browse' ? (addStep === 'cadence-select' ? 'Step 1 of 2' : 'Step 2 of 2') : null);

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
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            {headerSubtitle && <Text style={styles.headerProgress}>{headerSubtitle}</Text>}
          </View>
        </View>

        {/* Add mode: tabs */}
        {mode === 'add' && (
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, addTab === 'add' && styles.tabActive]}
              onPress={() => { setAddTab('add'); setAddStep('browse'); setFilterSkill(null); }}
            >
              <Text style={[styles.tabText, addTab === 'add' && styles.tabTextActive]}>+ ADD ACTIVITY</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, addTab === 'remove' && styles.tabActive]}
              onPress={() => setAddTab('remove')}
            >
              <Text style={[styles.tabText, addTab === 'remove' && styles.tabTextActive]}>- REMOVE ACTIVITY</Text>
            </Pressable>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {mode === 'manage'
            ? manageStep === 'browse'
              ? renderManageBrowse()
              : renderManageCadence()
            : addTab === 'remove'
            ? renderAddRemove()
            : addStep === 'browse'
            ? renderAddBrowse()
            : addStep === 'cadence-select'
            ? renderCadenceSelect()
            : renderConfirm()}
        </View>

        {/* Footer */}
        {mode === 'manage' ? (
          <View style={styles.footer}>
            {manageStep === 'cadence' && (
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setManageStep('browse')}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.btnSecondaryText}>← Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btnPrimary, isSubmitting && styles.btnDisabled]}
              onPress={manageStep === 'browse' ? handleManageBrowseAction : handleManageConfirm}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              {isSubmitting
                ? <ActivityIndicator color={colors.background} size="small" />
                : <Text style={styles.btnPrimaryText}>
                    {manageStep === 'cadence' ? 'Confirm Changes' : browseActionLabel}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        ) : mode === 'add' && addTab === 'add' && addStep !== 'browse' ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={handleAddBack}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.btnSecondaryText}>← Back</Text>
            </TouchableOpacity>
            {addStep === 'confirm' ? (
              <TouchableOpacity
                style={[styles.btnPrimary, (isSubmitting || loading) && styles.btnDisabled]}
                onPress={handleAddConfirm}
                disabled={isSubmitting || loading}
                activeOpacity={0.7}
              >
                {isSubmitting || loading
                  ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.btnPrimaryText}>Add Activity</Text>
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => setAddStep('confirm')}
                activeOpacity={0.7}
              >
                <Text style={styles.btnPrimaryText}>Continue →</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.surface,
    ...bevel.raised,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  closeButtonText: { fontFamily: fonts.display, fontSize: 24, color: colors.gold },
  headerBody: { flex: 1 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 12, color: colors.gold },
  headerProgress: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary, marginTop: 3 },

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
  tabActive: { borderBottomColor: colors.gold },
  tabText: { fontFamily: fonts.heading, fontSize: 7, color: colors.textMuted },
  tabTextActive: { color: colors.gold },

  // ── Layout ───────────────────────────────────────────────────────────────────
  content: { flex: 1 },
  stepContainer: { flex: 1 },

  // ── Search ───────────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 2,
    borderBottomColor: colors.bevelDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...bevel.inset,
  },
  searchClear: { padding: 6 },
  searchClearText: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },

  // ── Filter chips ─────────────────────────────────────────────────────────────
  filterBar: { backgroundColor: colors.surfaceSunken, flexGrow: 0, borderBottomWidth: 2, borderBottomColor: colors.bevelDark },
  filterBarContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, flexDirection: 'row', alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface, ...bevel.raised, gap: 5 },
  filterChipActive: { backgroundColor: colors.gold, borderTopColor: '#f0d060', borderLeftColor: '#f0d060', borderBottomColor: colors.bevelDark, borderRightColor: colors.bevelDark },
  filterChipSelected: { backgroundColor: colors.surfaceRaised, borderTopColor: colors.gold, borderLeftColor: colors.gold, borderBottomColor: colors.goldDark, borderRightColor: colors.goldDark },
  filterChipIcon: { width: 14, height: 14 },
  filterChipText: { fontFamily: fonts.heading, fontSize: 7, color: colors.textSecondary },
  filterChipTextActive: { color: colors.background },

  // ── Browse list ───────────────────────────────────────────────────────────────
  browseList: { flex: 1, paddingTop: 4 },
  skillSectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 5, backgroundColor: colors.background, marginTop: 4, gap: 6 },
  skillSectionIcon: { width: 14, height: 14, opacity: 0.7 },
  skillSectionText: { fontFamily: fonts.heading, fontSize: 7, color: colors.textSecondary, letterSpacing: 1 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: 12, marginTop: 4, backgroundColor: colors.surface, ...bevel.raised, gap: 10 },
  activityRowChecked: { backgroundColor: `${colors.gold}14`, borderTopColor: `${colors.gold}60`, borderLeftColor: `${colors.gold}60` },
  activityRowIcon: { width: 26, height: 26 },
  activityRowBody: { flex: 1 },
  activityRowName: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, marginBottom: 2 },
  activityRowNameChecked: { color: colors.gold },
  activityRowDesc: { fontFamily: fonts.display, fontSize: 14, color: colors.textMuted },
  activityRowXP: { fontFamily: fonts.display, fontSize: 16, color: colors.gold, minWidth: 56, textAlign: 'right' },

  // ── Manage checkboxes ─────────────────────────────────────────────────────────
  manageCheckbox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.textMuted, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' },
  manageCheckboxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
  manageCheckmark: { fontFamily: fonts.display, fontSize: 14, color: colors.background, lineHeight: 16 },

  // ── Cadence ───────────────────────────────────────────────────────────────────
  previewCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surface, ...bevel.raised, gap: 10 },
  previewIcon: { width: 28, height: 28 },
  previewBody: { flex: 1 },
  previewName: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary },
  previewSkill: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },
  stepSectionLabel: { fontFamily: fonts.heading, fontSize: 8, color: colors.textSecondary, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, letterSpacing: 1 },
  optionsList: { flex: 1, paddingHorizontal: 12 },
  cadenceOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, marginTop: 4, backgroundColor: colors.surface, ...bevel.raised },
  cadenceOptionSelected: { backgroundColor: colors.surfaceRaised, borderTopColor: colors.gold, borderLeftColor: colors.gold, borderBottomColor: colors.goldDark, borderRightColor: colors.goldDark },
  cadenceOptionBody: { flex: 1 },
  cadenceOptionLabel: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, marginBottom: 2 },
  cadenceOptionLabelSelected: { color: colors.gold },
  cadenceOptionXP: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },
  cadenceOptionXPSelected: { color: colors.textSecondary },
  checkmark: { fontFamily: fonts.display, fontSize: 22, color: colors.gold, marginLeft: 12 },
  cadenceDivider: { height: 1, backgroundColor: colors.bevelDark, marginHorizontal: 0, marginTop: 16, marginBottom: 4 },

  // ── Manage cadence (onboarding-style) ────────────────────────────────────────
  cadenceStepHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  cadenceStepTitle: { fontFamily: fonts.heading, fontSize: 12, color: colors.gold, marginBottom: 4 },
  cadenceStepSubtitle: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },
  cadenceCardList: { paddingHorizontal: 12, paddingTop: 4 },
  cadenceCard: {
    backgroundColor: colors.surface,
    ...bevel.raised,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
  },
  cadenceCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cadenceSkillIcon: { width: 20, height: 20 },
  cadenceCardName: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, flex: 1 },
  cadencePills: { gap: 6, paddingRight: 4 },
  cadencePill: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.surface, ...bevel.raised },
  cadencePillActive: { backgroundColor: colors.gold, borderTopColor: '#f0d060', borderLeftColor: '#f0d060', borderBottomColor: colors.bevelDark, borderRightColor: colors.bevelDark },
  cadencePillText: { fontFamily: fonts.heading, fontSize: 7, color: colors.textSecondary },
  cadencePillTextActive: { color: colors.background },

  // ── Manage cadence summary ────────────────────────────────────────────────────
  manageSummaryBlock: { marginTop: 16, marginHorizontal: 12, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.surfaceSunken, ...bevel.inset },
  manageSummaryLabel: { fontFamily: fonts.heading, fontSize: 7, color: colors.textMuted, letterSpacing: 1, marginBottom: 8 },
  manageSummaryItem: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary, marginBottom: 4 },

  // ── Confirm (add mode) ────────────────────────────────────────────────────────
  confirmList: { paddingHorizontal: 12, paddingTop: 4 },
  confirmCard: { backgroundColor: colors.surface, ...bevel.raised, paddingVertical: 10, paddingHorizontal: 12, marginTop: 4 },
  confirmCardHighlight: { backgroundColor: colors.surfaceRaised, borderTopColor: colors.gold, borderLeftColor: colors.gold, borderBottomColor: colors.goldDark, borderRightColor: colors.goldDark },
  confirmCardLabel: { fontFamily: fonts.heading, fontSize: 7, color: colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  confirmCardValue: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary },
  confirmCardDesc: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary, marginTop: 2 },
  confirmXPValue: { fontFamily: fonts.display, fontSize: 28, color: colors.gold },

  // ── Remove (add mode) ─────────────────────────────────────────────────────────
  removeList: { flex: 1, paddingTop: 4, paddingHorizontal: 12 },
  removeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, marginTop: 4, backgroundColor: colors.surface, ...bevel.raised, gap: 10 },
  removeRowIcon: { width: 26, height: 26 },
  removeRowBody: { flex: 1 },
  removeRowName: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, marginBottom: 5 },
  removeRowMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  removeRowSkillTag: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary, backgroundColor: colors.surfaceSunken, paddingHorizontal: 6, paddingVertical: 1 },
  removeRowCadenceTag: { fontFamily: fonts.display, fontSize: 13, color: colors.gold, backgroundColor: '#3a3a2a', paddingHorizontal: 6, paddingVertical: 1 },
  removeRowXPTag: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary, backgroundColor: '#3a3a2a', paddingHorizontal: 6, paddingVertical: 1 },
  removeBtn: { width: 30, height: 30, backgroundColor: colors.destructive, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderTopColor: '#dd3333', borderLeftColor: '#dd3333', borderBottomColor: colors.bevelDark, borderRightColor: colors.bevelDark },
  removeBtnText: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, lineHeight: 20 },
  removeAllBar: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 2, borderTopColor: colors.bevelDark, backgroundColor: colors.surfaceSunken },
  removeAllBtn: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.destructive, alignItems: 'center', borderWidth: 2, borderTopColor: '#dd3333', borderLeftColor: '#dd3333', borderBottomColor: colors.bevelDark, borderRightColor: colors.bevelDark },
  removeAllBtnText: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary },

  // ── Empty ─────────────────────────────────────────────────────────────────────
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 10, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptyText: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary, textAlign: 'center' },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 10, borderTopWidth: 2, borderTopColor: colors.bevelDark, backgroundColor: colors.surfaceSunken },
  btnSecondary: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.surface, ...bevel.raised, justifyContent: 'center', alignItems: 'center' },
  btnSecondaryText: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary },
  btnPrimary: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.gold, borderWidth: 2, borderTopColor: '#f0d060', borderLeftColor: '#f0d060', borderBottomColor: colors.bevelDark, borderRightColor: colors.bevelDark, justifyContent: 'center', alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.display, fontSize: 20, color: colors.background },
  btnDisabled: { opacity: 0.5 },
});
