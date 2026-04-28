import React, { useMemo, useState } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useActivities } from '../context/ActivitiesContext';
import { useSkills } from '../context/SkillsContext';
import { ActivityCompletion } from '../types';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { calculateLevel, formatXP } from '../utils/xpCalculations';
import { SKILL_COLORS } from '../constants/osrsSkills';
import { ProgressBar } from '../components/ProgressBar';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

// ─── helpers ─────────────────────────────────────────────────────────────────

function derivedUsername(email: string): string {
  const prefix = email.split('@')[0];
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sectionLabel(date: Date): string {
  const today = dayStart(new Date());
  const d = dayStart(date);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── component ───────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const { user, updateDisplayName } = useAuth();
  const { completions, userActivities, loading } = useActivities();
  const { skills } = useSkills();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // ── derived data ───────────────────────────────────────────────────────────

  const displayName = user?.displayName?.trim()
    ? user.displayName
    : derivedUsername(user?.email ?? 'adventurer');

  const trainedSkills = useMemo(
    () => skills
      .filter(s => s.totalXP > 0)
      .sort((a, b) => b.totalXP - a.totalXP),
    [skills]
  );

  const totalLevel = useMemo(
    () => trainedSkills.reduce((sum, s) => sum + calculateLevel(s.totalXP), 0),
    [trainedSkills]
  );

  const totalXP = useMemo(
    () => skills.reduce((sum, s) => sum + s.totalXP, 0),
    [skills]
  );

  const longestStreak = useMemo(
    () => userActivities.reduce((max, a) => Math.max(max, a.longestStreak ?? 0), 0),
    [userActivities]
  );

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  // ── activity log sections ──────────────────────────────────────────────────

  const sections = useMemo(() => {
    const groups = new Map<string, ActivityCompletion[]>();
    for (const c of completions) {
      const label = sectionLabel(new Date(c.completedAt));
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(c);
    }
    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [completions]);

  // ── name editing ───────────────────────────────────────────────────────────

  const handleEditName = () => {
    setNameInput(user?.displayName ?? '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid name', 'Please enter a name.');
      return;
    }
    try {
      setSavingName(true);
      await updateDisplayName(trimmed);
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Failed to save name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  // ── render pieces ──────────────────────────────────────────────────────────

  const renderListHeader = () => (
    <>
      {/* ── Hero card ── */}
      <View style={styles.heroCard}>
        {/* Avatar placeholder — sized/styled for a future character sprite swap */}
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarEmoji}>🧙</Text>
        </View>

        {/* Name + edit */}
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              autoCapitalize="words"
              maxLength={24}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              style={styles.nameSaveButton}
              onPress={handleSaveName}
              disabled={savingName}
            >
              <Text style={styles.nameSaveText}>{savingName ? '…' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nameCancelButton}
              onPress={() => setEditingName(false)}
              disabled={savingName}
            >
              <Text style={styles.nameCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.nameRow} onPress={handleEditName}>
            <Text style={styles.characterName}>{displayName}</Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        )}

        {/* Total level */}
        <Text style={styles.totalLevel}>
          {totalLevel > 0 ? `Total Level ${totalLevel}` : 'Level 1 Adventurer'}
        </Text>

        {/* Member since */}
        <Text style={styles.memberSince}>Adventurer since {memberSince}</Text>
      </View>

      {/* ── Stats strip (3 cells matching design spec) ── */}
      <View style={styles.statsStrip}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{formatXP(totalXP)}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </View>
        <View style={[styles.statCell, styles.statBorder]}>
          <Text style={styles.statValue}>{completions.length}</Text>
          <Text style={styles.statLabel}>Completions</Text>
        </View>
        <View style={[styles.statCell, styles.statBorder]}>
          <Text style={styles.statValue}>{longestStreak > 0 ? `${longestStreak}w` : '—'}</Text>
          <Text style={styles.statLabel}>Best Streak</Text>
        </View>
      </View>

      {/* ── Top Skills ── */}
      {trainedSkills.length > 0 && (
        <View style={styles.topSkillsSection}>
          <Text style={styles.sectionTitle}>Skills</Text>
          {trainedSkills.slice(0, 6).map(skill => {
            const level = calculateLevel(skill.totalXP);
            // Progress within current level (0–1)
            const { XP_TABLE } = require('../constants/xpTable');
            const currentLevelXP = XP_TABLE[level] ?? 0;
            const nextLevelXP = XP_TABLE[Math.min(level + 1, 99)] ?? currentLevelXP;
            const progress = nextLevelXP === currentLevelXP
              ? 1
              : (skill.totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP);

            return (
              <View key={skill.id} style={styles.skillRow}>
                <Text style={styles.skillName}>{skill.skillName}</Text>
                <View style={styles.skillProgress}>
                  <ProgressBar
                    progress={Math.min(progress * 100, 100)}
                    height={5}
                    barColor={colors.gold}
                    backgroundColor={colors.background}
                  />
                </View>
                <Text style={styles.skillLevel}>{level}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Activity log heading ── */}
      {sections.length > 0 && (
        <Text style={styles.sectionTitle} >Activity Log</Text>
      )}
    </>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.dateSectionHeader}>
            <Text style={styles.dateSectionText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const template = ACTIVITY_TEMPLATES.find(t => t.id === item.activityId);
          const name = template?.activityName ?? item.activityId;
          return (
            <View style={styles.completionRow}>
              <View style={styles.completionInfo}>
                <Text style={styles.completionName}>{name}</Text>
                <View style={styles.completionMeta}>
                  {(() => {
                    const c = SKILL_COLORS[item.skillId] ?? '#888888';
                    return (
                      <View style={[styles.skillBadge, { backgroundColor: `${c}22`, borderColor: `${c}88` }]}>
                        <Text style={[styles.skillBadgeText, { color: c }]}>{item.skillId}</Text>
                      </View>
                    );
                  })()}
                  <Text style={styles.completionTime}>{formatTime(new Date(item.completedAt))}</Text>
                </View>
              </View>
              <Text style={styles.xpEarned}>+{item.xpEarned} XP</Text>
            </View>
          );
        }}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          trainedSkills.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No activity yet.</Text>
              <Text style={styles.emptySubtext}>Complete your first habit to see your progress here.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, ...bevel.raised },
  headerTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.gold },
  listContent: { paddingBottom: 40 },

  // Hero card
  heroCard: { backgroundColor: colors.surface, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, marginBottom: 4, ...bevel.raised },
  avatarContainer: { width: 54, height: 54, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: 14, ...bevel.inset },
  avatarEmoji: { fontSize: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  characterName: { fontFamily: fonts.display, fontSize: 28, color: colors.textPrimary },
  editIcon: { fontSize: 14 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, width: '100%', paddingHorizontal: 16 },
  nameInput: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary, textAlign: 'center', ...bevel.inset },
  nameSaveButton: { backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 8, ...bevel.raised },
  nameSaveText: { fontFamily: fonts.display, fontSize: 18, color: colors.background },
  nameCancelButton: { paddingHorizontal: 6, paddingVertical: 8 },
  nameCancelText: { fontFamily: fonts.display, fontSize: 20, color: colors.textSecondary },
  totalLevel: { fontFamily: fonts.display, fontSize: 20, color: colors.gold, marginBottom: 2 },
  memberSince: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },

  // Stats strip
  statsStrip: { flexDirection: 'row', backgroundColor: colors.surface, marginBottom: 4, ...bevel.raised },
  statCell: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  statBorder: { borderLeftWidth: 2, borderLeftColor: colors.bevelDark },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.gold, marginBottom: 1 },
  statLabel: { fontFamily: fonts.heading, fontSize: 7, color: colors.textSecondary, textTransform: 'uppercase' },

  // Top skills
  topSkillsSection: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4, ...bevel.raised },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 9, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 10, paddingHorizontal: 16, paddingTop: 14 },
  skillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  skillName: { fontFamily: fonts.display, width: 100, fontSize: 17, color: colors.textPrimary },
  skillProgress: { flex: 1 },
  skillLevel: { fontFamily: fonts.display, width: 28, textAlign: 'right', fontSize: 20, color: colors.gold },

  // Activity log
  dateSectionHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 5, backgroundColor: colors.background },
  dateSectionText: { fontFamily: fonts.heading, fontSize: 8, color: colors.textSecondary, textTransform: 'uppercase' },
  completionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: 8, marginTop: 3, backgroundColor: colors.surface, ...bevel.raised },
  completionInfo: { flex: 1, marginRight: 12 },
  completionName: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary, marginBottom: 3 },
  completionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skillBadge: { paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  skillBadgeText: { fontFamily: fonts.display, fontSize: 14 },
  completionTime: { fontFamily: fonts.display, fontSize: 14, color: colors.textSecondary },
  xpEarned: { fontFamily: fonts.display, fontSize: 20, color: colors.gold },

  // Empty
  emptyContainer: { paddingTop: 40, alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { fontFamily: fonts.display, fontSize: 20, color: colors.textSecondary, marginBottom: 6 },
  emptySubtext: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
