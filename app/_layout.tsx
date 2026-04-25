/**
 * Root Layout Component
 * 
 * This is the entry point of the HabitScape app.
 * It wraps the entire app with:
 * 1. Auth Provider - manages user authentication state
 * 2. Skills Provider - manages skills data
 * 3. Activities Provider - manages activities and completions
 * 4. Navigation - handles routing based on auth state
 * 
 * All context providers must wrap the navigation so that
 * screens have access to auth, skills, and activities data.
 */

import { AuthProvider } from '@/src/context/AuthContext';
import { SkillsProvider } from '@/src/context/SkillsContext';
import { ActivitiesProvider } from '@/src/context/ActivitiesContext';
import { RootNavigator } from '@/src/navigation/RootNavigator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React from 'react';

/**
 * Main App Layout
 * 
 * Provider hierarchy (outer to inner):
 * 1. AuthProvider - provides user state
 * 2. SkillsProvider - depends on user from Auth
 * 3. ActivitiesProvider - depends on user from Auth
 * 4. RootNavigator - navigation stack
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SkillsProvider>
          <ActivitiesProvider>
            <RootNavigator />
            <StatusBar barStyle="light-content" />
          </ActivitiesProvider>
        </SkillsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

