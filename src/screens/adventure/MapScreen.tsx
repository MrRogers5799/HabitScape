/**
 * Map (placeholder art): the valley's regions, their travel time and what opens them.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { colors } from '../../constants/colors';
import { activitiesIn, QUESTS, REGIONS } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { Body, Heading, Panel, styles } from './ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Map'>;

export function MapScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { state } = useGame();
  if (!state) return null;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back"><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.headerTitle}>The valley</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {Object.values(REGIONS).map((r) => {
          const locked = !!r.questGate && !state.quests[r.questGate];
          const a = activitiesIn(r.id);
          const summary = [
            a.methods.length ? `${a.methods.length} things to do` : '',
            a.recipes.length ? 'an anvil' : '',
            a.fights.length ? a.fights.map((c) => c.name).join(', ') : '',
            a.quests.length ? `${a.quests.length} quests` : '',
          ].filter(Boolean).join(' · ');
          return (
            <Pressable key={r.id} onPress={() => navigation.navigate('Region', { regionId: r.id })} accessibilityRole="button">
              <Panel style={locked ? { opacity: 0.6 } : undefined}>
                <Heading>{r.name.toUpperCase()}</Heading>
                <Body muted>{summary}</Body>
                <Body muted>{r.travelFraction ? `Travel: ${Math.round(r.travelFraction * 100)}% of each trip` : 'No travel time'}</Body>
                {locked && <Body style={{ color: colors.errorText }}>Locked: finish the quest {QUESTS[r.questGate!]?.name}.</Body>}
              </Panel>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
