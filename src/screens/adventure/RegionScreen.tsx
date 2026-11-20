/**
 * A region: everything you can do there, shown as icons with their rate and level
 * (new-version kit, PROD-024/025). Tapping Add puts it in the trip plan (up to three legs, PROG-026).
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import {
  activitiesIn, CHUNK_HOURS, effectiveRate, fightId, fightPreview, formatHours, itemName, levelOf, MAX_LEGS, Method, questId, QUESTS, REGIONS,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, ButtonRow, FRAMES, ItemIcon, ItemSlot, KitButton, KitScreen, kitColors, NeedsTag, NineSlice, Panel, Row, SkillIcon, SkillSlot,
  space, TAB_ICONS, Tag,
} from '../../game-ui';
import { useDraftPlan } from './draftPlan';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Region'>;

const SLOT = 52;

/** What a method makes; for one that makes nothing (burying bones), what it uses; else its skill. */
function MethodIcon({ m }: { m: Method }) {
  const id = m.output ?? (m.kind === 'process' ? Object.keys(m.inputs)[0] : undefined);
  return id ? <ItemSlot id={id} name={itemName(id)} size={SLOT} /> : <SkillSlot skill={m.skill} size={SLOT} />;
}

export function RegionScreen({ navigation, route }: Props) {
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
  const addButton = (onPress: () => void, disabled: boolean, what: string) => (
    <KitButton compact label="Add" disabled={disabled} onPress={onPress} accessibilityLabel={`Add ${what} to the trip`} />
  );

  return (
    <KitScreen title={region.name} onBack={() => navigation.goBack()}>
      {locked && (
        <Panel><Body style={{ color: kitColors.red }}>Locked: finish the quest {QUESTS[region.questGate!]?.name} to travel here.</Body></Panel>
      )}
      {plan.legs.length > 0 && (
        <Panel>
          <View style={styles.planRow}>
            <Tag label={`Trip: ${plan.legs.length}/${MAX_LEGS} legs`} tone="gold" />
            <KitButton compact kind="secondary" label="Open plan" onPress={() => navigation.navigate('Planner')} />
          </View>
        </Panel>
      )}

      {!locked && methods.length > 0 && (
        <Panel title="Things to do">
          {methods.map((m) => {
            const lvl = levelOf(state, m.skill);
            const ok = lvl >= m.level;
            const perHour = Math.round(effectiveRate(state, m, region.id));
            return (
              <Row
                key={m.id}
                dim={!ok}
                left={<MethodIcon m={m} />}
                title={m.name}
                detail={ok ? (
                  <>
                    <Tag label={`${perHour}/h`} accessibilityLabel={`${perHour} per hour`} />
                    <Tag
                      label={`${(perHour * m.xpEach).toLocaleString()}/h`}
                      icon={<SkillIcon skill={m.skill} size={20} />}
                      tone="green"
                      accessibilityLabel={`${(perHour * m.xpEach).toLocaleString()} ${m.skill} XP per hour`}
                    />
                  </>
                ) : <NeedsTag skill={m.skill} level={m.level} met={false} />}
                right={addButton(() => add(m.id), !ok || full, m.name)}
              />
            );
          })}
        </Panel>
      )}

      {!locked && recipes.length > 0 && (
        <Panel title="At the anvil">
          {shownRecipes.map((m) => {
            const lvl = levelOf(state, m.skill);
            const ok = lvl >= m.level;
            const inputs = m.kind === 'process' ? Object.entries(m.inputs) : [];
            const have = inputs.length ? Math.min(...inputs.map(([id, n]) => Math.floor((state.bank[id] ?? 0) / n))) : 0;
            const name = m.output ? itemName(m.output) : m.name;
            return (
              <Row
                key={m.id}
                dim={!ok}
                left={m.output ? <ItemSlot id={m.output} name={name} size={SLOT} /> : <SkillSlot skill={m.skill} size={SLOT} />}
                title={name}
                detail={ok ? (
                  <>
                    {inputs.map(([id, n]) => (
                      <Tag key={id} label={`×${n}`} icon={<ItemIcon id={id} name={itemName(id)} size={20} />} accessibilityLabel={`Uses ${n} ${itemName(id)}`} />
                    ))}
                    <Tag label={`can make ${have}`} tone={have > 0 ? 'green' : 'red'} />
                  </>
                ) : <NeedsTag skill={m.skill} level={m.level} met={false} />}
                right={addButton(() => add(m.id, CHUNK_HOURS), !ok || full, name)}
              />
            );
          })}
          <ButtonRow>
            <KitButton kind="secondary" label={showAllRecipes ? 'Show fewer' : 'Show all'} onPress={() => setShowAllRecipes(!showAllRecipes)} />
          </ButtonRow>
        </Panel>
      )}

      {!locked && fights.length > 0 && (
        <Panel title="Fights">
          {fights.map((c) => {
            const p = fightPreview(state, c);
            const win = Math.round(p.winChance * 100);
            return (
              <Row
                key={c.id}
                left={<ItemSlot id={c.id} name={c.name} size={SLOT} />}
                title={c.name}
                detail={(
                  <>
                    <Tag label={`Lv ${c.level}`} accessibilityLabel={`Level ${c.level}`} />
                    <Tag label={`${win}% win`} tone={win >= 80 ? 'green' : win >= 50 ? 'gold' : 'red'} />
                    <Tag label={`${p.killsPerHour.toFixed(1)}/h`} accessibilityLabel={`${p.killsPerHour.toFixed(1)} kills per hour`} />
                    {c.boss && <Tag label="Boss" tone="gold" />}
                    {c.weakness && <Tag label={`Weak: ${c.weakness}`} />}
                  </>
                )}
                right={addButton(() => add(fightId(c.id)), full, c.name)}
              />
            );
          })}
        </Panel>
      )}

      {quests.length > 0 && (
        <Panel title="Quest board" icon={TAB_ICONS.activities}>
          {quests.map((q) => {
            const done = !!state.quests[q.id];
            return (
              <Row
                key={q.id}
                dim={done}
                left={(
                  <NineSlice frame={FRAMES.slot} style={styles.questSlot}>
                    <Image source={TAB_ICONS.activities} style={styles.questIcon} />
                  </NineSlice>
                )}
                title={q.name}
                detail={done ? <Tag label="Done" tone="green" /> : <Tag label={formatHours(q.hours)} accessibilityLabel={`Takes ${formatHours(q.hours)}`} />}
                right={addButton(() => add(questId(q.id), q.hours), done || full, q.name)}
              />
            );
          })}
        </Panel>
      )}
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  questSlot: { width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' },
  questIcon: { width: SLOT * 0.62, height: SLOT * 0.62 },
});
