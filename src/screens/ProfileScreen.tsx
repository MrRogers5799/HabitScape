/**
 * Profile Screen (Phase 1 Placeholder)
 * 
 * This screen is a placeholder for character creation and customization.
 * Phase 2 will include: Avatar creation, name selection, appearance options
 * Phase 3+ will include: Gear/equipment display
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

/**
 * Profile Screen Component
 */
export function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Current User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Status</Text>

        <View style={styles.userInfoCard}>
          <View style={styles.userIcon}>
            <Text style={styles.userIconText}>👤</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userStatus}>Member since</Text>
            <Text style={styles.userDate}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
            </Text>
          </View>
        </View>
      </View>

      {/* Coming Soon Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Character Creation</Text>

        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonIcon}>✨</Text>
          <Text style={styles.comingSoonTitle}>Coming in Phase 2</Text>
          <Text style={styles.comingSoonText}>
            Create and customize your character! Choose your appearance, set your in-game name, and personalize your experience.
          </Text>

          <View style={styles.featureList}>
            <Text style={styles.featureItem}>🎨 Avatar customization</Text>
            <Text style={styles.featureItem}>📝 Choose your in-game name</Text>
            <Text style={styles.featureItem}>🎭 Select appearance options</Text>
            <Text style={styles.featureItem}>🌈 Theme selection</Text>
          </View>

          <TouchableOpacity style={styles.disabledButton} disabled>
            <Text style={styles.disabledButtonText}>Coming Soon</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Gear Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equipment & Gear</Text>

        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonIcon}>⚔️</Text>
          <Text style={styles.comingSoonTitle}>Coming in Phase 3 & 4</Text>
          <Text style={styles.comingSoonText}>
            Unlock and equip gear as you level up your skills. Get the cape at 99!
          </Text>

          <View style={styles.featureList}>
            <Text style={styles.featureItem}>🧢 Equipment unlocks at milestones</Text>
            <Text style={styles.featureItem}>📊 XP boost items</Text>
            <Text style={styles.featureItem}>🏆 Skill capes at level 99</Text>
            <Text style={styles.featureItem}>💫 Cosmetic customization</Text>
          </View>
        </View>
      </View>

      {/* Footer Info */}
      <View style={styles.footerInfo}>
        <Text style={styles.footerText}>HabitScape MVP v1.0</Text>
        <Text style={styles.footerText}>More features coming soon!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D4AF37',
    marginBottom: 12,
  },
  userInfoCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userIconText: {
    fontSize: 28,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#D4AF37',
    fontWeight: '500',
  },
  comingSoonCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37',
    marginBottom: 12,
  },
  comingSoonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D4AF37',
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
    lineHeight: 18,
  },
  featureList: {
    marginBottom: 12,
  },
  featureItem: {
    fontSize: 12,
    color: '#bbb',
    marginBottom: 6,
  },
  disabledButton: {
    backgroundColor: '#444',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999',
    fontWeight: '600',
    fontSize: 14,
  },
  footerInfo: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});
