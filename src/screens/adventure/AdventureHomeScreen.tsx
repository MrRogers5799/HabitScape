/**
 * Planner (PROD-034; was Today): where the adventurer is and what they're doing, the road to
 * the Bog Warden (PROD-032), their queue (PROG-045: unstarted blocks can be resized or
 * removed), the log of what came back since you last looked, and adventure time (PROG-022).
 * Habits have their own tab now.
 */
import React, { useState } from 'react';
import { ActivityIndicator, ImageSourcePropType, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import {
  activityName, activityOf, blockHoursWorked, CREATURES, CHUNK_HOURS, clockTime, formatHours, isWorkOrder,
  GameSkill, itemName, Leg, queueEndsMs, regionName, reportHasNews, TripReport, unlocksBetween, WEEKLY_HOURS_CAP,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { TABS } from '../../navigation/newVersionTabs';
import { JourneyCard } from './Journey';
import {
  ADVENTURER_POSES, Body, ButtonRow, Chip, KitButton, KitScreen, kitColors, LootGrid, Panel, ProgressBar, Row, SceneBanner, SkillIcon, SkillTile,
  ItemIcon, space, StatReadout, Tag, type, XpChip,
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

/**
 * What's next in the queue (PROG-045). The block being worked lives in the scene banner
 * above, so it isn't repeated here (one home per thing, OQ-36). Call back sits here too.
 */
function QueuePanel({ legs, onResize, onRemove, onCallBack, busy }: {
  legs: Leg[]; busy: boolean;
  onResize: (index: number, size: { hours?: number; count?: number }) => void;
  onRemove: (index: number) => void;
  onCallBack: () => void;
}) {
  const current = legs.findIndex((l) => !l.ended);
  const rows = legs.map((l, i) => ({ l, i })).filter(({ l, i }) => !l.ended && i !== current);
  return (
    <Panel
      title="Up next"
      right={<KitButton compact kind="secondary" label="Call back" onPress={onCallBack} accessibilityLabel="Call back: stop now and get unworked time back" />}
    >
      {rows.length === 0 && <Body muted>Nothing else queued. Pick more on the Map.</Body>}
      {rows.map(({ l, i }) => {
        const order = isWorkOrder(l);
        const name = activityName(l.activityId);
        return (
          <Row
            key={`${i}-${l.activityId}`}
            title={name}
            accessibilityLabel={name}
            detail={(
              <>
                {order && <Tag label={`×${l.count}`} accessibilityLabel={`Make ${l.count}`} />}
                {l.focus && l.focus !== 'shared' && <Tag label={l.focus} tone="gold" accessibilityLabel={`${l.focus} XP`} />}
                <Tag label={formatHours(l.hours)} />
                <Tag label={regionName(l.regionId)} />
                {activityOf(l.activityId)?.kind !== 'quest' && (
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <KitButton compact kind="secondary" label="−" disabled={busy || (order ? l.count! <= 1 : l.hours <= CHUNK_HOURS)}
                  accessibilityLabel={order ? `One fewer ${name}` : `30 minutes less ${name}`}
                  onPress={() => onResize(i, order ? { count: l.count! - 1 } : { hours: l.hours - CHUNK_HOURS })} />
                <KitButton compact kind="secondary" label="+" disabled={busy}
                  accessibilityLabel={order ? `One more ${name}` : `30 minutes more ${name}`}
                  onPress={() => onResize(i, order ? { count: l.count! + 1 } : { hours: l.hours + CHUNK_HOURS })} />
                <KitButton compact kind="secondary" label="✕" disabled={busy} accessibilityLabel={`Remove ${name} from the queue`} onPress={() => onRemove(i)} />
              </View>
                )}
              </>
            )}
          />
        );
      })}
    </Panel>
  );
}

function ReturnCard({ report, onDone, home }: { report: TripReport; onDone: () => void; home: boolean }) {
  const items = Object.entries(report.gained).filter(([, n]) => n > 0) as [string, number][];
  const rare = new Set(report.found);
  // Rare finds first, then the biggest piles.
  items.sort(([a, x], [b, y]) => Number(rare.has(b)) - Number(rare.has(a)) || y - x);
  const xp = Object.entries(report.xp).filter(([, n]) => (n ?? 0) > 0);
  const kills = Object.entries(report.kills) as [string, number][];
  const levels = Object.entries(report.levelUps.reduce<Record<string, number>>((m, l) => ({ ...m, [l.skill]: Math.max(m[l.skill] ?? 0, l.level) }), {}));
  const empty = items.length === 0 && xp.length === 0 && kills.length === 0 && report.questsCompleted.length === 0;
  return (
    <Panel title={home ? 'Welcome back!' : 'While you were away'} right={report.found.length > 0 ? <Chip label="Rare find!" tone="gold" /> : undefined}>
      {/* One level-up gets the big line; several share one heading and a row of skill slots. */}
      {levels.length === 1 && (
        <StatReadout label={`Level up! ${levels[0][0]}`} value={String(levels[0][1])} tone="gold" icon={<SkillIcon skill={levels[0][0]} size={40} />} />
      )}
      {levels.length > 1 && (
        <>
          <Text style={[type.heading, { color: kitColors.gold }]}>Level up!</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {levels.map(([s, lvl]) => <SkillTile key={s} skill={s} level={lvl} />)}
          </View>
        </>
      )}
      {/* What each level-up unlocked (owner note 2026-11-22, #11). */}
      {levels.map(([s, lvl]) => {
        const from = Math.min(...report.levelUps.filter((l) => l.skill === s).map((l) => l.level)) - 1;
        const fresh = unlocksBetween(s as GameSkill, from, lvl);
        if (fresh.length === 0) return null;
        return (
          <View key={`new-${s}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Text style={type.caption}>New for {s}:</Text>
            {fresh.slice(0, 4).map((u) => <Tag key={u.key} label={u.title} tone="gold" icon={u.icon ? <ItemIcon id={u.icon} name={itemName(u.icon)} size={20} /> : undefined} />)}
            {fresh.length > 4 && <Tag label={`+${fresh.length - 4} more`} />}
          </View>
        );
      })}
      {report.questsCompleted.length > 0 && <Chip label="Quest complete!" tone="gold" />}
      {/* A rare find fills a collection log slot (PROG-047); pets say so by name. */}
      {[...new Set(report.found)].map((id) => <Chip key={id} label={`New in your collection log: ${itemName(id)}`} tone="gold" />)}
      {kills.length > 0 && <LootGrid items={kills} nameOf={(id) => CREATURES[id]?.name ?? id} />}
      {items.length > 0 && <LootGrid items={items} nameOf={itemName} />}
      {xp.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {xp.map(([s, n]) => <XpChip key={s} skill={s} amount={n ?? 0} />)}
        </View>
      )}
      {report.refundedHours > 0 && <Body muted>+{formatHours(report.refundedHours)} adventure time back</Body>}
      {[...new Set(report.notes)].slice(0, 3).map((n) => <Body key={n} muted>{n}</Body>)}
      {empty && <Body muted>Nothing this time.</Body>}
      <ButtonRow><KitButton label="Put it in the bank" onPress={onDone} /></ButtonRow>
    </Panel>
  );
}

export function AdventureHomeScreen({ navigation }: Props) {
  const { loading, state, activeTrip, nowMs, error, callBack, dismissReturn, resizeBlock, removeBlock } = useGame();
  const [editing, setEditing] = useState(false);
  const edit = (fn: () => Promise<void>) => {
    setEditing(true);
    // A failed edit shows in the error panel below.
    fn().catch(() => {}).finally(() => setEditing(false));
  };

  if (loading || !state) {
    return (
      <View style={{ flex: 1, backgroundColor: kitColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={kitColors.gold} />
      </View>
    );
  }

  const trip = activeTrip?.trip;
  const out = !!trip && !trip.done;
  // The log (PROG-045): what came back since the player last looked, while out or home.
  const showLog = !!activeTrip && reportHasNews(activeTrip.report);
  const home = !!trip && trip.done;
  const time = state.time;

  let status = 'Resting in Millbrook';
  let sub = time.bankHours > 0 ? 'Pick something to do on the Map' : 'Do a habit to earn adventure time';
  let progress: number | undefined;
  let progressLabel: string | undefined;
  let sceneRegion = 'millbrook';
  let pose = 'idle';
  if (out) {
    const leg = trip.legs.find((l) => !l.ended) ?? trip.legs[trip.legs.length - 1];
    const plannedHours = trip.legs.reduce((s, l) => s + l.hours - l.refundedHours, 0);
    const doneHours = trip.legs.reduce((s, l) => s + blockHoursWorked(l), 0);
    const backMs = queueEndsMs(trip);
    progress = plannedHours ? doneHours / plannedHours : 0;
    progressLabel = `${formatHours(Math.max(0, (backMs - nowMs) / 3600000))} left`;
    status = `Currently at ${regionName(leg.regionId)}`;
    sceneRegion = leg.regionId;
    pose = poseFor(leg.activityId);
    sub = `${activityName(leg.activityId)} · queue done at ${clockTime(backMs)}`;
  }

  // Back home with loot: cheering after a level-up, otherwise walking in with the pack.
  if (showLog && home) pose = activeTrip!.report.levelUps.length > 0 ? 'victorious' : 'walking_home';

  return (
    <KitScreen title="Planner">
      <SceneBanner compact source={SCENES[sceneRegion] ?? SCENES.millbrook} figure={ADVENTURER_POSES[pose] ?? ADVENTURER_POSES.idle} label={status} sublabel={sub} progress={progress} progressLabel={progressLabel} />

      {showLog && <ReturnCard report={activeTrip!.report} onDone={dismissReturn} home={home} />}

      {/* A new player's first goal, one step at a time (PROD-032). */}
      <JourneyCard
        onGo={(t) => ('tab' in t && t.tab === 'habits' ? navigation.getParent()?.navigate(TABS.habits)
          : 'tab' in t && t.tab === 'quests' ? navigation.getParent()?.navigate(TABS.hero, { screen: 'Hero', params: { section: 'quests' } })
          : navigation.getParent()?.navigate(TABS.map, 'tab' in t
          ? { screen: 'Map' }
          // initial: false keeps the Map under the region, so Back has somewhere to go.
          : { initial: false, screen: 'Region', params: { regionId: t.regionId, section: t.section } }))}
      />

      {/* Blocks are picked on the Map tab, their one home, and join the end of the queue (PROG-045). */}
      {out && (
        <QueuePanel
          legs={trip.legs}
          busy={editing}
          onCallBack={callBack}
          onResize={(i, size) => edit(() => resizeBlock(i, size))}
          onRemove={(i) => edit(() => removeBlock(i))}
        />
      )}

      <Panel title="Adventure time">
        {time.bankHours < 0 ? (
          <StatReadout label="In debt" value={formatHours(-time.bankHours)} tone="red" />
        ) : (
          <StatReadout label="Ready" value={formatHours(time.bankHours)} />
        )}
        <ProgressBar fraction={time.weekEarnedHours / WEEKLY_HOURS_CAP} color={kitColors.gold} />
        <Body muted>{formatHours(time.weekEarnedHours)} of {WEEKLY_HOURS_CAP}h earned this week{time.bankHours < 0 ? ' · habits pay the debt first' : ''}</Body>
      </Panel>

      {error && <Panel><Body style={{ color: kitColors.red }}>{error}</Body></Panel>}
    </KitScreen>
  );
}
