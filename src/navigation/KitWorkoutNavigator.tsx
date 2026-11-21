/**
 * The new version's Workout tab (PROD-019): the same four screens as the live
 * WorkoutNavigator and the same routes, drawn with the UI kit. The live app keeps its own.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { kitColors } from '../game-ui';
import { KitWorkoutsScreen } from '../screens/workout-kit/KitWorkoutsScreen';
import { KitWorkoutScreen } from '../screens/workout-kit/KitWorkoutScreen';
import { KitExercisesScreen } from '../screens/workout-kit/KitExercisesScreen';
import { KitSessionScreen } from '../screens/workout-kit/KitSessionScreen';
import { WorkoutStackParamList } from './WorkoutNavigator';

const Stack = createNativeStackNavigator<WorkoutStackParamList>();

export function KitWorkoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: kitColors.background } }}>
      <Stack.Screen name="WorkoutTemplates" component={KitWorkoutsScreen} />
      <Stack.Screen name="WorkoutMetrics" component={KitWorkoutScreen} />
      <Stack.Screen name="TemplateDetail" component={KitExercisesScreen} />
      {/* Leaving a session (back, swipe) keeps it running: it's saved and resumes from the banner. */}
      <Stack.Screen name="ActiveSession" component={KitSessionScreen} />
    </Stack.Navigator>
  );
}
