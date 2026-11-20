/**
 * Trip planner (PROG-011, PROG-026): up to three legs, each in half-hour steps, with a
 * preview of what it should bring back, as icons (new-version kit, PROD-024/025).
 * Sending spends the hours up front.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import {
  activityName, activityOf, checkPlan, CHUNK_HOURS, CREATURES, formatHours, itemName, LegPreview, MAX_LEGS, PlanProblem, previewPlan,
  QuestRequirement, regionName,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, ButtonRow, ItemIcon, ItemSlot, KitButton, KitScreen, kitColors, NeedsTag, Panel, space, StatReadout, Tag, type, XpChip,
} from '../../game-ui';
import { useDraftPlan } from './draftPlan';

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

function Requirement({ r, met }: { r: QuestRequirement; met: boolean }) {
  const tone = met ? 'green' : 'red';
  switch (r.kind) {
    case 'skill': return <NeedsTag skill={r.skill} level={r.level} met={met} />;
    case 'kills': {
      const name = CREATURES[r.creature]?.name ?? r.creature;
      return <Tag tone={tone} label={`×${r.count}`} icon={<ItemIcon id={r.creature} name={name} size={20} />} accessibilityLabel={`Defeat ${r.count} ${name}`} />;
    }
    case 'item':
      return <Tag tone={tone} label={`×${r.count}`} icon={<ItemIcon id={r.item} name={itemName(r.item)} size={20} />} accessibilityLabel={`Bring ${r.count} ${itemName(r.item)}`} />;
    case 'quest': return <Tag tone={tone} label={`Quest: ${r.quest}`} />;
  }
}

/** What a leg should bring back and use, as icons. */
function Preview({ p }: { p: LegPreview }) {
  if (p.kind === 'method') {
    return (
      <>
        <View style={styles.wrap}>
          {p.output && <ItemSlot id={p.output} name={itemName(p.output)} count={p.count} size={56} />}
          <XpChip skill={p.skill} amount={p.xp} />
          {Object.entries(p.uses).map(([id, n]) => (
            <Tag key={id} tone="red" label={`−${n}`} icon={<ItemIcon id={id} name={itemName(id)} size={20} />} accessibilityLabel={`Uses ${n} ${itemName(id)}`} />
          ))}
          {p.burnChance > 0 && <Tag tone="red" label={`${Math.round(p.burnChance * 100)}% burn`} />}
        </View>
        {p.runsOutAfterHours !== undefined && (
          <Body muted style={{ color: kitColors.red }}>Runs out after {formatHours(p.runsOutAfterHours)}; the rest of the time comes back to you.</Body>
        )}
      </>
    );
  }
  if (p.kind === 'fight') {
    const win = Math.round(p.winChance * 100);
    const worn = Object.values(p.loadout);
    return (
      <>
        <View style={styles.wrap}>
          <Tag label={`${win}% win`} tone={win >= 80 ? 'green' : win >= 50 ? 'gold' : 'red'} />
          <Tag label={`≈${Math.round(p.kills)} kills`} />
          <Tag label={`+${p.styleXP.toLocaleString()} XP`} tone="green" accessibilityLabel={`About ${p.styleXP.toLocaleString()} combat XP`} />
          {p.food && <Tag tone="red" label={`−${p.foodUsed}`} icon={<ItemIcon id={p.food} name={itemName(p.food)} size={20} />} accessibilityLabel={`Eats ${p.foodUsed} ${itemName(p.food)}`} />}
          {p.hitsWeakness && <Tag label="Hits weakness" tone="gold" />}
        </View>
        {worn.length > 0 && (
          <View style={styles.wrap} accessible accessibilityLabel={`Wearing ${worn.map(itemName).join(', ')}`}>
            {worn.map((id) => <ItemSlot key={id} id={id} name={itemName(id)} size={44} />)}
          </View>
        )}
      </>
    );
  }
  return <View style={styles.wrap}>{p.requirements.map(({ req, met }, i) => <Requirement key={i} r={req} met={met} />)}</View>;
}

export function TripPlannerScreen({ navigation }: Props) {
  const { state, activeTrip, send, error } = useGame();
  const plan = useDraftPlan();
  const [sending, setSending] = useState(false);
  if (!state) return null;

  const preview = previewPlan(state, plan.legs);
  const problem = checkPlan(state, plan.legs);
  const busy = !!activeTrip && (!activeTrip.trip.done || activeTrip.seenMs === null);
  const banked = Math.max(0, state.time.bankHours);

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
    <KitScreen title="Plan a trip" onBack={() => navigation.goBack()}>
      {preview.legs.map(({ plan: leg, problem: legProblem, preview: p }, i) => {
        const isQuest = activityOf(leg.activityId)?.kind === 'quest';
        return (
          <Panel key={i} title={activityName(leg.activityId)} right={<Tag label={regionName(leg.regionId)} />}>
            <View style={styles.stepper}>
              {!isQuest && (
                <KitButton compact kind="secondary" label="−" accessibilityLabel="30 minutes less" disabled={leg.hours <= CHUNK_HOURS}
                  onPress={() => plan.updateLeg(i, { ...leg, hours: leg.hours - CHUNK_HOURS })} />
              )}
              <Text style={[type.readout, styles.hours]} accessibilityLabel={`Leg ${i + 1}: ${formatHours(leg.hours)}`}>{formatHours(leg.hours)}</Text>
              {!isQuest && (
                <KitButton compact kind="secondary" label="+" accessibilityLabel="30 minutes more"
                  onPress={() => plan.updateLeg(i, { ...leg, hours: leg.hours + CHUNK_HOURS })} />
              )}
              <View style={styles.flex} />
              <KitButton compact kind="secondary" label="✕" accessibilityLabel={`Remove leg ${i + 1}`} onPress={() => plan.removeLeg(i)} />
            </View>
            {p && <Preview p={p} />}
            {legProblem && legProblem !== 'not-enough-time' && <Body style={{ color: kitColors.red }}>{PROBLEMS[legProblem]}</Body>}
          </Panel>
        );
      })}

      <Panel title="Trip">
        <StatReadout label="Time" value={formatHours(preview.totalHours)} max={formatHours(banked)} tone={preview.totalHours > banked ? 'red' : 'green'} />
        {problem && <Body style={{ color: kitColors.red }}>{PROBLEMS[problem]}</Body>}
        {busy && <Body style={{ color: kitColors.red }}>{"Your adventurer is still out, or their loot hasn't been collected yet."}</Body>}
        {error && <Body style={{ color: kitColors.red }}>{error}</Body>}
        <ButtonRow>
          <KitButton label={sending ? 'Sending…' : 'Send'} disabled={!!problem || busy || sending} onPress={onSend} />
          <KitButton label="Add more" kind="secondary" disabled={plan.legs.length >= MAX_LEGS} onPress={() => navigation.navigate('Map')} />
        </ButtonRow>
      </Panel>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hours: { minWidth: 92, textAlign: 'center', color: kitColors.text },
  flex: { flex: 1 },
});
