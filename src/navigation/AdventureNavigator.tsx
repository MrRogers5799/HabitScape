/**
 * The new version's tabs (PROD-019, PROD-026): Today, Map, Hero, Workout, under the kit
 * tab bar. Shown in place of the live app's tabs where the new version is active
 * (development builds and the owner's account until launch, PROD-022). One draft trip
 * plan is shared across the tabs while the player builds it.
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
import { WorkoutNavigator } from './WorkoutNavigator';
import { TABS } from './newVersionTabs';

/** Every screen in the new version's stacks. Each tab's stack holds only the ones it can reach. */
export type AdventureStackParamList = {
  AdventureHome: undefined;
  Map: undefined;
  Region: { regionId: string };
  Planner: undefined;
  Hero: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator();
const TodayStack = createNativeStackNavigator<AdventureStackParamList>();
const MapStack = createNativeStackNavigator<AdventureStackParamList>();
const HeroStack = createNativeStackNavigator<AdventureStackParamList>();

const stackOptions: NativeStackNavigationOptions = {
  headerShown: false, animation: 'fade', contentStyle: { backgroundColor: kitColors.background },
};
function TodayTab() {
  return (
    <TodayStack.Navigator screenOptions={stackOptions}>
      <TodayStack.Screen name="AdventureHome" component={AdventureHomeScreen} />
    </TodayStack.Navigator>
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
    </HeroStack.Navigator>
  );
}

export function AdventureNavigator() {
  return (
    <DraftPlanProvider>
      <Tab.Navigator tabBar={(props) => <KitTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tab.Screen name={TABS.today} component={TodayTab} options={{ title: 'Today' }} />
        <Tab.Screen name={TABS.map} component={MapTab} options={{ title: 'Map' }} />
        <Tab.Screen name={TABS.hero} component={HeroTab} options={{ title: 'Hero' }} />
        <Tab.Screen name={TABS.workout} component={WorkoutNavigator} options={{ title: 'Workout' }} />
      </Tab.Navigator>
    </DraftPlanProvider>
  );
}
