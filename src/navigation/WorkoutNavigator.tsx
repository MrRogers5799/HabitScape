import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WorkoutTemplatesScreen } from '../screens/WorkoutTemplatesScreen';
import { TemplateDetailScreen } from '../screens/TemplateDetailScreen';
import { ActiveSessionScreen } from '../screens/ActiveSessionScreen';

export type WorkoutStackParamList = {
  WorkoutTemplates: undefined;
  TemplateDetail: { templateId: string; templateName: string };
  ActiveSession: { templateId: string; templateName: string };
};

const Stack = createNativeStackNavigator<WorkoutStackParamList>();

export function WorkoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkoutTemplates" component={WorkoutTemplatesScreen} />
      <Stack.Screen name="TemplateDetail" component={TemplateDetailScreen} />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} />
    </Stack.Navigator>
  );
}
