/**
 * The road to the Bog Warden on Today (PROD-021, PROD-032): the current step, its hint,
 * what it gives, and Collect (when done) or Go (to where it's done). Plus the welcome: three
 * short pages shown once on first open, skippable. One card, one step at a time, so Today
 * stays short; it disappears when the road is finished.
 */
import React, { useState } from 'react';
import { Image, ImageSourcePropType, Modal, StyleSheet, Text, View } from 'react-native';
import { currentJourneyStep, itemName, JOURNEY, JourneyTarget } from '../../game';
import { useGame } from '../../context/GameContext';
import {
  ADVENTURER_POSES, Body, ButtonRow, CREATURE_ICONS, FRAMES, ItemIcon, KitButton, kitColors, NineSlice, Panel, space, Tag, type,
} from '../../game-ui';

export function JourneyCard({ onGo }: { onGo: (target: JourneyTarget) => void }) {
  const { state, activeTrip, claimJourney } = useGame();
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const cur = currentJourneyStep(state, { queued: !!activeTrip });
  if (!cur) return null;
  const { step, index, done } = cur;
  const reward = Object.entries(step.reward);

  const collect = async () => {
    setBusy(true);
    try { await claimJourney(step.id); } catch { /* the error shows on Today */ } finally { setBusy(false); }
  };

  return (
    <Panel title="The road to the Bog Warden" right={<Tag label={`${index + 1}/${JOURNEY.length}`} tone="gold" accessibilityLabel={`Step ${index + 1} of ${JOURNEY.length}`} />}>
      <Text style={[type.bodyBold, done && { color: kitColors.green }]}>{done ? `Done: ${step.title}` : step.title}</Text>
      {!done && <Body muted>{step.hint}</Body>}
      {reward.length > 0 && (
        <View style={styles.reward}>
          <Text style={type.caption}>{done ? 'Your reward:' : 'Reward:'}</Text>
          {reward.map(([id, n]) => (
            <Tag key={id} label={`×${n}`} tone="gold" icon={<ItemIcon id={id} name={itemName(id)} size={20} />} accessibilityLabel={`${n} ${itemName(id)}`} />
          ))}
        </View>
      )}
      {done ? (
        <ButtonRow><KitButton label={busy ? 'Collecting…' : reward.length ? 'Collect' : 'Finish the road'} disabled={busy} onPress={collect} /></ButtonRow>
      ) : step.go ? (
        <ButtonRow><KitButton kind="secondary" label="Go" accessibilityLabel={`Go: ${step.title}`} onPress={() => onGo(step.go!)} /></ButtonRow>
      ) : null}
    </Panel>
  );
}

const MAP = require('../../../assets/game-ui/map/valley.png');

const PAGES: { title: string; text: string; image: ImageSourcePropType; square?: boolean }[] = [
  { title: 'Your habits are your adventure', text: 'Tick a habit on the Habits tab and your adventurer earns adventure time. Bigger habits earn more.', image: ADVENTURER_POSES.idle, square: true },
  { title: 'Spend it on the Map', text: 'Pick things to do in the valley. Your adventurer works through them in real time while you live your day.', image: MAP },
  { title: 'Your first goal', text: 'Follow the road to the Bog Warden on the Planner tab, one step at a time. Each step gives you something for the next.', image: CREATURE_ICONS.bog_warden, square: true },
];

/** Shown once, on the first open of the game (PROD-032). */
export function WelcomePages() {
  const { state, finishWelcome } = useGame();
  const [page, setPage] = useState(0);
  const [closing, setClosing] = useState(false);
  if (!state || state.journey.welcomed || closing) return null;
  const p = PAGES[page];
  const last = page === PAGES.length - 1;
  const close = () => { setClosing(true); finishWelcome().catch(() => setClosing(false)); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <NineSlice frame={FRAMES.panel} padding={space.md} style={styles.card}>
          <Text style={[type.title, styles.center]} accessibilityRole="header">{p.title}</Text>
          {p.square
            ? <Image source={p.image} style={styles.square} resizeMode="contain" accessibilityIgnoresInvertColors />
            : (
              // The whole map, small (drawn bare, it ran at full size past the card).
              <View style={styles.wide}><Image source={p.image} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors /></View>
            )}
          <Body style={styles.center}>{p.text}</Body>
          <Text style={[type.caption, styles.center]} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>{PAGES.map((_, i) => (i === page ? '●' : '○')).join(' ')}</Text>
          <ButtonRow>
            {!last && <KitButton kind="secondary" label="Skip" onPress={close} />}
            <KitButton label={last ? "Let's go" : 'Next'} onPress={() => (last ? close() : setPage(page + 1))} />
          </ButtonRow>
        </NineSlice>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  reward: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,5,2,0.8)', justifyContent: 'center', padding: space.gutter },
  card: { gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  center: { textAlign: 'center' },
  square: { width: 160, height: 160, alignSelf: 'center' },
  // The map's own 2:3 shape, as on the Map tab, so all of it shows.
  wide: { alignSelf: 'center', height: 240, aspectRatio: 2 / 3, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
