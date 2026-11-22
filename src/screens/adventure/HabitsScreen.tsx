/**
 * Habits (PROD-034): the tab the app opens on. Tick today's habits and close the app, with
 * nothing to scroll past. The workout tracker is reached from here (the Workout tab is gone),
 * and a workout in progress shows here so it's never lost. The welcome pages (PROD-032) show
 * here too, since this is the first screen a new player sees.
 */
import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { TodayHabits } from './TodayHabits';
import { WelcomePages } from './Journey';
import { ActiveWorkoutBanner, useActiveWorkout } from '../workout-kit/ActiveWorkoutBanner';
import { KitScreen, kitColors, kitFonts, Panel, Row, space, TAB_ICONS } from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'HabitsHome'>;

export function HabitsScreen({ navigation }: Props) {
  const { active: liveWorkout, discard: discardWorkout } = useActiveWorkout();
  return (
    <KitScreen title="Habits">
      <WelcomePages />
      {liveWorkout && (
        <ActiveWorkoutBanner
          active={liveWorkout}
          onDiscard={discardWorkout}
          onResume={() => navigation.navigate('Workouts', {
            // initial: false keeps the workout list under the session, so Back has somewhere to go.
            initial: false,
            screen: 'ActiveSession',
            params: { templateId: liveWorkout.templateId, templateName: liveWorkout.templateName, backdateDate: liveWorkout.backdateDate },
          })}
        />
      )}
      <TodayHabits />
      <Panel>
        <Row
          left={<Image source={TAB_ICONS.workout} style={styles.icon} accessibilityIgnoresInvertColors />}
          title="Workouts"
          subtitle="Your workout tracker"
          onPress={() => navigation.navigate('Workouts', { screen: 'WorkoutTemplates' })}
          accessibilityLabel="Open the workout tracker"
          right={<Text style={styles.arrow}>›</Text>}
        />
      </Panel>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 36, height: 36 },
  arrow: { fontFamily: kitFonts.text, fontSize: 28, color: kitColors.gold, paddingHorizontal: space.xs },
});
