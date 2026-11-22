/**
 * Adding to the queue (PROG-045): the blocks picked on the map, each previewed as icons
 * (new-version kit, PROD-024/025). Gathering and fights are set in half hours; crafting
 * is a work order set by count and takes only its minutes (PROG-043). Blocks join the end
 * of the queue, even while the adventurer is out, and the hours are spent up front.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import {
  activityName, activityOf, canMakeFrom, checkPlan, CHUNK_HOURS, clockTime, CREATURES, formatHours, isWorkOrder, itemName, LegPreview,
  MAX_QUEUE_BLOCKS, PlanProblem, previewPlan, QuestRequirement, queueEndsMs, queueRunning, regionName, remainingPlan,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { TABS } from '../../navigation/newVersionTabs';
import {
  Body, ButtonRow, ItemIcon, ItemSlot, KitButton, KitScreen, kitColors, NeedsTag, Panel, space, StatReadout, Tag, type, XpChip,
} from '../../game-ui';
import { useDraftPlan } from './draftPlan';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Planner'>;

const PROBLEMS: Record<PlanProblem, string> = {
  'no-legs': 'Add something to do from the map.',
  'queue-full': `The queue holds up to ${MAX_QUEUE_BLOCKS} blocks. Let some finish first.`,
  'bad-length': 'Each block needs at least half an hour, and a work order at least one item.',
  'unknown-activity': "That activity doesn't exist any more.",
  'wrong-region': "That can't be done there.",
  'region-locked': 'That region is still locked.',
  'level-too-low': 'Your level is too low for that.',
  'no-tool': "You don't have the tool for that.",
  'not-enough-time': "You don't have enough adventure time banked for all of that.",
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
        {p.short !== undefined && (
          <Body muted style={{ color: kitColors.red }}>Only enough for {p.count} of these; the rest of the time comes back to you.</Body>
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
  const { state, activeTrip, nowMs, send, error } = useGame();
  const plan = useDraftPlan();
  const [sending, setSending] = useState(false);
  if (!state) return null;

  const queue = queueRunning(activeTrip?.trip) ? activeTrip!.trip : null;
  // New blocks start after the queue, so preview them from the bank it should leave.
  const bankAfterQueue = queue ? previewPlan(state, remainingPlan(queue)).bankAfter : undefined;
  const preview = previewPlan(state, plan.legs, bankAfterQueue);
  const problem = checkPlan(state, plan.legs, queue?.legs.length ?? 0);
  const banked = Math.max(0, state.time.bankHours);
  const startsMs = queue ? Math.max(nowMs, queueEndsMs(queue)) : nowMs;
  const endsMs = startsMs + Math.round(preview.totalHours * 60) * 60 * 1000;

  /** The block's region and its remove button, in the panel header so the stepper row has room. */
  const header = (i: number, regionId: string, activityId: string) => (
    <View style={styles.header}>
      <Tag label={regionName(regionId)} />
      <KitButton compact kind="secondary" label="✕" accessibilityLabel={`Remove ${activityName(activityId)}`} onPress={() => plan.removeLeg(i)} />
    </View>
  );

  const onSend = async () => {
    setSending(true);
    try {
      await send(plan.legs);
      plan.clear();
      navigation.popToTop();
      // Back to Today to watch the trip.
      navigation.getParent()?.navigate(TABS.today);
    } catch {
      // the error shows below
    } finally {
      setSending(false);
    }
  };

  return (
    <KitScreen title="Add to queue" onBack={() => navigation.goBack()}>
      {preview.legs.map(({ plan: leg, problem: legProblem, preview: p }, i) => {
        const act = activityOf(leg.activityId);
        const isQuest = act?.kind === 'quest';
        const draft = plan.legs[i];
        if (isWorkOrder(draft) && act?.kind === 'method') {
          const most = Math.max(1, canMakeFrom(bankAfterQueue ?? state.bank, act.method));
          return (
            <Panel key={i} title={activityName(leg.activityId)} right={header(i, leg.regionId, leg.activityId)}>
              <View style={styles.stepper}>
                <KitButton compact kind="secondary" label="−" accessibilityLabel="One fewer" disabled={draft.count! <= 1}
                  onPress={() => plan.updateLeg(i, { ...draft, count: draft.count! - 1 })} />
                <Text style={[type.readout, styles.hours]} accessibilityLabel={`Make ${draft.count}`}>×{draft.count}</Text>
                <KitButton compact kind="secondary" label="+" accessibilityLabel="One more"
                  onPress={() => plan.updateLeg(i, { ...draft, count: draft.count! + 1 })} />
                <KitButton compact kind="secondary" label="All" accessibilityLabel={`As many as you can: ${most}`} disabled={draft.count === most}
                  onPress={() => plan.updateLeg(i, { ...draft, count: most })} />
              </View>
              <Tag label={formatHours(leg.hours)} accessibilityLabel={`Takes ${formatHours(leg.hours)}`} />
              {p && <Preview p={p} />}
              {legProblem && legProblem !== 'not-enough-time' && <Body style={{ color: kitColors.red }}>{PROBLEMS[legProblem]}</Body>}
            </Panel>
          );
        }
        return (
          <Panel key={i} title={activityName(leg.activityId)} right={header(i, leg.regionId, leg.activityId)}>
            <View style={styles.stepper}>
              {!isQuest && (
                <KitButton compact kind="secondary" label="−" accessibilityLabel="30 minutes less" disabled={leg.hours <= CHUNK_HOURS}
                  onPress={() => plan.updateLeg(i, { ...leg, hours: leg.hours - CHUNK_HOURS })} />
              )}
              <Text style={[type.readout, styles.hours]} accessibilityLabel={`${activityName(leg.activityId)}: ${formatHours(leg.hours)}`}>{formatHours(leg.hours)}</Text>
              {!isQuest && (
                <KitButton compact kind="secondary" label="+" accessibilityLabel="30 minutes more"
                  onPress={() => plan.updateLeg(i, { ...leg, hours: leg.hours + CHUNK_HOURS })} />
              )}
            </View>
            {p && <Preview p={p} />}
            {legProblem && legProblem !== 'not-enough-time' && <Body style={{ color: kitColors.red }}>{PROBLEMS[legProblem]}</Body>}
          </Panel>
        );
      })}

      <Panel title={queue ? 'Joins the queue' : 'Start the queue'}>
        <StatReadout label="Time" value={formatHours(preview.totalHours)} max={formatHours(banked)} tone={preview.totalHours > banked ? 'red' : 'green'} />
        {plan.legs.length > 0 && (
          <Body muted>
            {queue ? `After what's queued now. All done around ${clockTime(endsMs)}.` : `All done around ${clockTime(endsMs)}.`}
          </Body>
        )}
        {problem && <Body style={{ color: kitColors.red }}>{PROBLEMS[problem]}</Body>}
        {error && <Body style={{ color: kitColors.red }}>{error}</Body>}
        <ButtonRow>
          <KitButton label={sending ? 'Adding…' : queue ? 'Add to queue' : 'Start'} disabled={!!problem || sending} onPress={onSend} />
          <KitButton label="Pick more" kind="secondary" disabled={plan.legs.length >= MAX_QUEUE_BLOCKS} onPress={() => navigation.navigate('Map')} />
        </ButtonRow>
      </Panel>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hours: { minWidth: 92, textAlign: 'center', color: kitColors.text },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
