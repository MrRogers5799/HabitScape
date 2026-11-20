/**
 * Adventure (beta) tab (PROD-018): home, map, region, trip planner and hero screens,
 * sharing one draft trip plan while the player builds it.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/colors';
import { DraftPlanProvider } from '../screens/adventure/draftPlan';
import { AdventureHomeScreen } from '../screens/adventure/AdventureHomeScreen';
import { MapScreen } from '../screens/adventure/MapScreen';
import { RegionScreen } from '../screens/adventure/RegionScreen';
import { TripPlannerScreen } from '../screens/adventure/TripPlannerScreen';
import { HeroScreen } from '../screens/adventure/HeroScreen';

export type AdventureStackParamList = {
  AdventureHome: undefined;
  Map: undefined;
  Region: { regionId: string };
  Planner: undefined;
  Hero: undefined;
};

const Stack = createNativeStackNavigator<AdventureStackParamList>();

export function AdventureNavigator() {
  return (
    <DraftPlanProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="AdventureHome" component={AdventureHomeScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Region" component={RegionScreen} />
        <Stack.Screen name="Planner" component={TripPlannerScreen} />
        <Stack.Screen name="Hero" component={HeroScreen} />
      </Stack.Navigator>
    </DraftPlanProvider>
  );
}
