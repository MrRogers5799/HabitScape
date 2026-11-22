/**
 * The Hero room (PROD-037): the adventurer standing on a dais in a stone alcove, with what
 * they wear and the tools they use in slots on either side (concept mockup 5). A filled
 * slot opens the item sheet; an empty one says what goes there. The art is the empty
 * alcove; the adventurer is a separate layer (art bible §5).
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { GameState, ITEMS, itemName, Slot, ToolType, wornGear } from '../../game';
import { ADVENTURER_POSES, FRAMES, ItemSlot, NineSlice } from '../../game-ui';

const ROOM = require('../../../assets/game-ui/scenes/hero_room.png');
const SLOT = 44;

type Place = { label: string; slot?: Slot; tools?: ToolType[] };
/** Weapon side on the left, armour on the right; tools under each. */
const LEFT: Place[] = [
  { label: 'Weapon', slot: 'mainHand' }, { label: 'Shield', slot: 'offHand' }, { label: 'Gloves', slot: 'gloves' },
  { label: 'Pickaxe', tools: ['pickaxe'] }, { label: 'Hatchet', tools: ['hatchet'] },
];
const RIGHT: Place[] = [
  { label: 'Helm', slot: 'head' }, { label: 'Body', slot: 'chest' }, { label: 'Legs', slot: 'legs' }, { label: 'Boots', slot: 'boots' },
  { label: 'Fishing', tools: ['fishing_rod', 'small_net'] },
];

export function HeroRoom({ state }: { state: GameState }) {
  const worn = [...wornGear(state)];
  const holding = (p: Place) => worn.find((id) => (p.slot ? ITEMS[id]?.equip?.slot === p.slot : p.tools!.includes(ITEMS[id]?.tool?.type as ToolType)));
  const column = (places: Place[]) => (
    <View style={styles.column}>
      {places.map((p) => {
        const id = holding(p);
        return id ? <ItemSlot key={p.label} id={id} name={itemName(id)} size={SLOT} />
          : (
            <View key={p.label} accessible accessibilityLabel={`${p.label}: nothing yet`}>
              <NineSlice frame={FRAMES.slot} style={styles.empty} />
            </View>
          );
      })}
    </View>
  );
  return (
    <View style={styles.room}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <Image source={ROOM} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
        <Image source={ADVENTURER_POSES.idle} style={styles.figure} resizeMode="contain" accessibilityLabel="Your adventurer" />
        <View style={styles.sides}>
          {column(LEFT)}
          {column(RIGHT)}
        </View>
      </View>
      <NineSlice frame={FRAMES.sceneFrame} hollow style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  room: { aspectRatio: 1.25, width: '100%' },
  clip: { overflow: 'hidden', margin: 6 },
  image: { width: '100%', height: '100%' },
  // Standing on the dais, which sits low in the middle of the art.
  figure: { position: 'absolute', width: '58%', height: '72%', left: '21%', bottom: '9%' },
  sides: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
  column: { justifyContent: 'space-between' },
  empty: { width: SLOT, height: SLOT, opacity: 0.55 },
});
