/**
 * The new version's tabs (PROD-034): Habits, Planner, Map, Hero, under the kit
 * tab bar. Shown in place of the live app's tabs where the new version is active
 * (development builds and the owner's account until launch, PROD-022). The blocks picked
 * for the queue (PROG-045) are shared across the tabs while the player picks them.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { KitTabBar, kitColors } from '../game-ui';
import { DraftPlanProvider } from '../screens/adventure/draftPlan';
import { AdventureHomeScreen } from '../screens/adventure/AdventureHomeScreen';
import { MapScreen } from '../screens/adventure/MapScreen';
import { RegionScreen } from '../screens/adventure/RegionScreen';
import { TripPlannerScreen } from '../screens/adventure/TripPlannerScreen';
import { HeroScreen } from '../screens/adventure/HeroScreen';
import { KitSettingsScreen } from '../screens/adventure/KitSettingsScreen';
import { HabitsScreen } from '../screens/adventure/HabitsScreen';
import { ItemSheetProvider } from '../screens/adventure/ItemSheet';
import { KitEditHabitsScreen } from '../screens/adventure/KitEditHabitsScreen';
import { NavigatorScreenParams } from '@react-navigation/native';
import { WorkoutStackParamList } from './WorkoutNavigator';
import { KitHabitScreen } from '../screens/adventure/KitHabitScreen';
import { SkillGuideScreen } from '../screens/adventure/SkillGuideScreen';
import { GameSkill } from '../game';
import { KitWorkoutNavigator } from './KitWorkoutNavigator';
import { TABS } from './newVersionTabs';

/** Every screen in the new version's stacks. Each tab's stack holds only the ones it can reach. */
export type AdventureStackParamList = {
  AdventureHome: undefined;
  HabitsHome: undefined;
  EditHabits: undefined;
  /** The workout tracker's own stack, opened from Habits (PROD-034). */
  Workouts: NavigatorScreenParams<WorkoutStackParamList> | undefined;
  Habit: { activityId: string };
  Skill: { skill: GameSkill };
  Map: undefined;
  Region: { regionId: string; section?: 'gather' | 'make' | 'fight' | 'village' };
  Planner: undefined;
  Hero: { section?: 'skills' | 'gear' | 'bank' | 'quests' | 'log' } | undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator();
const HabitsStack = createNativeStackNavigator<AdventureStackParamList>();
const PlannerStack = createNativeStackNavigator<AdventureStackParamList>();
const MapStack = createNativeStackNavigator<AdventureStackParamList>();
const HeroStack = createNativeStackNavigator<AdventureStackParamList>();

const stackOptions: NativeStackNavigationOptions = {
  headerShown: false, animation: 'fade', contentStyle: { backgroundColor: kitColors.background },
};
function HabitsTab() {
  return (
    <HabitsStack.Navigator screenOptions={stackOptions}>
      <HabitsStack.Screen name="HabitsHome" component={HabitsScreen} />
      <HabitsStack.Screen name="Habit" component={KitHabitScreen} />
      <HabitsStack.Screen name="EditHabits" component={KitEditHabitsScreen} />
      <HabitsStack.Screen name="Workouts" component={KitWorkoutNavigator} />
    </HabitsStack.Navigator>
  );
}

function PlannerTab() {
  return (
    <PlannerStack.Navigator screenOptions={stackOptions}>
      <PlannerStack.Screen name="AdventureHome" component={AdventureHomeScreen} />
    </PlannerStack.Navigator>
  );
}

function MapTab() {
  return (
    <MapStack.Navigator screenOptions={stackOptions}>
      <MapStack.Screen name="Map" component={MapScreen} />
      <MapStack.Screen name="Region" component={RegionScreen} />
      <MapStack.Screen name="Planner" component={TripPlannerScreen} />
    </MapStack.Navigator>
  );
}

function HeroTab() {
  return (
    <HeroStack.Navigator screenOptions={stackOptions}>
      <HeroStack.Screen name="Hero" component={HeroScreen} />
      <HeroStack.Screen name="Settings" component={KitSettingsScreen} />
      <HeroStack.Screen name="Skill" component={SkillGuideScreen} />
    </HeroStack.Navigator>
  );
}

export function AdventureNavigator() {
  return (
    <DraftPlanProvider>
      <ItemSheetProvider>
      <Tab.Navigator tabBar={(props) => <KitTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tab.Screen name={TABS.habits} component={HabitsTab} options={{ title: 'Habits' }} />
        <Tab.Screen name={TABS.planner} component={PlannerTab} options={{ title: 'Planner' }} />
        <Tab.Screen name={TABS.map} component={MapTab} options={{ title: 'Map' }} />
        <Tab.Screen name={TABS.hero} component={HeroTab} options={{ title: 'Hero' }} />
      </Tab.Navigator>
      </ItemSheetProvider>
    </DraftPlanProvider>
  );
}
