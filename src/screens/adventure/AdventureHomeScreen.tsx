/**
 * Adventure home (the "Today" hub of the beta): where the adventurer is, the
 * "Welcome back" moment when a trip ends, and adventure time (PROD-012, PROG-022).
 * First screen built with the new-version UI kit (PROD-024).
 */
import React from 'react';
import { ActivityIndicator, ImageSourcePropType, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import {
  activityName, activityOf, BANK_HOURS_CAP, CREATURES, CHUNK_HOURS, CHUNK_MS, clockTime, formatHours, itemName, regionName, TripReport, WEEKLY_HOURS_CAP,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  ADVENTURER_POSES, Body, ButtonRow, Chip, KitButton, KitScreen, kitColors, LootGrid, Panel, ProgressBar, SceneBanner, SkillIcon, SkillSlot, StatReadout, type, XpChip,
} from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'AdventureHome'>;

/** Region id → its scene; the banner shows where the adventurer is (home in Millbrook between trips). */
const SCENES: Record<string, ImageSourcePropType> = {
  millbrook: require('../../../assets/game-ui/scenes/millbrook.png'),
  greywood: require('../../../assets/game-ui/scenes/greywood.png'),
  stonecrest: require('../../../assets/game-ui/scenes/stonecrest.png'),
  bog: require('../../../assets/game-ui/scenes/bog.png'),
};

/** Which adventurer pose fits an activity (art bible §6); file ids in ADVENTURER_POSES. */
function poseFor(activityId: string): string {
  const act = activityOf(activityId);
  if (!act) return 'idle';
  if (act.kind === 'fight') return 'sparring';
  if (act.kind === 'quest') return 'walking_home';
  const m = act.method;
  switch (m.skill) {
    case 'Mining': return 'mining';
    case 'Woodcutting': return 'chopping';
    case 'Fishing': return m.kind === 'gather' && m.tool === 'small_net' ? 'fishing_net' : 'fishing_rod';
    case 'Smithing': return 'smithing';
    case 'Cooking': return 'cooking';
    case 'Prayer': return 'burying';
    default: return 'idle';
  }
}

function ReturnCard({ report, onDone }: { report: TripReport; onDone: () => void }) {
  const items = Object.entries(report.gained).filter(([, n]) => n > 0) as [string, number][];
  const rare = new Set(report.found);
  // Rare finds first, then the biggest piles.
  items.sort(([a, x], [b, y]) => Number(rare.has(b)) - Number(rare.has(a)) || y - x);
  const xp = Object.entries(report.xp).filter(([, n]) => (n ?? 0) > 0);
  const kills = Object.entries(report.kills) as [string, number][];
  const levels = Object.entries(report.levelUps.reduce<Record<string, number>>((m, l) => ({ ...m, [l.skill]: Math.max(m[l.skill] ?? 0, l.level) }), {}));
  const empty = items.length === 0 && xp.length === 0 && kills.length === 0 && report.questsCompleted.length === 0;
  return (
    <Panel title="Welcome back!" right={report.found.length > 0 ? <Chip label="Rare find!" tone="gold" /> : undefined}>
      {/* One level-up gets the big line; several share one heading and a row of skill slots. */}
      {levels.length === 1 && (
        <StatReadout label={`Level up! ${levels[0][0]}`} value={String(levels[0][1])} tone="gold" icon={<SkillIcon skill={levels[0][0]} size={40} />} />
      )}
      {levels.length > 1 && (
        <>
          <Text style={[type.heading, { color: kitColors.gold }]}>Level up!</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {levels.map(([s, lvl]) => <SkillSlot key={s} skill={s} level={lvl} size={52} />)}
          </View>
        </>
      )}
      {report.questsCompleted.length > 0 && <Chip label="Quest complete! Lamp on the Hero screen" tone="gold" />}
      {kills.length > 0 && <LootGrid items={kills} nameOf={(id) => CREATURES[id]?.name ?? id} />}
      {items.length > 0 && <LootGrid items={items} nameOf={itemName} />}
      {xp.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {xp.map(([s, n]) => <XpChip key={s} skill={s} amount={n ?? 0} />)}
        </View>
      )}
      {report.refundedHours > 0 && <Body muted>+{formatHours(report.refundedHours)} adventure time back</Body>}
      {empty && <Body muted>Nothing this time.</Body>}
      <ButtonRow><KitButton label="Put it in the bank" onPress={onDone} /></ButtonRow>
    </Panel>
  );
}

