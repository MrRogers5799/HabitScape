/**
 * Adding to the queue, as a popup (owner, 2026-11-22: picking copper, then tin, then smelting
 * meant a full trip through the planner page and back each time). Tap Add anywhere and this
 * opens over the screen you're on: set the time (or the count for crafting, PROG-043, and the
 * style for a fight, PROG-051), see what it should bring and your adventure time, then Add to
 * queue or Cancel. Either just closes it; a short note confirms the add. Also provides that
 * note (`notify`) for the item sheet and quest journal.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../../context/GameContext';
import {
  activityName, activityOf, canMakeFrom, checkPlan, CHUNK_HOURS, clockTime, CREATURES, formatHours, GameSkill, isWorkOrder, itemName, LegPlan,
  LegPreview, levelOf, lowestStyle, MAX_QUEUE_BLOCKS, MeleeFocus, PlanProblem, previewPlan, QuestRequirement, queueEndsMs, queueRunning,
  regionName, remainingPlan,
} from '../../game';
import {
  Body, ButtonRow, ItemIcon, ItemSlot, KitButton, KitModal, kitColors, kitFonts, NeedsTag, SkillTile, space, Tag, type, XpChip,
} from '../../game-ui';

/** Melee XP focus for a fight (PROG-051): one style; there's no even split to pick. */
const FOCUS: { label: string; value: MeleeFocus }[] = [
  { label: 'Attack', value: 'Attack' }, { label: 'Strength', value: 'Strength' }, { label: 'Defence', value: 'Defence' },
];

