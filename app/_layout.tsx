import { AuthProvider } from '@/src/context/AuthContext';
import { SkillsProvider } from '@/src/context/SkillsContext';
import { ActivitiesProvider } from '@/src/context/ActivitiesContext';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React from 'react';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SkillsProvider>
          <ActivitiesProvider>
            <Slot />
            <StatusBar barStyle="light-content" />
          </ActivitiesProvider>
        </SkillsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

