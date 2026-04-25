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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useActivities } from '../context/ActivitiesContext';
import { ActivitySelectionWizard } from '../components/ActivitySelectionWizard';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { colors } from '../constants/colors';
import { Cadence } from '../types';

/**
 * Settings Screen Component
 */
export function SettingsScreen() {
  const { user, logOut } = useAuth();
  const { userActivities, addActivity, removeActivity } = useActivities();
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);

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

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValue}>{user?.email}</Text>
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Timezone</Text>
            <Text style={styles.settingValue}>{user?.timezone}</Text>
          </View>

          <View style={styles.comingSoonContainer}>
            <Text style={styles.comingSoonLabel}>Phase 2 - Coming Soon:</Text>
            <Text style={styles.featureText}>✓ Change timezone</Text>
            <Text style={styles.featureText}>✓ Change password</Text>
            <Text style={styles.featureText}>✓ Push notifications</Text>
          </View>
        </View>

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
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  comingSoonContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  comingSoonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
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
