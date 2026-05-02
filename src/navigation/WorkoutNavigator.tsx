import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WorkoutTemplatesScreen } from '../screens/WorkoutTemplatesScreen';
import { TemplateDetailScreen } from '../screens/TemplateDetailScreen';
import { ActiveSessionScreen } from '../screens/ActiveSessionScreen';
import { WorkoutMetricsScreen } from '../screens/WorkoutMetricsScreen';

export type WorkoutStackParamList = {
  WorkoutTemplates: undefined;
  WorkoutMetrics: { templateId: string; templateName: string };
  TemplateDetail: { templateId: string; templateName: string };
  ActiveSession: { templateId: string; templateName: string; backdateDate?: string };
};

const Stack = createNativeStackNavigator<WorkoutStackParamList>();

export function WorkoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkoutTemplates" component={WorkoutTemplatesScreen} />
      <Stack.Screen name="WorkoutMetrics" component={WorkoutMetricsScreen} />
      <Stack.Screen name="TemplateDetail" component={TemplateDetailScreen} />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} />
    </Stack.Navigator>
  );
}
