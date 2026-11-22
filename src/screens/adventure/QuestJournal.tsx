/**
 * The quest journal (owner note 2026-11-22, #5): the master list of every quest in the game,
 * as Hero's Quests section. Ready to start (with Start, which queues it), not yet (each
 * requirement shown met or missing, with progress), and done. The one home for quests; the
 * Village section keeps only the order board.
 */
import React, { useState } from 'react';
import { Alert, Image, StyleSheet } from 'react-native';
import { useGame } from '../../context/GameContext';
import {
  checkPlan, CREATURES, formatHours, GameState, itemName, Quest, questId, QuestRequirement, QUESTS, regionName, requirementMet,
} from '../../game';
import { Body, FRAMES, ItemIcon, KitButton, NeedsTag, NineSlice, Panel, Row, TAB_ICONS, Tag } from '../../game-ui';

const SLOT = 52;

/** A requirement as a tag, with progress where it counts up (kills, items). */
function Need({ r, state }: { r: QuestRequirement; state: GameState }) {
  const met = requirementMet(state, r);
  const tone = met ? 'green' : 'red';
  switch (r.kind) {
    case 'skill': return <NeedsTag skill={r.skill} level={r.level} met={met} />;
    case 'kills': {
      const name = CREATURES[r.creature]?.name ?? r.creature;
      const have = Math.min(state.kills[r.creature] ?? 0, r.count);
      return <Tag tone={tone} label={`${have}/${r.count}`} icon={<ItemIcon id={r.creature} name={name} size={20} />} accessibilityLabel={`Defeat ${r.count} ${name}: ${have} so far`} />;
    }
    case 'item': {
      const have = Math.min(state.bank[r.item] ?? 0, r.count);
      return <Tag tone={tone} label={`${have}/${r.count}`} icon={<ItemIcon id={r.item} name={itemName(r.item)} size={20} />} accessibilityLabel={`Bring ${r.count} ${itemName(r.item)}: you have ${have}`} />;
    }
    case 'quest': return <Tag tone={tone} label={`After: ${QUESTS[r.quest]?.name ?? r.quest}`} />;
  }
}

const QuestIcon = () => (
  <NineSlice frame={FRAMES.slot} style={styles.slot}><Image source={TAB_ICONS.activities} style={styles.icon} /></NineSlice>
);

export function QuestJournal() {
  const { state, activeTrip, send } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  if (!state) return null;
  const all = Object.values(QUESTS);
  const done = all.filter((q) => state.quests[q.id]);
  const ready = all.filter((q) => !state.quests[q.id] && q.requirements.every((r) => requirementMet(state, r)));
  const notYet = all.filter((q) => !state.quests[q.id] && !ready.includes(q));
  const queued = new Set((activeTrip && !activeTrip.trip.done ? activeTrip.trip.legs.filter((l) => !l.ended) : []).map((l) => l.activityId));

  const start = async (q: Quest) => {
    setBusy(q.id);
    try {
      await send([{ activityId: questId(q.id), regionId: q.region, hours: q.hours }]);
      Alert.alert('Added to the queue', `${q.name}: about ${formatHours(q.hours)}.`);
    } catch (e) {
      Alert.alert("Couldn't start that", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const rows = (list: Quest[], kind: 'ready' | 'notyet' | 'done') => list.map((q) => {
    const problem = kind === 'ready' ? checkPlan(state, [{ activityId: questId(q.id), regionId: q.region, hours: q.hours }]) : null;
    return (
      <Row
        key={q.id}
        dim={kind === 'done'}
        left={<QuestIcon />}
        title={q.name}
        subtitle={`${regionName(q.region)} · ${formatHours(q.hours)}`}
        detail={kind === 'done' ? <Tag label="Done" tone="green" /> : (
          <>
            {q.requirements.map((r, i) => <Need key={i} r={r} state={state} />)}
            {kind === 'ready' && (queued.has(questId(q.id)) ? <Tag label="In your queue" tone="gold" />
              : <KitButton compact label={busy === q.id ? '…' : 'Start'} disabled={!!busy || !!problem}
                  accessibilityLabel={`Start ${q.name}`} onPress={() => start(q)} />)}
          </>
        )}
      />
    );
  });

  return (
    <>
      {ready.length > 0 && <Panel title="Ready to start">{rows(ready, 'ready')}</Panel>}
      {notYet.length > 0 && <Panel title="Not yet">{rows(notYet, 'notyet')}</Panel>}
      {done.length > 0 && <Panel title="Done">{rows(done, 'done')}</Panel>}
      {all.length === 0 && <Panel><Body muted>No quests yet.</Body></Panel>}
    </>
  );
}

const styles = StyleSheet.create({
  slot: { width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' },
  icon: { width: SLOT * 0.62, height: SLOT * 0.62 },
});
