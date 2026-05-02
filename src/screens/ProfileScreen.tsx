import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useActivities } from '../context/ActivitiesContext';
import { useSkills } from '../context/SkillsContext';
import { calculateLevel, formatXP } from '../utils/xpCalculations';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

function derivedUsername(email: string): string {
  const prefix = email.split('@')[0];
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateDisplayName, changePassword, logOut } = useAuth();
  const { completions, userActivities } = useActivities();
  const { skills } = useSkills();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // ── derived stats ──────────────────────────────────────────────────────────

  const displayName = user?.displayName?.trim()
    ? user.displayName
    : derivedUsername(user?.email ?? 'adventurer');

  const trainedSkills = skills.filter(s => s.totalXP > 0);

  const totalLevel = trainedSkills.reduce((sum, s) => sum + calculateLevel(s.totalXP), 0);
  const totalXP = skills.reduce((sum, s) => sum + s.totalXP, 0);
  const longestStreak = userActivities.reduce((max, a) => Math.max(max, a.longestStreak ?? 0), 0);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

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

  // ── password change ────────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    if (!newPassword || !currentPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    try {
      setSavingPassword(true);
      await changePassword(currentPassword, newPassword);
      setChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    setChangingPassword(false);
    setConfirmingSignOut(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.gearButton} onPress={() => setSettingsOpen(true)}>
          <Text style={styles.gearIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Hero card ── */}
        <View style={styles.heroCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarEmoji}>🧙</Text>
          </View>

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

          <Text style={styles.totalLevel}>
            {totalLevel > 0 ? `Total Level ${totalLevel}` : 'Level 1 Adventurer'}
          </Text>
          <Text style={styles.memberSince}>Adventurer since {memberSince}</Text>
        </View>

        {/* ── Stats strip ── */}
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
            <Text style={styles.statValue}>{longestStreak > 0 ? `${longestStreak}` : '—'}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Settings modal ── */}
      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={closeSettings}
      >
        {/* Backdrop — fills screen, dismisses on tap */}
        <Pressable
          style={[StyleSheet.absoluteFillObject, styles.modalBackdrop]}
          onPress={closeSettings}
        />
        {/* Panel — rendered after backdrop so it sits on top */}
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View style={styles.settingsPanel}>
            <Text style={styles.settingsPanelTitle}>Settings</Text>

            {!changingPassword && !confirmingSignOut ? (
              <>
                <TouchableOpacity
                  style={styles.settingsRow}
                  onPress={() => setChangingPassword(true)}
                >
                  <Text style={styles.settingsRowText}>Change Password</Text>
                  <Text style={styles.settingsChevron}>›</Text>
                </TouchableOpacity>

                <View style={styles.settingsDivider} />

                <TouchableOpacity style={styles.settingsRow} onPress={() => setConfirmingSignOut(true)}>
                  <Text style={[styles.settingsRowText, styles.signOutText]}>Sign Out</Text>
                </TouchableOpacity>
              </>
            ) : changingPassword ? (
              <>
                <Text style={styles.settingsSubtitle}>Change Password</Text>

                <TextInput
                  style={styles.settingsInput}
                  placeholder="Current password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.settingsInput}
                  placeholder="New password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.settingsInput}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />

                <View style={styles.settingsActions}>
                  <TouchableOpacity
                    style={styles.settingsCancelBtn}
                    onPress={() => {
                      setChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    <Text style={styles.settingsCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.settingsSaveBtn}
                    onPress={handleChangePassword}
                    disabled={savingPassword}
                  >
                    <Text style={styles.settingsSaveText}>
                      {savingPassword ? '…' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : confirmingSignOut ? (
              <>
                <Text style={styles.settingsSubtitle}>Sign out?</Text>
                <View style={styles.settingsActions}>
                  <TouchableOpacity
                    style={styles.settingsCancelBtn}
                    onPress={() => setConfirmingSignOut(false)}
                  >
                    <Text style={styles.settingsCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingsSaveBtn, { backgroundColor: colors.destructive }]}
                    onPress={() => logOut()}
                  >
                    <Text style={styles.settingsSaveText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: {
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...bevel.raised,
  },
  headerTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.gold },
  gearButton: { padding: 4 },
  gearIcon: { fontSize: 20, color: colors.textSecondary },

  // Hero card
  heroCard: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 4,
    ...bevel.raised,
  },
  avatarContainer: {
    width: 54,
    height: 54,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    ...bevel.inset,
  },
  avatarEmoji: { fontSize: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  characterName: { fontFamily: fonts.display, fontSize: 28, color: colors.textPrimary },
  editIcon: { fontSize: 14 },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    width: '100%',
    paddingHorizontal: 16,
  },
  nameInput: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
    ...bevel.inset,
  },
  nameSaveButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...bevel.raised,
  },
  nameSaveText: { fontFamily: fonts.display, fontSize: 18, color: colors.background },
  nameCancelButton: { paddingHorizontal: 6, paddingVertical: 8 },
  nameCancelText: { fontFamily: fonts.display, fontSize: 20, color: colors.textSecondary },
  totalLevel: { fontFamily: fonts.display, fontSize: 20, color: colors.gold, marginBottom: 2 },
  memberSince: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginBottom: 4,
    ...bevel.raised,
  },
  statCell: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  statBorder: { borderLeftWidth: 2, borderLeftColor: colors.bevelDark },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.gold, marginBottom: 1 },
  statLabel: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  // Settings modal
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 12,
  },
  settingsPanel: {
    backgroundColor: colors.surface,
    width: 240,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...bevel.raised,
  },
  settingsPanelTitle: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  settingsSubtitle: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.gold,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingsRowText: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary },
  settingsChevron: { fontFamily: fonts.display, fontSize: 22, color: colors.textSecondary },
  signOutText: { color: colors.error },
  settingsDivider: { height: 1, backgroundColor: colors.bevelDark, marginVertical: 2 },
  settingsInput: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 8,
    ...bevel.inset,
  },
  settingsActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  settingsCancelBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  settingsCancelText: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary },
  settingsSaveBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.gold,
    ...bevel.raised,
  },
  settingsSaveText: { fontFamily: fonts.display, fontSize: 16, color: colors.background },
});
