/**
 * Trip planner (PROG-011, PROG-026): up to three legs, each in half-hour steps, with a
 * preview of what it should bring back. Sending spends the hours up front.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { colors } from '../../constants/colors';
import {
  activityName, activityOf, checkPlan, CHUNK_HOURS, CREATURES, formatHours, itemName, LegPreview, PlanProblem, previewPlan,
  QuestRequirement, regionName,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { useDraftPlan } from './draftPlan';
import { Body, Button, Heading, Panel, Row, styles } from './ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Planner'>;

const PROBLEMS: Record<PlanProblem, string> = {
  'no-legs': 'Add something to do from the map.',
  'too-many-legs': 'A trip can have up to three legs.',
  'bad-length': 'Each leg needs at least half an hour.',
  'unknown-activity': "That activity doesn't exist any more.",
  'wrong-region': "That can't be done there.",
  'region-locked': 'That region is still locked.',
  'level-too-low': 'Your level is too low for that.',
  'no-tool': "You don't have the tool for that.",
  'not-enough-time': "You don't have enough adventure time banked for the whole trip.",
  'in-debt': 'Your adventure time is in debt. Do a habit to pay it back first.',
  'quest-done': "You've already finished that quest.",
  'quest-requirements': "You don't meet that quest's requirements yet.",
  'quest-length': 'Quests take their own length.',
};

function requirementText(r: QuestRequirement): string {
  switch (r.kind) {
    case 'skill': return `${r.skill} ${r.level}`;
    case 'kills': return `Defeat ${r.count} ${CREATURES[r.creature]?.name.toLowerCase() ?? r.creature}s`;
    case 'item': return `Bring ${r.count} ${itemName(r.item).toLowerCase()}`;
    case 'quest': return `Finish ${r.quest}`;
  }
}

function PreviewLines({ p }: { p: LegPreview }) {
  if (p.kind === 'method') {
    return (
      <>
        <Body muted>
          {p.output ? `≈ ${p.count} ${itemName(p.output).toLowerCase()}` : `≈ ${p.count} done`} · ≈ {p.xp.toLocaleString()} {p.skill} XP
        </Body>
        {Object.keys(p.uses).length > 0 && (
          <Body muted>Uses {Object.entries(p.uses).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`).join(', ')}</Body>
        )}
        {p.burnChance > 0 && <Body muted>About {Math.round(p.burnChance * 100)}% will burn at your level.</Body>}
        {p.runsOutAfterHours !== undefined && (
          <Body style={{ color: colors.errorText }}>Materials run out after about {formatHours(p.runsOutAfterHours)}; the rest of the time comes back to you.</Body>
        )}
      </>
    );
  }
  if (p.kind === 'fight') {
    return (
      <>
        <Body muted>
          {Math.round(p.winChance * 100)}% win · ≈ {p.kills.toFixed(1)} kills · ≈ {p.styleXP.toLocaleString()} combat XP
        </Body>
        <Body muted>
          Wearing: {Object.values(p.loadout).map(itemName).join(', ') || 'nothing'}{p.hitsWeakness ? ' (hits its weakness)' : ''}
        </Body>
        {p.food && <Body muted>Eats ≈ {p.foodUsed} {itemName(p.food).toLowerCase()}</Body>}
      </>
    );
  }
  return (
    <>
      {p.requirements.map(({ req, met }, i) => (
        <Body key={i} style={{ color: met ? colors.successText : colors.errorText }}>{met ? '✓' : '✗'} {requirementText(req)}</Body>
      ))}
    </>
  );
}

export function TripPlannerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { state, activeTrip, send, error } = useGame();
  const plan = useDraftPlan();
  const [sending, setSending] = useState(false);
  if (!state) return null;

  const preview = previewPlan(state, plan.legs);
  const problem = checkPlan(state, plan.legs);
  const busy = !!activeTrip && (!activeTrip.trip.done || activeTrip.seenMs === null);

  const onSend = async () => {
    setSending(true);
    try {
      await send(plan.legs);
      plan.clear();
      navigation.popToTop();
    } catch {
      // the error shows below
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back"><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.headerTitle}>Plan a trip</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {preview.legs.map(({ plan: leg, problem: legProblem, preview: p }, i) => {
          const isQuest = activityOf(leg.activityId)?.kind === 'quest';
          return (
            <Panel key={i}>
              <Heading>LEG {i + 1}: {activityName(leg.activityId).toUpperCase()}</Heading>
              <Body muted>{regionName(leg.regionId)}</Body>
              <Row>
                {!isQuest && <Button small kind="secondary" label="−30m" disabled={leg.hours <= CHUNK_HOURS} onPress={() => plan.updateLeg(i, { ...leg, hours: leg.hours - CHUNK_HOURS })} />}
                <Body>{formatHours(leg.hours)}</Body>
                {!isQuest && <Button small kind="secondary" label="+30m" onPress={() => plan.updateLeg(i, { ...leg, hours: leg.hours + CHUNK_HOURS })} />}
                <Button small kind="secondary" label="Remove" onPress={() => plan.removeLeg(i)} />
              </Row>
              {p && <PreviewLines p={p} />}
              {legProblem && legProblem !== 'not-enough-time' && <Body style={{ color: colors.errorText }}>{PROBLEMS[legProblem]}</Body>}
            </Panel>
          );
        })}

        <Panel>
          <Body>Total: {formatHours(preview.totalHours)} of {formatHours(Math.max(0, state.time.bankHours))} banked</Body>
          {problem && <Body style={{ color: colors.errorText }}>{PROBLEMS[problem]}</Body>}
          {busy && <Body style={{ color: colors.errorText }}>{"Your adventurer is still out, or their loot hasn't been collected yet."}</Body>}
          {error && <Body style={{ color: colors.errorText }}>{error}</Body>}
          <Row>
            <Button label={sending ? 'Sending…' : `Send (${formatHours(preview.totalHours)})`} disabled={!!problem || busy || sending} onPress={onSend} />
            <Button label="Add more" kind="secondary" disabled={plan.legs.length >= 3} onPress={() => navigation.navigate('Map')} />
          </Row>
        </Panel>
      </ScrollView>
    </View>
  );
}
