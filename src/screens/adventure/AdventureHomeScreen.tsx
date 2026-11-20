/**
 * Adventure home (the "Today" hub of the beta): where the adventurer is, the
 * "Welcome back" moment when a trip ends, and adventure time (PROD-012, PROG-022).
 */
import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { colors } from '../../constants/colors';
import {
  activityName, BANK_HOURS_CAP, CREATURES, CHUNK_HOURS, CHUNK_MS, clockTime, formatHours, itemName, regionName, TripReport, WEEKLY_HOURS_CAP,
} from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { Bar, Body, Button, Heading, ItemTile, Panel, Row, styles } from './ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'AdventureHome'>;

function ReturnCard({ report, onDone }: { report: TripReport; onDone: () => void }) {
  const items = Object.entries(report.gained).filter(([, n]) => n > 0);
  const xp = Object.entries(report.xp).filter(([, n]) => (n ?? 0) > 0);
  const kills = Object.entries(report.kills);
  return (
    <Panel tone="gold">
      <Heading>WELCOME BACK!</Heading>
      {report.found.length > 0 && (
        <Body style={{ color: colors.gold }}>Rare find: {report.found.map(itemName).join(', ')}!</Body>
      )}
      {report.questsCompleted.length > 0 && <Body style={{ color: colors.successText }}>Quest complete! Your XP lamp is on the Hero screen.</Body>}
      {kills.length > 0 && <Body>{kills.map(([id, n]) => `${n} × ${CREATURES[id]?.name ?? id} defeated`).join(', ')}</Body>}
      {items.length > 0 && (
        <Row>{items.map(([id, n]) => <ItemTile key={id} name={itemName(id)} count={n} />)}</Row>
      )}
      {xp.length > 0 && <Body muted>{xp.map(([s, n]) => `+${Math.round(n ?? 0).toLocaleString()} ${s}`).join('  ·  ')}</Body>}
      {report.levelUps.length > 0 && (
        <Body style={{ color: colors.successText }}>
          Level up: {Object.entries(report.levelUps.reduce<Record<string, number>>((m, l) => ({ ...m, [l.skill]: Math.max(m[l.skill] ?? 0, l.level) }), {})).map(([s, lvl]) => `${s} ${lvl}`).join(', ')}
        </Body>
      )}
      {report.refundedHours > 0 && <Body muted>{formatHours(report.refundedHours)} came back to your adventure time. {report.notes[0] ?? ''}</Body>}
      {items.length === 0 && xp.length === 0 && kills.length === 0 && report.questsCompleted.length === 0 && (
        <Body muted>Nothing this time.</Body>
      )}
      <Button label="Put it in the bank" onPress={onDone} />
    </Panel>
  );
}

export function AdventureHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { loading, state, activeTrip, nowMs, error, callBack, dismissReturn } = useGame();

  if (loading || !state) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const trip = activeTrip?.trip;
  const out = !!trip && !trip.done;
  const showReturn = !!trip && trip.done && activeTrip!.seenMs === null;
  const time = state.time;

  let status = 'Resting at camp in Millbrook.';
  let sub = time.bankHours >= CHUNK_HOURS ? `${formatHours(time.bankHours)} of adventure time ready to spend.` : 'Do a habit to earn adventure time.';
  let progress = 0;
  if (out) {
    const leg = trip.legs.find((l) => !l.ended) ?? trip.legs[trip.legs.length - 1];
    const plannedHours = trip.legs.reduce((s, l) => s + l.hours - l.refundedHours, 0);
    const doneHours = trip.legs.reduce((s, l) => s + l.chunksDone * CHUNK_HOURS, 0);
    const backMs = trip.startMs + plannedHours * 2 * CHUNK_MS;
    progress = plannedHours ? doneHours / plannedHours : 0;
    status = `${activityName(leg.activityId)} in ${regionName(leg.regionId)}.`;
    const sofar = Object.entries(activeTrip!.report.gained).filter(([, n]) => n > 0).slice(0, 3).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`);
    sub = `Back at ${clockTime(backMs)} (${formatHours(Math.max(0, (backMs - nowMs) / 3600000))} to go)${sofar.length ? ` · so far: ${sofar.join(', ')}` : ''}`;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Adventure (beta)</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {showReturn && <ReturnCard report={activeTrip!.report} onDone={dismissReturn} />}

        <Panel>
          <Heading>YOUR ADVENTURER</Heading>
          <Body>{status}</Body>
          <Body muted>{sub}</Body>
          {out && <Bar fraction={progress} />}
          <Row>
            {out ? (
              <Button label="Call back early" kind="secondary" onPress={callBack} />
            ) : (
              <Button label="Plan a trip" onPress={() => navigation.navigate('Map')} disabled={showReturn || time.bankHours < CHUNK_HOURS} />
            )}
            <Button label="Hero" kind="secondary" onPress={() => navigation.navigate('Hero')} />
          </Row>
        </Panel>

        <Panel>
          <Heading>ADVENTURE TIME</Heading>
          <Body>
            {time.bankHours < 0 ? `In debt: ${formatHours(-time.bankHours)}. Your next habits pay it back first.` : `${formatHours(time.bankHours)} banked (holds up to ${BANK_HOURS_CAP}h)`}
          </Body>
          <Body muted>This week: {formatHours(time.weekEarnedHours)} of {WEEKLY_HOURS_CAP}h earned</Body>
          <Bar fraction={time.weekEarnedHours / WEEKLY_HOURS_CAP} color={colors.successLight} />
          <Body muted>Every habit you complete earns adventure time: about 4 hours for a typical 30–75 minute session.</Body>
        </Panel>

        {error && <Panel><Body style={{ color: colors.errorText }}>{error}</Body></Panel>}
      </ScrollView>
    </View>
  );
}
