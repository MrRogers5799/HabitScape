/**
 * Root Navigation
 * 
 * This file sets up React Navigation with bottom tab navigation.
 * Different navigation stacks are shown based on authentication status.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image, View } from 'react-native';
import { PlatformPressable } from '@react-navigation/elements';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { fonts } from '../constants/typography';

const TAB_ICONS = {
  activities: require('../../assets/icons/tabs/Hardcore_ironman_chat_badge.png'),
  skills:     require('../../assets/icons/tabs/skills.png'),
  profile:    require('../../assets/icons/tabs/profile.png'),
  settings:   require('../../assets/icons/tabs/settings.png'),
  workout:    require('../../assets/icons/tabs/Jog emote icon.png'),
};

// Screens
import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { SkillsHubScreen } from '../screens/SkillsHubScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { WorkoutNavigator } from './WorkoutNavigator';

const OUTLINE_OFFSETS = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(y => [x, y])).filter(([x, y]) => x !== 0 || y !== 0);

function OutlinedTabIcon({ source, size }: { source: any; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      {OUTLINE_OFFSETS.map(([x, y], i) => (
        <Image key={i} source={source} style={{ position: 'absolute', width: size, height: size, tintColor: 'black', left: x, top: y }} resizeMode="contain" />
      ))}
      <Image source={source} style={{ position: 'absolute', width: size, height: size, opacity: 1 }} resizeMode="contain" />
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.bevelLight,
          borderTopWidth: 2,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom,
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
          tabBarIcon: ({ size }) => (
            <OutlinedTabIcon source={TAB_ICONS.activities} size={size} />
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
          tabBarIcon: ({ size }) => (
            <Image source={TAB_ICONS.skills} style={{ width: size, height: size, opacity: 1 }} resizeMode="contain" />
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
          tabBarIcon: ({ size }) => (
            <Image source={TAB_ICONS.profile} style={{ width: size, height: size, opacity: 1 }} resizeMode="contain" />
          ),
        }}
      />

      {/* Workout Tab */}
      <Tab.Screen
        name="WorkoutTab"
        component={WorkoutNavigator}
        options={{
          title: 'Workout',
          tabBarLabel: 'Workout',
          tabBarIcon: ({ size }) => (
            <Image source={TAB_ICONS.workout} style={{ width: size, height: size, opacity: 1 }} resizeMode="contain" />
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
          tabBarIcon: ({ size }) => (
            <Image source={TAB_ICONS.settings} style={{ width: size, height: size, opacity: 1 }} resizeMode="contain" />
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
        // Not logged in → Auth
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ animationTypeForReplace: 'pop' }}
        />
      ) : user.profileComplete !== true ? (
        // Logged in but hasn't completed onboarding
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ animationTypeForReplace: 'push' }}
        />
      ) : (
        // Fully set up → main app
        <Stack.Screen
          name="App"
          component={TabNavigator}
          options={{ animationTypeForReplace: 'pop' }}
        />
      )}
    </Stack.Navigator>
  );
}