export const PROBLEMS: Record<PlanProblem, string> = {
  'no-legs': 'Pick something to do.',
  'queue-full': `The queue holds up to ${MAX_QUEUE_BLOCKS} blocks. Let some finish first.`,
  'bad-length': 'It needs at least half an hour, or at least one item for crafting.',
  'unknown-activity': "That activity doesn't exist any more.",
  'wrong-region': "That can't be done there.",
  'region-locked': 'That region is still locked.',
  'level-too-low': 'Your level is too low for that.',
  'no-tool': "You don't have the tool for that.",
  'not-enough-time': "You don't have enough adventure time banked for that.",
  'in-debt': 'Your adventure time is in debt. Do a habit to pay it back first.',
  'quest-done': "You've already finished that quest.",
  'quest-requirements': "You don't meet that quest's requirements yet.",
  'quest-length': 'Quests take their own length.',
  'needs-quest': 'A quest teaches that first.',
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

/** What a block should bring back and use, as icons. */
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

interface AddToQueueApi {
  /** Opens the popup for a block, with its starting size. */
  openAdd: (leg: LegPlan) => void;
  /** A short note over the screen, gone after a few seconds. */
  notify: (message: string) => void;
}

const AddToQueueContext = createContext<AddToQueueApi>({ openAdd: () => {}, notify: () => {} });
export const useAddToQueue = () => useContext(AddToQueueContext);

export function AddToQueueProvider({ children }: { children: React.ReactNode }) {
  const [leg, setLeg] = useState<LegPlan | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const notify = (message: string) => {
    setNote(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2600);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <AddToQueueContext.Provider value={{ openAdd: setLeg, notify }}>
      {children}
      <AddSheet leg={leg} onChange={setLeg} onClose={() => setLeg(null)} onAdded={notify} />
      {note && (
        <View pointerEvents="none" style={[styles.noteWrap, { top: insets.top + 64 }]}>
          <View style={styles.note} accessibilityLiveRegion="polite"><Text style={styles.noteText}>{note}</Text></View>
        </View>
      )}
    </AddToQueueContext.Provider>
  );
}

function AddSheet({ leg, onChange, onClose, onAdded }: {
  leg: LegPlan | null; onChange: (l: LegPlan) => void; onClose: () => void; onAdded: (message: string) => void;
}) {
  const { state, activeTrip, nowMs, send } = useGame();
  const [busy, setBusy] = useState(false);
  if (!leg || !state) return <KitModal visible={false} title="" onClose={onClose}>{null}</KitModal>;

  const act = activityOf(leg.activityId);
  const queue = queueRunning(activeTrip?.trip) ? activeTrip!.trip : null;
  // It starts after what's queued, so preview it from the bank the queue should leave.
  const bankAfterQueue = queue ? previewPlan(state, remainingPlan(queue)).bankAfter : undefined;
  const preview = previewPlan(state, [leg], bankAfterQueue);
  const shown = preview.legs[0];
  const problem = checkPlan(state, [leg], queue?.legs.length ?? 0);
  const banked = Math.max(0, state.time.bankHours);
  const hours = preview.totalHours;
  const startsMs = queue ? Math.max(nowMs, queueEndsMs(queue)) : nowMs;
  const endsMs = startsMs + Math.round(hours * 60) * 60 * 1000;
  const name = activityName(leg.activityId);
  const order = isWorkOrder(leg) && act?.kind === 'method';
  const most = order ? Math.max(1, canMakeFrom(bankAfterQueue ?? state.bank, act.method)) : 0;
  const isQuest = act?.kind === 'quest';

  const add = async () => {
    setBusy(true);
    try {
      await send([leg]);
      onClose();
      onAdded(`Added: ${name}${order ? ` ×${leg.count}` : ''}, ${formatHours(hours)}`);
    } catch (e) {
      onAdded(e instanceof Error ? `Couldn't add that: ${e.message}` : "Couldn't add that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitModal visible title={name} onClose={onClose}>
      <View style={styles.wrap}><Tag label={regionName(leg.regionId)} /></View>

      {order ? (
        <View style={styles.stepper}>
          <KitButton compact kind="secondary" label="−" accessibilityLabel="One fewer" disabled={leg.count! <= 1} onPress={() => onChange({ ...leg, count: leg.count! - 1 })} />
          <Text style={[type.readout, styles.amount]} accessibilityLabel={`Make ${leg.count}`}>×{leg.count}</Text>
          <KitButton compact kind="secondary" label="+" accessibilityLabel="One more" onPress={() => onChange({ ...leg, count: leg.count! + 1 })} />
          <KitButton compact kind="secondary" label="All" accessibilityLabel={`As many as you can: ${most}`} disabled={leg.count === most} onPress={() => onChange({ ...leg, count: most })} />
        </View>
      ) : !isQuest ? (
        <View style={styles.stepper}>
          <KitButton compact kind="secondary" label="−" accessibilityLabel="30 minutes less" disabled={leg.hours <= CHUNK_HOURS} onPress={() => onChange({ ...leg, hours: leg.hours - CHUNK_HOURS })} />
          <Text style={[type.readout, styles.amount]} accessibilityLabel={formatHours(leg.hours)}>{formatHours(leg.hours)}</Text>
          <KitButton compact kind="secondary" label="+" accessibilityLabel="30 minutes more" onPress={() => onChange({ ...leg, hours: leg.hours + CHUNK_HOURS })} />
        </View>
      ) : null}

      {act?.kind === 'fight' && (
        // Skill tiles with levels, so the choice shows why the lowest style comes first.
        <View style={styles.styles3}>
          {FOCUS.map((f) => (
            <SkillTile key={f.value} skill={f.value} level={levelOf(state, f.value as GameSkill)} selected={(leg.focus ?? lowestStyle(state)) === f.value}
              accessibilityLabel={`Train ${f.label}`} onPress={() => onChange({ ...leg, focus: f.value })} />
          ))}
        </View>
      )}

      {shown?.preview && <Preview p={shown.preview} />}

      {/* Adventure time: what this uses, what's banked, and when it should be done. */}
      <View style={styles.timeRow}>
        <Text style={[styles.time, hours > banked && styles.timeShort]}>{formatHours(hours)}</Text>
        <Text style={type.caption}>of {formatHours(banked)} banked · done around {clockTime(endsMs)}</Text>
      </View>
      {problem && <Body style={{ color: kitColors.red }}>{PROBLEMS[problem]}</Body>}

      <ButtonRow>
        <KitButton kind="secondary" label="Cancel" onPress={onClose} />
        <KitButton label={busy ? 'Adding…' : 'Add to queue'} disabled={!!problem || busy} onPress={add} />
      </ButtonRow>
    </KitModal>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  amount: { minWidth: 92, textAlign: 'center', color: kitColors.text },
  styles3: { flexDirection: 'row', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  time: { fontFamily: kitFonts.text, fontSize: 32, lineHeight: 34, color: kitColors.green },
  timeShort: { color: kitColors.red },
  noteWrap: { position: 'absolute', left: space.gutter, right: space.gutter, alignItems: 'center' },
  note: { backgroundColor: 'rgba(20,14,7,0.95)', borderWidth: 2, borderColor: kitColors.gold, paddingHorizontal: space.md, paddingVertical: space.sm },
  noteText: { fontFamily: kitFonts.text, fontSize: 21, lineHeight: 23, color: kitColors.text, textAlign: 'center' },
});