export function AdventureHomeScreen({ navigation }: Props) {
  const { loading, state, activeTrip, nowMs, error, callBack, dismissReturn } = useGame();

  if (loading || !state) {
    return (
      <View style={{ flex: 1, backgroundColor: kitColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={kitColors.gold} />
      </View>
    );
  }

  const trip = activeTrip?.trip;
  const out = !!trip && !trip.done;
  const showReturn = !!trip && trip.done && activeTrip!.seenMs === null;
  const time = state.time;

  let status = 'Resting in Millbrook';
  let sub = time.bankHours >= CHUNK_HOURS ? 'Ready for a trip' : 'Do a habit to earn adventure time';
  let progress: number | undefined;
  let progressLabel: string | undefined;
  let soFar: [string, number][] = [];
  let sceneRegion = 'millbrook';
  let pose = 'idle';
  if (out) {
    const leg = trip.legs.find((l) => !l.ended) ?? trip.legs[trip.legs.length - 1];
    const plannedHours = trip.legs.reduce((s, l) => s + l.hours - l.refundedHours, 0);
    const doneHours = trip.legs.reduce((s, l) => s + l.chunksDone * CHUNK_HOURS, 0);
    const backMs = trip.startMs + plannedHours * 2 * CHUNK_MS;
    progress = plannedHours ? doneHours / plannedHours : 0;
    progressLabel = `${formatHours(Math.max(0, (backMs - nowMs) / 3600000))} left`;
    status = `Currently at ${regionName(leg.regionId)}`;
    sceneRegion = leg.regionId;
    pose = poseFor(leg.activityId);
    sub = `${activityName(leg.activityId)} · back at ${clockTime(backMs)}`;
    soFar = (Object.entries(activeTrip!.report.gained) as [string, number][]).filter(([, n]) => n > 0).sort(([, x], [, y]) => y - x);
  }

  // Back home with loot: cheering after a level-up, otherwise walking in with the pack.
  if (showReturn) pose = activeTrip!.report.levelUps.length > 0 ? 'victorious' : 'walking_home';

  return (
    <KitScreen title="Adventure">
      <SceneBanner source={SCENES[sceneRegion] ?? SCENES.millbrook} figure={ADVENTURER_POSES[pose] ?? ADVENTURER_POSES.idle} label={status} sublabel={sub} progress={progress} progressLabel={progressLabel} />

      {showReturn && <ReturnCard report={activeTrip!.report} onDone={dismissReturn} />}

      <ButtonRow>
        {out ? (
          <KitButton label="Call back early" kind="secondary" onPress={callBack} />
        ) : (
          <KitButton label="Plan a trip" onPress={() => navigation.navigate('Map')} disabled={showReturn || time.bankHours < CHUNK_HOURS} />
        )}
        <KitButton label="Hero" kind="secondary" onPress={() => navigation.navigate('Hero')} />
      </ButtonRow>

      {out && soFar.length > 0 && <Panel title="So far"><LootGrid items={soFar} nameOf={itemName} /></Panel>}

      <Panel title="Adventure time">
        {time.bankHours < 0 ? (
          <StatReadout label="In debt" value={formatHours(-time.bankHours)} tone="red" />
        ) : (
          <StatReadout label="Ready" value={formatHours(time.bankHours)} max={`${BANK_HOURS_CAP}h`} />
        )}
        <ProgressBar fraction={time.weekEarnedHours / WEEKLY_HOURS_CAP} color={kitColors.gold} />
        <Body muted>{formatHours(time.weekEarnedHours)} of {WEEKLY_HOURS_CAP}h earned this week{time.bankHours < 0 ? ' · habits pay the debt first' : ''}</Body>
      </Panel>

      {error && <Panel><Body style={{ color: kitColors.red }}>{error}</Body></Panel>}
    </KitScreen>
  );
}
