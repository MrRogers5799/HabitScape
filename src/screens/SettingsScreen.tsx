/**
 * Settings Screen (Phase 1 + Phase 2)
 * 
 * Provides user settings and account management.
 * Phase 1: Logout button, basic user info
 * Phase 2: Activity management wizard
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useActivities } from '../context/ActivitiesContext';
import { ActivitySelectionWizard } from '../components/ActivitySelectionWizard';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { colors } from '../constants/colors';
import { Cadence } from '../types';
import { COMMON_TIMEZONES } from '../constants/timezones';

/**
 * Settings Screen Component
 */
export function SettingsScreen() {
  const { user, logOut, updateTimezone, changePassword } = useAuth();
  const { userActivities, addActivity, removeActivity } = useActivities();
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);

  // Timezone picker state
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);

  // Password change state
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleLogOut = async () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    try {
      setLoggingOut(true);
      setConfirmLogout(false);
      await logOut();
    } catch (err) {
      setLoggingOut(false);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  /**
   * Handle activity added from wizard
   */
  const handleActivityAdded = async (activityTemplateId: string, cadence: Cadence) => {
    try {
      setAddingActivity(true);
      console.log(`📝 Adding activity ${activityTemplateId} with cadence ${cadence}`);
      await addActivity(activityTemplateId, cadence);
      console.log('✅ Activity added successfully');
    } catch (err) {
      console.error('❌ Error adding activity:', err);
      Alert.alert('Error', 'Failed to add activity. Please try again.');
    } finally {
      setAddingActivity(false);
    }
  };

  /**
   * Handle activity removed from wizard
   */
  const handleActivityRemoved = async (activityId: string) => {
    try {
      setAddingActivity(true);
      console.log(`🗑️ Removing activity ${activityId}`);
      await removeActivity(activityId);
      console.log('✅ Activity removed successfully');
    } catch (err) {
      console.error('❌ Error removing activity:', err);
      Alert.alert('Error', 'Failed to remove activity. Please try again.');
    } finally {
      setAddingActivity(false);
    }
  };

  const handleSelectTimezone = async (timezone: string) => {
    setTimezonePickerVisible(false);
    if (timezone === user?.timezone) return;
    try {
      setSavingTimezone(true);
      await updateTimezone(timezone);
    } catch {
      Alert.alert('Error', 'Failed to update timezone. Please try again.');
    } finally {
      setSavingTimezone(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    try {
      setSavingPassword(true);
      await changePassword(currentPassword, newPassword);
      setPasswordFormOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password updated successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.';
      const isWrongPassword = msg.includes('invalid-credential') || msg.includes('wrong-password');
      setPasswordError(isWrongPassword ? 'Current password is incorrect.' : msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const cancelPasswordChange = () => {
    setPasswordFormOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  return (
    <View style={styles.container}>
      {/* Fixed header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Scrollable content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Activity Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activities</Text>

          <View style={styles.activityStatsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Selected</Text>
              <Text style={styles.statValue}>{userActivities.length}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Available</Text>
              <Text style={styles.statValue}>{ACTIVITY_TEMPLATES.length}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.manageButton,
              pressed && styles.manageButtonPressed,
            ]}
            onPress={() => setWizardVisible(true)}
          >
            <Text style={styles.manageButtonText}>⚙️ Manage Activities</Text>
          </Pressable>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          {/* Email — read-only */}
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValue}>{user?.email}</Text>
          </View>

          {/* Timezone */}
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Timezone</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingValue}>{user?.timezone}</Text>
              <Pressable
                onPress={() => setTimezonePickerVisible(true)}
                disabled={savingTimezone}
                style={({ pressed }) => [styles.inlineButton, pressed && styles.inlineButtonPressed]}
              >
                <Text style={styles.inlineButtonText}>
                  {savingTimezone ? 'Saving…' : 'Change'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Password */}
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Password</Text>
            {!passwordFormOpen ? (
              <Pressable
                onPress={() => setPasswordFormOpen(true)}
                style={({ pressed }) => [styles.inlineButton, pressed && styles.inlineButtonPressed]}
              >
                <Text style={styles.inlineButtonText}>Change Password</Text>
              </Pressable>
            ) : (
              <View style={styles.passwordForm}>
                {passwordError && (
                  <Text style={styles.fieldError}>{passwordError}</Text>
                )}
                <TextInput
                  style={styles.textInput}
                  placeholder="Current password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="New password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
                <View style={styles.formButtons}>
                  <Pressable
                    onPress={handleChangePassword}
                    disabled={savingPassword}
                    style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
                  >
                    <Text style={styles.saveButtonText}>
                      {savingPassword ? 'Saving…' : 'Save'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={cancelPasswordChange} style={styles.cancelInlineButton}>
                    <Text style={styles.cancelInlineText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Timezone Picker Modal */}
        <Modal
          visible={timezonePickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setTimezonePickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Timezone</Text>
                <Pressable onPress={() => setTimezonePickerVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.timezoneList}>
                {COMMON_TIMEZONES.map(tz => (
                  <TouchableOpacity
                    key={tz.value}
                    style={[
                      styles.timezoneOption,
                      user?.timezone === tz.value && styles.timezoneOptionSelected,
                    ]}
                    onPress={() => handleSelectTimezone(tz.value)}
                  >
                    <Text style={[
                      styles.timezoneLabel,
                      user?.timezone === tz.value && styles.timezoneLabelSelected,
                    ]}>
                      {tz.label}
                    </Text>
                    <Text style={styles.timezoneValue}>{tz.value}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Version</Text>
            <Text style={styles.settingValue}>1.0.0 (MVP)</Text>
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>App</Text>
            <Text style={styles.settingValue}>HabitScape — Train your real-life skills</Text>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.logoutContainer}>
          {confirmLogout && (
            <Text style={styles.logoutConfirmText}>Tap again to confirm log out</Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              confirmLogout && styles.logoutButtonConfirm,
              pressed && styles.logoutButtonPressed,
              loggingOut && styles.logoutButtonDisabled,
            ]}
            onPress={handleLogOut}
            disabled={loggingOut}
          >
            <Text style={styles.logoutButtonText}>
              {loggingOut ? 'Logging Out...' : confirmLogout ? '⚠️ Confirm Log Out' : 'Log Out'}
            </Text>
          </Pressable>
          {confirmLogout && (
            <Pressable style={styles.cancelButton} onPress={() => setConfirmLogout(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>

      {/* Activity Selection Wizard Modal */}
      <ActivitySelectionWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        selectedActivities={userActivities}
        onActivityAdded={handleActivityAdded}
        onActivityRemoved={handleActivityRemoved}
        loading={addingActivity}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  section: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  activityStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  manageButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.gold,
    borderRadius: 6,
    alignItems: 'center',
  },
  manageButtonPressed: {
    backgroundColor: colors.goldDark,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  settingItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  settingValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  inlineButtonPressed: {
    opacity: 0.7,
  },
  inlineButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold,
  },
  passwordForm: {
    marginTop: 4,
    gap: 8,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  fieldError: {
    fontSize: 12,
    color: colors.error,
    marginBottom: 4,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  cancelInlineButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelInlineText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Timezone modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 16,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  timezoneList: {
    paddingVertical: 8,
  },
  timezoneOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  timezoneOptionSelected: {
    backgroundColor: colors.background,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  timezoneLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  timezoneLabelSelected: {
    color: colors.gold,
  },
  timezoneValue: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  logoutContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 8,
  },
  logoutConfirmText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  logoutButton: {
    backgroundColor: colors.destructive,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonConfirm: {
    backgroundColor: colors.destructiveDark,
  },
  logoutButtonPressed: {
    opacity: 0.85,
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
