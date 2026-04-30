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
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';
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
  const [privacyPolicyVisible, setPrivacyPolicyVisible] = useState(false);

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
            <Text style={styles.manageButtonText}>Manage Activities</Text>
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

          <Pressable
            style={({ pressed }) => [styles.settingItem, { marginTop: 4 }, pressed && { opacity: 0.7 }]}
            onPress={() => setPrivacyPolicyVisible(true)}
          >
            <Text style={styles.settingLabel}>Legal</Text>
            <Text style={styles.settingValue}>Privacy Policy</Text>
          </Pressable>
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
              {loggingOut ? 'LOGGING OUT...' : confirmLogout ? 'CONFIRM LOG OUT' : 'LOG OUT'}
            </Text>
          </Pressable>
          {confirmLogout && (
            <Pressable style={styles.cancelButton} onPress={() => setConfirmLogout(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>

      {/* Privacy Policy Modal */}
      <Modal
        visible={privacyPolicyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyPolicyVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <Pressable onPress={() => setPrivacyPolicyVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.policyUpdated}>Last updated: April 30, 2026</Text>

              <Text style={styles.policyHeading}>Information We Collect</Text>
              <Text style={styles.policyBody}>
                We collect the email address and display name you provide when creating an account. We also store the habit activities, completion records, streaks, XP, levels, workout templates, workout session logs, and timezone you create or set within the app.
              </Text>

              <Text style={styles.policyHeading}>How We Use Your Information</Text>
              <Text style={styles.policyBody}>
                Your data is used solely to provide the HabitScape experience — syncing your progress, calculating XP and levels, and displaying your history. We do not use your data for advertising or profiling.
              </Text>

              <Text style={styles.policyHeading}>Data Storage</Text>
              <Text style={styles.policyBody}>
                All data is stored securely using Google Firebase (Firestore and Authentication). Firebase's privacy policy is available at firebase.google.com/support/privacy.
              </Text>

              <Text style={styles.policyHeading}>Data Sharing</Text>
              <Text style={styles.policyBody}>
                We do not sell, trade, or share your personal information with third parties. Data is only shared with Firebase as necessary to operate the app, and as required by law.
              </Text>

              <Text style={styles.policyHeading}>Data Deletion</Text>
              <Text style={styles.policyBody}>
                You may request deletion of your account and all associated data at any time by contacting us at the email below. Data will be permanently deleted within 30 days.
              </Text>

              <Text style={styles.policyHeading}>Children's Privacy</Text>
              <Text style={styles.policyBody}>
                HabitScape is not intended for children under 13. We do not knowingly collect data from children under 13.
              </Text>

              <Text style={styles.policyHeading}>Changes to This Policy</Text>
              <Text style={styles.policyBody}>
                We may update this policy from time to time. Continued use of the app after changes are posted constitutes acceptance of the updated policy.
              </Text>

              <Text style={styles.policyHeading}>Contact</Text>
              <Text style={styles.policyBody}>rogersalec99@gmail.com</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, ...bevel.raised },
  headerTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.gold },
  section: { marginTop: 12 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 9, color: colors.gold, marginBottom: 10, paddingHorizontal: 16, paddingTop: 14 },

  // Activity stats
  activityStatsContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 10, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.surface, ...bevel.raised },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontFamily: fonts.heading, fontSize: 8, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' },
  statValue: { fontFamily: fonts.display, fontSize: 28, color: colors.gold },
  statDivider: { width: 2, height: 30, backgroundColor: colors.bevelDark, marginHorizontal: 12 },
  manageButton: { marginHorizontal: 12, marginBottom: 10, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.gold, alignItems: 'center', ...bevel.raised },
  manageButtonPressed: { opacity: 0.85 },
  manageButtonText: { fontFamily: fonts.display, fontSize: 21, color: colors.background },

  // Account items
  settingItem: { paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 12, marginTop: 4, backgroundColor: colors.surface, ...bevel.raised },
  settingLabel: { fontFamily: fonts.heading, fontSize: 8, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  settingValue: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, flex: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineButton: { paddingHorizontal: 12, paddingVertical: 6, ...bevel.raised },
  inlineButtonPressed: { opacity: 0.7 },
  inlineButtonText: { fontFamily: fonts.heading, fontSize: 8, color: colors.gold },
  passwordForm: { marginTop: 8, gap: 8 },
  textInput: { backgroundColor: colors.surfaceSunken, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, ...bevel.inset },
  fieldError: { fontFamily: fonts.display, fontSize: 16, color: colors.error, marginBottom: 4 },
  formButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  saveButton: { flex: 1, backgroundColor: colors.gold, paddingVertical: 10, alignItems: 'center', ...bevel.raised },
  saveButtonPressed: { opacity: 0.8 },
  saveButtonText: { fontFamily: fonts.heading, fontSize: 9, color: colors.background },
  cancelInlineButton: { flex: 1, paddingVertical: 10, alignItems: 'center', ...bevel.inset },
  cancelInlineText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary },

  // Timezone modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, maxHeight: '70%', ...bevel.raised },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surfaceSunken, ...bevel.inset },
  modalTitle: { fontFamily: fonts.heading, fontSize: 10, color: colors.gold },
  modalClose: { fontFamily: fonts.display, fontSize: 22, color: colors.textSecondary, paddingHorizontal: 4 },
  timezoneList: { paddingVertical: 4 },
  timezoneOption: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.bevelDark },
  timezoneOptionSelected: { backgroundColor: colors.surfaceSunken, borderLeftWidth: 3, borderLeftColor: colors.gold },
  timezoneLabel: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, marginBottom: 2 },
  timezoneLabelSelected: { color: colors.gold },
  timezoneValue: { fontFamily: fonts.display, fontSize: 14, color: colors.textSecondary },

  // Privacy policy
  policyUpdated: { fontFamily: fonts.display, fontSize: 14, color: colors.textMuted, marginBottom: 16 },
  policyHeading: { fontFamily: fonts.heading, fontSize: 8, color: colors.gold, marginTop: 16, marginBottom: 6 },
  policyBody: { fontFamily: fonts.display, fontSize: 17, color: colors.textSecondary, lineHeight: 24 },

  // Logout
  scrollContent: { paddingBottom: 32 },
  logoutContainer: { paddingHorizontal: 12, paddingTop: 24, paddingBottom: 8, gap: 8 },
  logoutConfirmText: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  logoutButton: { backgroundColor: colors.destructive, paddingVertical: 12, alignItems: 'center', borderWidth: 2, borderTopColor: '#ff8888', borderLeftColor: '#ff8888', borderBottomColor: colors.bevelDark, borderRightColor: colors.bevelDark },
  logoutButtonConfirm: { backgroundColor: colors.destructiveDark },
  logoutButtonPressed: { opacity: 0.85 },
  logoutButtonDisabled: { opacity: 0.5 },
  logoutButtonText: { fontFamily: fonts.display, fontSize: 24, color: '#ffffff', letterSpacing: 1 },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelButtonText: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary },
});
