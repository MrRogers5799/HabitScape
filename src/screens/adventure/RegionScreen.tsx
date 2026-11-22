/**
 * A region: everything you can do there, shown as icons with their rate and level
 * (new-version kit, PROD-024/025). Tapping Add picks it for the queue (PROG-045); crafting
 * is added as a work order by count (PROG-043). The village's order board and melting
 * live here too (PROG-044). One section shows at a time (Gather, Make, Fight, Village) so
 * the page stays short (OQ-36).
 */
import React, { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import {
  activitiesIn, canMakeFrom, lowestStyle, CHUNK_HOURS, craftAndDeliverPlan, CREATURES, normaliseLeg, VillageOrder, effectiveRate, fightId, fightPreview, formatHours, itemName, levelOf, MAX_QUEUE_BLOCKS, Method,
  orderFilled, ordersFor, questId, QUESTS, REGIONS,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, ButtonRow, FRAMES, ItemIcon, ItemSlot, KitButton, KitScreen, kitColors, NeedsTag, NineSlice, Panel, Row, SkillIcon, SkillSlot,
  SectionTabs, space, TAB_ICONS, Tag, XpChip,
} from '../../game-ui';
import { useDraftPlan } from './draftPlan';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Region'>;
type Section = 'gather' | 'make' | 'fight' | 'village';

const SLOT = 52;

/** What a method makes; for one that makes nothing (burying bones), what it uses; else its skill. */
function MethodIcon({ m }: { m: Method }) {
  const id = m.output ?? (m.kind === 'process' ? Object.keys(m.inputs)[0] : undefined);
  return id ? <ItemSlot id={id} name={itemName(id)} size={SLOT} /> : <SkillSlot skill={m.skill} size={SLOT} />;
}

export function RegionScreen({ navigation, route }: Props) {
  const { state, dayId, fillOrder, craftAndDeliver } = useGame();
  const plan = useDraftPlan();
  const region = REGIONS[route.params.regionId];
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [delivering, setDelivering] = useState<string | null>(null);
  // A link can open a given section (the road to the Bog Warden's Go button, PROD-032).
  const [section, setSection] = useState<Section | null>(route.params.section ?? null);
  useEffect(() => { if (route.params.section) setSection(route.params.section); }, [route.params.section]);
  if (!state || !region) return null;
  const locked = !!region.questGate && !state.quests[region.questGate];
  const { methods, recipes, melts, fights, quests } = activitiesIn(region.id);
  const meltable = melts.filter((m) => m.kind === 'process' && (state.bank[Object.keys(m.inputs)[0]] ?? 0) > 0);
  // Melting is taught by a quest (OQ-37); until then the section says which.
  const meltQuest = melts.find((m) => m.quest && !state.quests[m.quest])?.quest;
  const orders = locked ? [] : ordersFor(state, region.id, dayId);
  const gather = methods.filter((m) => m.kind === 'gather');
  const making = methods.filter((m) => m.kind === 'process');
  // Only the sections this region has; the first one shows until the player picks.
  const sections = ([
    ['gather', 'Gather', !locked && gather.length > 0],
    ['make', 'Make', !locked && (making.length > 0 || recipes.length > 0)],
    ['fight', 'Fight', !locked && fights.length > 0],
    ['village', 'Village', quests.length > 0 || orders.length > 0],
  ] as [Section, string, boolean][]).filter(([, , has]) => has).map(([value, label]) => ({ value, label }));
  const shown: Section | undefined = sections.find((o) => o.value === section)?.value ?? sections[0]?.value;
  const listed = shown === 'gather' ? gather : shown === 'make' ? making : [];
  // The anvil lists what you can make now, plus the next few unlocks; the rest behind a toggle.
  const makeable = recipes.filter((m) => levelOf(state, m.skill) >= m.level);
  const nextUp = recipes.filter((m) => levelOf(state, m.skill) < m.level).sort((a, b) => a.level - b.level).slice(0, 3);
  const shownRecipes = showAllRecipes ? recipes : [...makeable, ...nextUp];
  const full = plan.legs.length >= MAX_QUEUE_BLOCKS;
  const defaultHours = Math.max(CHUNK_HOURS, Math.min(4, Math.floor(state.time.bankHours / CHUNK_HOURS) * CHUNK_HOURS));

  const add = (activityId: string, hours = defaultHours) => {
    if (plan.addLeg({ activityId, regionId: region.id, hours })) navigation.navigate('Planner');
  };
  /** Crafting goes in as a work order (PROG-043): a count, not hours. */
  const addOrder = (m: Method, count: number) => {
    if (plan.addLeg({ activityId: m.id, regionId: region.id, hours: 0, count: Math.max(1, count) })) navigation.navigate('Planner');
  };
  const addMethod = (m: Method) => (m.kind === 'process' ? addOrder(m, canMakeFrom(state.bank, m)) : add(m.id));
  /** A fight goes in focused on the lowest melee style (PROG-051); the planner can switch it. */
  const addFight = (creatureId: string) => {
    if (plan.addLeg({ activityId: fightId(creatureId), regionId: region.id, hours: defaultHours, focus: lowestStyle(state) })) navigation.navigate('Planner');
  };
  const addButton = (onPress: () => void, disabled: boolean, what: string) => (
    <KitButton compact label="Add" disabled={disabled} onPress={onPress} accessibilityLabel={`Add ${what} to the queue`} />
  );
  const deliver = async (order: VillageOrder, craft: boolean) => {
    setDelivering(order.id);
    try {
      if (craft) await craftAndDeliver(order);
      else await fillOrder(order);
    } catch (e) {
      Alert.alert("Couldn't deliver that", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setDelivering(null);
    }
  };

  return (
    <KitScreen title={region.name} onBack={() => navigation.goBack()}>
      {locked && (
        <Panel><Body style={{ color: kitColors.red }}>Locked: finish the quest {QUESTS[region.questGate!]?.name} to travel here.</Body></Panel>
      )}
      {plan.legs.length > 0 && (
        <Panel>
          <View style={styles.planRow}>
            <Tag label={`Picked: ${plan.legs.length}`} tone="gold" accessibilityLabel={`${plan.legs.length} picked for the queue`} />
            <KitButton compact kind="secondary" label="Review" onPress={() => navigation.navigate('Planner')} />
          </View>
        </Panel>
      )}

      {sections.length > 1 && shown && <SectionTabs options={sections} value={shown} onChange={setSection} />}

      {listed.length > 0 && (
        // No panel title: the selected section button already names it.
        <Panel>
          {listed.map((m) => {
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
                right={addButton(() => addMethod(m), !ok || full, m.name)}
              />
            );
          })}
        </Panel>
      )}

      {shown === 'village' && orders.length > 0 && (
        <Panel title="Order board">
          <Body muted>Villagers want these today, for XP in the skills behind them.</Body>
          {orders.map((o) => {
            const have = state.bank[o.item] ?? 0;
            const done = orderFilled(state, dayId, o.id);
            const name = itemName(o.item);
            // Craft & deliver (PROG-050) when the bank can make what's missing.
            const plan = !done && have < o.count ? craftAndDeliverPlan(state, o, dayId) : null;
            const craftHrs = plan ? plan.reduce((h, l) => h + normaliseLeg(state, l).hours, 0) : 0;
            const creature = o.creature ? CREATURES[o.creature] : undefined;
            return (
              <Row
                key={o.id}
                dim={done}
                left={<ItemSlot id={o.item} name={name} count={o.count} size={SLOT} />}
                title={name}
                detail={done ? <Tag label="Delivered" tone="green" /> : (
                  <>
                    <Tag label={`have ${have}/${o.count}`} tone={have >= o.count ? 'green' : plan ? 'gold' : 'red'} accessibilityLabel={`You have ${have} of ${o.count}`} />
                    {plan && <Tag label={`make ${formatHours(craftHrs)}`} accessibilityLabel={`Your bank can make the rest in ${formatHours(craftHrs)}`} />}
                    {creature && <Tag label={creature.name} icon={<ItemIcon id={creature.id} name={creature.name} size={20} />} accessibilityLabel={`Dropped by ${creature.name}`} />}
                    {(Object.entries(o.xp) as [string, number][]).map(([skill, n]) => <XpChip key={skill} skill={skill} amount={n} />)}
                    {/* The button sits under the tags so a long label never squeezes the item name. */}
                    <KitButton compact label={delivering === o.id ? '…' : plan ? 'Craft & deliver' : 'Deliver'} disabled={(have < o.count && !plan) || !!delivering}
                      onPress={() => deliver(o, !!plan)} accessibilityLabel={plan ? `Craft and deliver ${o.count} ${name}` : `Deliver ${o.count} ${name}`} />
                  </>
                )}
              />
            );
          })}
        </Panel>
      )}

      {shown === 'make' && recipes.length > 0 && (
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
                right={addButton(() => addOrder(m, 1), !ok || full, name)}
              />
            );
          })}
          <ButtonRow>
            <KitButton kind="secondary" label={showAllRecipes ? 'Show fewer' : 'Show all'} onPress={() => setShowAllRecipes(!showAllRecipes)} />
          </ButtonRow>
        </Panel>
      )}

      {shown === 'make' && meltable.length > 0 && (
        <Panel title="Melt down">
          {meltQuest
            ? <Body muted>Finish the quest {QUESTS[meltQuest]?.name} to learn melting: spare gear back into half its bars.</Body>
            : <Body muted>Spare gear goes back into half its bars. Melting gives no XP.</Body>}
          {meltable.map((m) => {
            if (m.kind !== 'process') return null;
            const gear = Object.keys(m.inputs)[0];
            const owned = state.bank[gear] ?? 0;
            const name = itemName(gear);
            return (
              <Row
                key={m.id}
                left={<ItemSlot id={gear} name={name} count={owned} size={SLOT} />}
                title={name}
                detail={m.output ? (
                  <Tag label={`→ ${m.outputEach ?? 1} each`} icon={<ItemIcon id={m.output} name={itemName(m.output)} size={20} />}
                    accessibilityLabel={`Gives ${m.outputEach ?? 1} ${itemName(m.output)} each`} />
                ) : undefined}
                right={addButton(() => addOrder(m, owned), full || !!meltQuest, `melting ${name}`)}
              />
            );
          })}
        </Panel>
      )}

      {shown === 'fight' && fights.length > 0 && (
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
                right={addButton(() => addFight(c.id), full, c.name)}
              />
            );
          })}
        </Panel>
      )}

      {shown === 'village' && quests.length > 0 && (
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
