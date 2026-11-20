/**
 * A region: everything you can do there, with its level and rate. Tapping one adds it
 * to the trip plan (up to three legs, PROG-026).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { colors } from '../../constants/colors';
import {
  activitiesIn, CHUNK_HOURS, effectiveRate, fightId, fightPreview, itemName, levelOf, MAX_LEGS, questId, QUESTS, REGIONS,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { useDraftPlan } from './draftPlan';
import { Body, Button, Heading, Panel, Row, styles } from './ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Region'>;

export function RegionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { state } = useGame();
  const plan = useDraftPlan();
  const region = REGIONS[route.params.regionId];
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  if (!state || !region) return null;
  const locked = !!region.questGate && !state.quests[region.questGate];
  const { methods, recipes, fights, quests } = activitiesIn(region.id);
  // The anvil lists what you can make now, plus the next few unlocks; the rest behind a toggle.
  const makeable = recipes.filter((m) => levelOf(state, m.skill) >= m.level);
  const nextUp = recipes.filter((m) => levelOf(state, m.skill) < m.level).sort((a, b) => a.level - b.level).slice(0, 3);
  const shownRecipes = showAllRecipes ? recipes : [...makeable, ...nextUp];
  const full = plan.legs.length >= MAX_LEGS;
  const defaultHours = Math.max(CHUNK_HOURS, Math.min(4, Math.floor(state.time.bankHours / CHUNK_HOURS) * CHUNK_HOURS));

  const add = (activityId: string, hours = defaultHours) => {
    if (plan.addLeg({ activityId, regionId: region.id, hours })) navigation.navigate('Planner');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back"><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.headerTitle}>{region.name}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {locked && (
          <Panel><Body style={{ color: colors.errorText }}>Locked: finish the quest {QUESTS[region.questGate!]?.name} to travel here.</Body></Panel>
        )}
        {plan.legs.length > 0 && (
          <Panel>
            <Body>Your trip has {plan.legs.length} of {MAX_LEGS} legs.</Body>
            <Button label="Open the trip planner" kind="secondary" onPress={() => navigation.navigate('Planner')} />
          </Panel>
        )}

        {!locked && methods.length > 0 && (
          <Panel>
            <Heading>THINGS TO DO</Heading>
            {methods.map((m) => {
              const lvl = levelOf(state, m.skill);
              const ok = lvl >= m.level;
              const perHour = Math.round(effectiveRate(state, m, region.id));
              const what = m.kind === 'gather' ? itemName(m.output) : m.output ? itemName(m.output) : 'XP';
              return (
                <Row key={m.id} style={{ justifyContent: 'space-between', opacity: ok ? 1 : 0.55 }}>
                  <View style={{ flex: 1 }}>
                    <Body>{m.name}</Body>
                    <Body muted>
                      {ok ? `${perHour}/h ${what.toLowerCase()} · ${(perHour * m.xpEach).toLocaleString()} ${m.skill} XP/h` : `Needs ${m.skill} ${m.level} (you: ${lvl})`}
                    </Body>
                  </View>
                  <Button small label="Add" disabled={!ok || full} onPress={() => add(m.id)} />
                </Row>
              );
            })}
          </Panel>
        )}

        {!locked && recipes.length > 0 && (
          <Panel>
            <Heading>AT THE ANVIL</Heading>
            <Body muted>Smith gear and tools from bars. Each item takes a few minutes of the trip.</Body>
            {shownRecipes.map((m) => {
              const lvl = levelOf(state, m.skill);
              const ok = lvl >= m.level;
              const bars = m.kind === 'process' ? Object.entries(m.inputs).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}${n > 1 ? 's' : ''}`).join(', ') : '';
              const have = m.kind === 'process' ? Math.min(...Object.entries(m.inputs).map(([id, n]) => Math.floor((state.bank[id] ?? 0) / n))) : 0;
              return (
                <Row key={m.id} style={{ justifyContent: 'space-between', opacity: ok ? 1 : 0.55 }}>
                  <View style={{ flex: 1 }}>
                    <Body>{m.output ? itemName(m.output) : m.name}</Body>
                    <Body muted>{ok ? `${bars} each · you can make ${have}` : `Needs ${m.skill} ${m.level} (you: ${lvl})`}</Body>
                  </View>
                  <Button small label="Add" disabled={!ok || full} onPress={() => add(m.id, CHUNK_HOURS)} />
                </Row>
              );
            })}
            <Button small kind="secondary" label={showAllRecipes ? 'Show fewer' : `Show all ${recipes.length} recipes`} onPress={() => setShowAllRecipes(!showAllRecipes)} />
          </Panel>
        )}

        {!locked && fights.length > 0 && (
          <Panel>
            <Heading>FIGHTS</Heading>
            {fights.map((c) => {
              const p = fightPreview(state, c);
              return (
                <Row key={c.id} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Body>{c.name} (level {c.level}){c.boss ? ' · boss' : ''}</Body>
                    <Body muted>
                      {Math.round(p.winChance * 100)}% win · {p.killsPerHour.toFixed(1)} kills/h{c.weakness ? ` · weak to ${c.weakness}` : ''}
                    </Body>
                  </View>
                  <Button small label="Add" disabled={full} onPress={() => add(fightId(c.id))} />
                </Row>
              );
            })}
          </Panel>
        )}

        {quests.length > 0 && (
          <Panel>
            <Heading>QUEST BOARD</Heading>
            {quests.map((q) => {
              const done = !!state.quests[q.id];
              return (
                <Row key={q.id} style={{ justifyContent: 'space-between', opacity: done ? 0.55 : 1 }}>
                  <View style={{ flex: 1 }}>
                    <Body>{q.name}</Body>
                    <Body muted>{done ? 'Complete' : `Takes ${q.hours}h`}</Body>
                  </View>
                  <Button small label="Add" disabled={done || full} onPress={() => add(questId(q.id), q.hours)} />
                </Row>
              );
            })}
          </Panel>
        )}
      </ScrollView>
    </View>
  );
}
