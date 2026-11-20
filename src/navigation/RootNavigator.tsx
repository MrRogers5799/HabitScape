/**
 * Root Navigation
 * 
 * This file sets up React Navigation with bottom tab navigation.
 * Different navigation stacks are shown based on authentication status.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { KitTabBar } from '../game-ui/KitTabBar';
import { Image, ImageSourcePropType } from 'react-native';
import { PlatformPressable } from '@react-navigation/elements';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { fonts } from '../constants/typography';
import { SKILL_ICONS } from '../constants/osrsSkills';
import { adventureActive, newLoginVisible } from '../constants/features';
import { AdventureNavigator } from './AdventureNavigator';

// Generated from art/icons.json by scripts/render-icons.mjs (see the vault's Art bible).
// Inactive tabs use the cream/gold variant; only the active tab is in full color.
type TabIconPair = { active: ImageSourcePropType; inactive: ImageSourcePropType };
const TAB_ICONS: Record<'activities' | 'skills' | 'profile' | 'workout' | 'settings', TabIconPair> = {
  activities: { active: require('../../assets/icons/tabs/activities.png'), inactive: require('../../assets/icons/tabs/activities-inactive.png') },
  skills:     { active: require('../../assets/icons/tabs/skills.png'),     inactive: require('../../assets/icons/tabs/skills-inactive.png') },
  profile:    { active: require('../../assets/icons/tabs/profile.png'),    inactive: require('../../assets/icons/tabs/profile-inactive.png') },
  workout:    { active: require('../../assets/icons/tabs/workout.png'),    inactive: require('../../assets/icons/tabs/workout-inactive.png') },
  settings:   { active: require('../../assets/icons/tabs/settings.png'),   inactive: require('../../assets/icons/tabs/settings-inactive.png') },
};

function TabIcon({ icon, focused, size }: { icon: TabIconPair; focused: boolean; size: number }) {
  return (
    <Image
      source={focused ? icon.active : icon.inactive}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

// Screens
import { AuthScreen } from '../screens/AuthScreen';
import { KitAuthScreen } from '../screens/adventure/KitAuthScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { SkillsHubScreen } from '../screens/SkillsHubScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { WorkoutNavigator } from './WorkoutNavigator';
import { WelcomeOneZeroModal } from '../components/WelcomeNote';


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
  const { user } = useAuth();
  return (
    <>
    <Tab.Navigator
      // The new version's tab bar (PROD-025), only where the new version shows (PROD-022).
      tabBar={(props) => (adventureActive(user) ? <KitTabBar {...props} /> : <BottomTabBar {...props} />)}
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
          // Six tabs with the Adventure beta: a touch smaller so 'Activities' fits.
          fontSize: adventureActive(user) ? 13 : 15,
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
          tabBarIcon: ({ focused, size }) => <TabIcon icon={TAB_ICONS.activities} focused={focused} size={size} />,
        }}
      />

      {/* Adventure (beta) tab: hidden from players until launch (PROD-020); dev builds and the owner only. Placeholder icon. */}
      {adventureActive(user) && (
        <Tab.Screen
          name="AdventureTab"
          component={AdventureNavigator}
          options={{
            title: 'Adventure',
            tabBarLabel: 'Adventure',
            tabBarIcon: ({ focused, size }) => (
              <Image source={SKILL_ICONS.Slayer} style={{ width: size, height: size, opacity: focused ? 1 : 0.55 }} resizeMode="contain" />
            ),
          }}
        />
      )}

      {/* Skills Tab */}
      <Tab.Screen
        name="SkillsTab"
        component={SkillsHubScreen}
        options={{
          title: 'Skills',
          tabBarLabel: 'Skills',
          tabBarIcon: ({ focused, size }) => <TabIcon icon={TAB_ICONS.skills} focused={focused} size={size} />,
        }}
      />

      {/* Profile Tab */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, size }) => <TabIcon icon={TAB_ICONS.profile} focused={focused} size={size} />,
        }}
      />

      {/* Workout Tab */}
      <Tab.Screen
        name="WorkoutTab"
        component={WorkoutNavigator}
        options={{
          title: 'Workout',
          tabBarLabel: 'Workout',
          tabBarIcon: ({ focused, size }) => <TabIcon icon={TAB_ICONS.workout} focused={focused} size={size} />,
        }}
      />

      {/* Settings Tab */}
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused, size }) => <TabIcon icon={TAB_ICONS.settings} focused={focused} size={size} />,
        }}
      />
    </Tab.Navigator>
    {/* One-time 1.0 note for players who joined before 1.0 */}
    <WelcomeOneZeroModal />
    </>
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
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!user ? (
        // Not logged in → Auth
        <Stack.Screen
          name="Auth"
          component={newLoginVisible() ? KitAuthScreen : AuthScreen}
          options={{ animationTypeForReplace: 'pop' }}
        />
      ) : !user.emailVerified && !__DEV__ ? (
        // Logged in but email not verified
        <Stack.Screen
          name="VerifyEmail"
          component={VerifyEmailScreen}
          options={{ animationTypeForReplace: 'push' }}
        />
      ) : user.profileComplete !== true ? (
        // Verified but hasn't completed onboarding
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

