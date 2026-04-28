/**
 * Root Navigation
 * 
 * This file sets up React Navigation with bottom tab navigation.
 * Different navigation stacks are shown based on authentication status.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image } from 'react-native';
import { PlatformPressable } from '@react-navigation/elements';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { fonts } from '../constants/typography';

const TAB_ICONS = {
  activities: require('../../assets/icons/tabs/activities.png'),
  skills:     require('../../assets/icons/tabs/skills.png'),
  profile:    require('../../assets/icons/tabs/profile.png'),
  settings:   require('../../assets/icons/tabs/settings.png'),
};

// Screens
import { AuthScreen } from '../screens/AuthScreen';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { SkillsHubScreen } from '../screens/SkillsHubScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

// Navigation instances
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Tab Navigator Component
 * 
 * Displays bottom tabs for Activities, Skills, Settings, and Profile
 * Only shown when user is logged in
 */
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.bevelLight,
          borderTopWidth: 2,
          height: 58,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: fonts.display,
          fontSize: 15,
        },
        tabBarButton: (props) => {
          const focused = (props as any).accessibilityState?.selected;
          return (
            <PlatformPressable
              {...(props as any)}
              style={[
                (props as any).style,
                focused && {
                  borderTopWidth: 2,
                  borderTopColor: colors.gold,
                  backgroundColor: colors.surfaceSunken,
                },
              ]}
            />
          );
        },
      }}
    >
      {/* Activities Tab */}
      <Tab.Screen
        name="ActivitiesTab"
        component={ActivitiesScreen}
        options={{
          title: 'Activities',
          tabBarLabel: 'Activities',
          tabBarIcon: ({ focused, size }) => (
            <Image source={TAB_ICONS.activities} style={{ width: size, height: size, opacity: focused ? 1 : 0.45 }} resizeMode="contain" />
          ),
        }}
      />

      {/* Skills Tab */}
      <Tab.Screen
        name="SkillsTab"
        component={SkillsHubScreen}
        options={{
          title: 'Skills',
          tabBarLabel: 'Skills',
          tabBarIcon: ({ focused, size }) => (
            <Image source={TAB_ICONS.skills} style={{ width: size, height: size, opacity: focused ? 1 : 0.45 }} resizeMode="contain" />
          ),
        }}
      />

      {/* Profile Tab */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, size }) => (
            <Image source={TAB_ICONS.profile} style={{ width: size, height: size, opacity: focused ? 1 : 0.45 }} resizeMode="contain" />
          ),
        }}
      />

      {/* Settings Tab */}
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused, size }) => (
            <Image source={TAB_ICONS.settings} style={{ width: size, height: size, opacity: focused ? 1 : 0.45 }} resizeMode="contain" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Root Navigation Component
 * 
 * Handles switching between Auth stack and App stack based on login status
 * Returns bare navigators - Expo Router provides the NavigationContainer
 */
export function RootNavigator() {
  const { user, loading } = useAuth();

  // Still loading auth state
  if (loading) {
    return null; // Splash screen could be shown here
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!user ? (
        // Auth Stack - shown when user is NOT logged in
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
      ) : (
        // App Stack - shown when user IS logged in
        <Stack.Screen
          name="App"
          component={TabNavigator}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
      )}
    </Stack.Navigator>
  );
}

