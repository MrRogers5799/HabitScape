/**
 * A region: everything you can do there, shown as icons with their rate and level
 * (new-version kit, PROD-024/025). Tapping Add picks it for the queue (PROG-045); crafting
 * is added as a work order by count (PROG-043). The village's order board and melting
 * live here too (PROG-044). One section shows at a time (Gather, Make, Fight, Village) so
 * the page stays short (OQ-36). A region with a painted scene (PROD-037, Millbrook first)
 * opens on it: tap a spot (the mine, the forge, the order board) for a popup with that
 * spot's rows; the list is one tap away.
 */
import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import {
  activitiesIn, canMakeFrom, lowestStyle, CHUNK_HOURS, craftAndDeliverPlan, CREATURES, normaliseLeg, VillageOrder, effectiveRate, fightId, fightPreview, formatHours, itemName, levelOf, Method,
  orderFilled, ordersFor, QUESTS, queueRunning, REGIONS, weeklyOrderFor,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  ADVENTURER_POSES, Body, ButtonRow, FRAMES, ItemIcon, ItemSlot, KitButton, KitModal, KitScreen, kitColors, NeedsTag, NineSlice, Panel, Row,
  SkillIcon, SkillSlot, SectionTabs, space, Tag, type, XpChip,
} from '../../game-ui';
import { useAddToQueue } from './AddToQueue';
import { poseFor, REGION_SCENES, Spot, SpotContent, spotFor } from './regionScenes';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Region'>;
type Section = 'gather' | 'make' | 'fight' | 'village';

const SLOT = 52;

/**
 * Owner, 2026-11-22: tell "level too low" (the row greys out) from "level is fine, no
 * materials" (the row stays bright, with what's missing in red).
 */
function NoMaterials({ m, bank }: { m: Method; bank: Record<string, number> }) {
  if (m.kind !== 'process') return null;
  return (
    <>
      <Tag label="no materials" tone="red" />
      {Object.entries(m.inputs).map(([id, n]) => (
        <Tag key={id} label={`${bank[id] ?? 0}/${n}`} tone={(bank[id] ?? 0) >= n ? 'text' : 'red'} icon={<ItemIcon id={id} name={itemName(id)} size={20} />}
          accessibilityLabel={`Needs ${n} ${itemName(id)}, you have ${bank[id] ?? 0}`} />
      ))}
    </>
  );
}

/** What a method makes; for one that makes nothing (burying bones), what it uses; else its skill. */
function MethodIcon({ m }: { m: Method }) {
  const id = m.output ?? (m.kind === 'process' ? Object.keys(m.inputs)[0] : undefined);
  return id ? <ItemSlot id={id} name={itemName(id)} size={SLOT} /> : <SkillSlot skill={m.skill} size={SLOT} />;
}

/** A section of rows: a framed panel in the list; inside a spot's popup (`inSpot`, its title), just a heading (no frame in a frame), none when it would repeat the title. */
function Box({ title, inSpot, children }: { title: string; inSpot?: string; children: React.ReactNode }) {
  if (inSpot === undefined) return <Panel title={title}>{children}</Panel>;
  return (
    <View style={styles.flat}>
      {title !== inSpot && <Text style={[type.bodyBold, styles.flatTitle]}>{title}</Text>}
      {children}
    </View>
  );
}

export function RegionScreen({ navigation, route }: Props) {
  const { state, dayId, weekId, activeTrip, fillOrder, craftAndDeliver } = useGame();
  const { openAdd } = useAddToQueue();
  const region = REGIONS[route.params.regionId];
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [delivering, setDelivering] = useState<string | null>(null);
  // A link can open a given section (the road to the Bog Warden's Go button, PROD-032).
  const [section, setSection] = useState<Section | null>(route.params.section ?? null);
  // The scene is the default where there is one (PROD-037); a link to a section opens the list.
  const scene = REGION_SCENES[route.params.regionId];
  const [asList, setAsList] = useState(!scene || !!route.params.section);
  const [spot, setSpot] = useState<Spot | null>(null);
  // Inside a spot's own scene (the forge), or null for the region's.
  const [inside, setInside] = useState<Spot | null>(null);
  const spotTitle = spot?.label;
  // Back (the header's or Android's) steps out of an inside scene before leaving the region.
  useEffect(() => {
    if (!inside) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setInside(null); return true; });
    return () => sub.remove();
  }, [inside]);
  useEffect(() => {
    if (route.params.section) { setSection(route.params.section); setAsList(true); }
  }, [route.params.section]);
  if (!state || !region) return null;
  const locked = !!region.questGate && !state.quests[region.questGate];
  const showScene = !!scene && !asList && !locked;
  const showSceneInside = showScene && !!inside;
  const { methods, recipes, melts, fights } = activitiesIn(region.id);
  const meltable = melts.filter((m) => m.kind === 'process' && (state.bank[Object.keys(m.inputs)[0]] ?? 0) > 0);
  // Melting is taught by a quest (OQ-37); until then the section says which.
  const meltQuest = melts.find((m) => m.quest && !state.quests[m.quest])?.quest;
  // This week's larger order (PROG-054) and today's three, shown in their own panels.
  const weekly = locked ? null : weeklyOrderFor(state, region.id, weekId);
  const daily = locked ? [] : ordersFor(state, region.id, dayId, weekId);
  const orders = [...(weekly ? [weekly] : []), ...daily];
  // Orders already on their way through Craft & deliver: no second tap (owner, 2026-11-22).
  const onTheirWay = new Set((activeTrip && !activeTrip.trip.done ? activeTrip.trip.legs : [])
    .filter((l) => !l.ended && l.deliver).map((l) => l.deliver!.order.id));
  const gather = methods.filter((m) => m.kind === 'gather');
  const making = methods.filter((m) => m.kind === 'process');
  // Only the sections this region has; the first one shows until the player picks.
  const sections = ([
    ['gather', 'Gather', !locked && gather.length > 0],
    ['make', 'Make', !locked && (making.length > 0 || recipes.length > 0)],
    ['fight', 'Fight', !locked && fights.length > 0],
    // Quests live in Hero's quest journal now; the Village is the order board (owner note 2026-11-22).
    ['village', 'Village', orders.length > 0],
  ] as [Section, string, boolean][]).filter(([, , has]) => has).map(([value, label]) => ({ value, label }));
  const shown: Section | undefined = sections.find((o) => o.value === section)?.value ?? sections[0]?.value;
  const listed = shown === 'gather' ? gather : shown === 'make' ? making : [];
  // The anvil lists what you can make now, plus the next few unlocks; the rest behind a toggle.
  const makeable = recipes.filter((m) => levelOf(state, m.skill) >= m.level);
  const nextUp = recipes.filter((m) => levelOf(state, m.skill) < m.level).sort((a, b) => a.level - b.level).slice(0, 3);
  const shownRecipes = showAllRecipes ? recipes : [...makeable, ...nextUp];
  const defaultHours = Math.max(CHUNK_HOURS, Math.min(4, Math.floor(state.time.bankHours / CHUNK_HOURS) * CHUNK_HOURS));

  // Add opens the popup over this screen (owner, 2026-11-22): no trip to a planner page and back.
  // From a spot's popup, that one closes first so two popups never stack.
  const openOver = (leg: Parameters<typeof openAdd>[0]) => {
    if (!spot) return openAdd(leg);
    setSpot(null);
    setTimeout(() => openAdd(leg), 250);
  };
  const add = (activityId: string, hours = defaultHours) => openOver({ activityId, regionId: region.id, hours });
  /** Crafting goes in as a work order (PROG-043): a count, not hours. */
  const addOrder = (m: Method, count: number) => openOver({ activityId: m.id, regionId: region.id, hours: 0, count: Math.max(1, count) });
  const addMethod = (m: Method) => (m.kind === 'process' ? addOrder(m, canMakeFrom(state.bank, m)) : add(m.id));
  /** A fight goes in focused on the lowest melee style (PROG-051); the popup can switch it. */
  const addFight = (creatureId: string) => openOver({ activityId: fightId(creatureId), regionId: region.id, hours: defaultHours, focus: lowestStyle(state) });
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

  const renderOrder = (o: VillageOrder) => {
    const have = state.bank[o.item] ?? 0;
    const done = orderFilled(state, dayId, o);
    const coming = !done && onTheirWay.has(o.id);
    const name = itemName(o.item);
    // Craft & deliver (PROG-050) when the bank can make what's missing.
    const plan = !done && !coming && have < o.count ? craftAndDeliverPlan(state, o, dayId) : null;
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
            {o.combatLamp ? <Tag label={`+${o.combatLamp.toLocaleString()} combat lamp`} tone="gold" accessibilityLabel={`Pays a ${o.combatLamp.toLocaleString()} XP combat lamp`} /> : null}
            {/* The button sits under the tags so a long label never squeezes the item name. */}
            {coming ? <Tag label="On its way: in your queue" tone="gold" /> : (
              <KitButton compact label={delivering === o.id ? '…' : plan ? 'Craft & deliver' : 'Deliver'} disabled={(have < o.count && !plan) || !!delivering}
                onPress={() => deliver(o, !!plan)} accessibilityLabel={plan ? `Craft and deliver ${o.count} ${name}` : `Deliver ${o.count} ${name}`} />
            )}
          </>
        )}
      />
    );
  };

  const methodRow = (m: Method) => {
    const lvl = levelOf(state, m.skill);
    const ok = lvl >= m.level;
    const perHour = Math.round(effectiveRate(state, m, region.id));
    return (
      <Row
        key={m.id}
        dim={!ok}
        left={<MethodIcon m={m} />}
        title={m.name}
        detail={!ok ? <NeedsTag skill={m.skill} level={m.level} met={false} />
          : m.kind === 'process' && canMakeFrom(state.bank, m) === 0 ? <NoMaterials m={m} bank={state.bank} /> : (
          <>
            <Tag label={`${perHour}/h`} accessibilityLabel={`${perHour} per hour`} />
            <Tag
              label={`${(perHour * m.xpEach).toLocaleString()}/h`}
              icon={<SkillIcon skill={m.skill} size={20} />}
              tone="green"
              accessibilityLabel={`${(perHour * m.xpEach).toLocaleString()} ${m.skill} XP per hour`}
            />
          </>
        )}
        right={addButton(() => addMethod(m), !ok, m.name)}
      />
    );
  };

  /** Weekly and daily orders apart, so it's clear which is which (owner, 2026-11-22). */
  const orderPanels = () => (
    <>
      {weekly && (
        <Box title="This week's order" inSpot={spotTitle}>
          <Body muted>One big order, new each week, for double the XP.</Body>
          {renderOrder(weekly)}
        </Box>
      )}
      {daily.length > 0 && (
        <Box title="Today's orders" inSpot={spotTitle}>
          <Body muted>Small orders, new each day, for XP in the skills behind them.</Body>
          {daily.map(renderOrder)}
        </Box>
      )}
    </>
  );

  const anvilPanel = () => recipes.length > 0 && (
    <Box title="Anvil" inSpot={spotTitle}>
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
            detail={!ok ? <NeedsTag skill={m.skill} level={m.level} met={false} /> : have === 0 ? <NoMaterials m={m} bank={state.bank} /> : (
              <>
                {inputs.map(([id, n]) => (
                  <Tag key={id} label={`×${n}`} icon={<ItemIcon id={id} name={itemName(id)} size={20} />} accessibilityLabel={`Uses ${n} ${itemName(id)}`} />
                ))}
                <Tag label={`can make ${have}`} tone="green" />
              </>
            )}
            right={addButton(() => addOrder(m, 1), !ok, name)}
          />
        );
      })}
      <ButtonRow>
        <KitButton kind="secondary" label={showAllRecipes ? 'Show fewer' : 'Show all'} onPress={() => setShowAllRecipes(!showAllRecipes)} />
      </ButtonRow>
    </Box>
  );

  const meltPanel = () => meltable.length > 0 && (
    <Box title="Melt down" inSpot={spotTitle}>
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
            right={addButton(() => addOrder(m, owned), !!meltQuest, `melting ${name}`)}
          />
        );
      })}
    </Box>
  );

  const fightPanel = (list: typeof fights) => list.length > 0 && (
    // A spot's fights need no "Fights" heading: the spot (Wolf den, Bandit camp) already says so.
    <Box title="Fights" inSpot={spot ? 'Fights' : undefined}>
      {list.map((c) => {
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
            right={addButton(() => addFight(c.id), false, c.name)}
          />
        );
      })}
    </Box>
  );

  /** What a spot (or one of its parts) holds: the same rows as the list, filtered to it. */
  const contentBody = (c: SpotContent) => {
    const rows = methods.filter((m) => (m.kind === 'gather' ? c.gather : c.make)?.includes(m.skill));
    return (
      <>
        {rows.length > 0 && <View>{rows.map(methodRow)}</View>}
        {c.anvil && anvilPanel()}
        {c.melt && (meltable.length > 0 ? meltPanel() : <Body muted>No spare gear in your bank to melt down.</Body>)}
        {c.fights && fightPanel(fights.filter((f) => c.fights!.includes(f.id)))}
        {c.orders && (orders.length > 0 ? orderPanels() : <Body muted>No orders on the board right now.</Body>)}
      </>
    );
  };

  // Where the adventurer is working now, if it's here: shown at that spot in the scene.
  const working = queueRunning(activeTrip?.trip) ? activeTrip!.trip.legs.find((l) => !l.ended) : undefined;
  const shownScene = inside?.inside ?? scene;
  const workingSpot = shownScene && working?.regionId === region.id ? spotFor(shownScene, working.activityId) : undefined;
  const openOrders = orders.filter((o) => !orderFilled(state, dayId, o)).length;


  return (
    <KitScreen
      title={showSceneInside ? inside!.label : region.name}
      onBack={() => (showSceneInside ? setInside(null) : navigation.goBack())}
      right={scene && !locked ? (
        <KitButton compact kind="secondary" label={asList ? 'Scene' : 'List'} onPress={() => setAsList(!asList)}
          accessibilityLabel={asList ? `Show ${region.name} as a scene` : `Show ${region.name} as a list`} />
      ) : undefined}
    >
      {locked && (
        <Panel><Body style={{ color: kitColors.red }}>Locked: finish the quest {QUESTS[region.questGate!]?.name} to travel here.</Body></Panel>
      )}

      {showScene ? (
        <View style={[styles.scene, { aspectRatio: shownScene.aspect }]}>
          <View style={[StyleSheet.absoluteFill, styles.sceneClip]}>
            <Image source={shownScene.image} style={styles.sceneImage} resizeMode="cover" accessibilityIgnoresInvertColors />
            {workingSpot && working && (
              <Image
                source={ADVENTURER_POSES[poseFor(working.activityId)] ?? ADVENTURER_POSES.idle}
                style={[styles.figure, { left: `${workingSpot.x * 100}%`, top: `${workingSpot.y * 100}%` }]}
                resizeMode="contain"
                accessibilityLabel="Your adventurer is working here"
              />
            )}
            {shownScene.spots.map((sp) => {
              const note = sp.orders && openOrders > 0 ? `${openOrders} open` : workingSpot?.id === sp.id ? 'Working here' : undefined;
              return (
                <Pressable
                  key={sp.id}
                  onPress={() => (sp.inside ? setInside(sp) : setSpot(sp))}
                  accessibilityRole="button"
                  accessibilityLabel={`${sp.label}${note ? `, ${note}` : ''}${sp.inside ? ', go inside' : ''}`}
                  hitSlop={12}
                  style={({ pressed }) => [styles.pin, { left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }, pressed && styles.pressed]}
                >
                  <View style={[styles.pinPlate, note !== undefined && styles.pinLit]}>
                    <Text style={[type.caption, styles.pinText]} numberOfLines={1}>{sp.label}</Text>
                    {note !== undefined && <Text style={[type.caption, styles.pinNote]} numberOfLines={1}>{note}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <NineSlice frame={FRAMES.sceneFrame} hollow style={StyleSheet.absoluteFill} />
        </View>
      ) : (
        <>
          {sections.length > 1 && shown && <SectionTabs options={sections} value={shown} onChange={setSection} />}
          {/* No panel title: the selected section button already names it. */}
          {listed.length > 0 && <Panel>{listed.map(methodRow)}</Panel>}
          {shown === 'village' && orderPanels()}
          {shown === 'make' && anvilPanel()}
          {shown === 'make' && meltPanel()}
          {shown === 'fight' && fightPanel(fights)}
        </>
      )}

      <KitModal visible={!!spot} title={spotTitle ?? ''} onClose={() => setSpot(null)}>
        {spot && contentBody(spot)}
      </KitModal>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  scene: { width: '100%' },
  sceneClip: { overflow: 'hidden', margin: 6 },
  sceneImage: { width: '100%', height: '100%' },
  // A pin is centred on its point: shifted back by half of a generous fixed width.
  pin: { position: 'absolute', width: 160, marginLeft: -80, marginTop: -18, alignItems: 'center' },
  pinPlate: {
    backgroundColor: 'rgba(20,14,7,0.85)', borderWidth: 2, borderColor: kitColors.gold,
    paddingHorizontal: space.xs, paddingVertical: 2, minHeight: 32, justifyContent: 'center', alignItems: 'center',
  },
  pinLit: { backgroundColor: 'rgba(60,40,10,0.95)', borderWidth: 3 },
  pinText: { color: kitColors.text, fontSize: 15, lineHeight: 18 },
  pinNote: { color: kitColors.gold, fontSize: 13, lineHeight: 16 },
  pressed: { opacity: 0.7 },
  flat: { gap: space.xs, marginTop: space.sm },
  flatTitle: { color: kitColors.gold },
  // The adventurer stands just above and left of the spot's pin.
  figure: { position: 'absolute', width: 72, height: 72, marginLeft: -88, marginTop: -64 },
});
