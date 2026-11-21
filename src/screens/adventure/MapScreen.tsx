/**
 * Map: the painted valley with a marker per region, then each region with icons for what's
 * there, its travel time and what opens it (new-version kit, PROD-024/025; art bible §11 step 3).
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { activitiesIn, itemName, QUESTS, REGIONS } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { FRAMES, ItemSlot, KitScreen, kitColors, NineSlice, Panel, space, TAB_ICONS, Tag, type } from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Map'>;

const SLOT = 52;
const MAP = require('../../../assets/game-ui/map/valley.png');

/** Where each region sits on the painted map, as fractions of its width and height (art/game/specs/world-map.json fixes the layout). */
const MARKERS: Record<string, { x: number; y: number }> = {
  stonecrest: { x: 0.55, y: 0.12 },
  greywood: { x: 0.2, y: 0.42 },
  millbrook: { x: 0.6, y: 0.36 },
  bog: { x: 0.72, y: 0.7 },
};

export function MapScreen({ navigation }: Props) {
  const { state } = useGame();
  if (!state) return null;
  return (
    // A tab root: no back button.
    <KitScreen title="The valley">
      <View style={styles.map}>
        <View style={[StyleSheet.absoluteFill, styles.mapClip]}>
          <Image source={MAP} style={styles.mapImage} resizeMode="cover" accessibilityIgnoresInvertColors />
          {Object.values(REGIONS).map((r) => {
            const at = MARKERS[r.id];
            if (!at) return null;
            const locked = !!r.questGate && !state.quests[r.questGate];
            return (
              <Pressable
                key={r.id}
                onPress={() => navigation.navigate('Region', { regionId: r.id })}
                accessibilityRole="button"
                accessibilityLabel={`${r.name} on the map${locked ? ', locked' : ''}`}
                hitSlop={8}
                style={[styles.marker, { left: `${at.x * 100}%`, top: `${at.y * 100}%` }]}
              >
                <View style={[styles.markerPlate, locked && styles.markerLocked]}>
                  <Text style={[type.caption, styles.markerText]} numberOfLines={1}>{r.name}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <NineSlice frame={FRAMES.sceneFrame} hollow style={StyleSheet.absoluteFill} />
      </View>
      {Object.values(REGIONS).map((r) => {
        const locked = !!r.questGate && !state.quests[r.questGate];
        const a = activitiesIn(r.id);
        // What you can bring back from here, once each.
        const outputs = [...new Set(a.methods.map((m) => m.output).filter((o): o is string => !!o))];
        const travel = r.travelFraction ? `${Math.round(r.travelFraction * 100)}% travel` : 'No travel';
        return (
          <Pressable
            key={r.id}
            onPress={() => navigation.navigate('Region', { regionId: r.id })}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}${locked ? ', locked' : ''}`}
            style={({ pressed }) => [locked && styles.locked, pressed && styles.pressed]}
          >
            <Panel title={r.name} right={<Tag label={travel} />}>
              {(outputs.length > 0 || a.fights.length > 0) && (
                <View style={styles.icons}>
                  {outputs.map((id) => <ItemSlot key={id} id={id} name={itemName(id)} size={SLOT} />)}
                  {a.fights.map((c) => <ItemSlot key={c.id} id={c.id} name={c.name} size={SLOT} />)}
                </View>
              )}
              <View style={styles.tags}>
                {a.recipes.length > 0 && <Tag label="Anvil" />}
                {a.quests.length > 0 && (
                  <Tag
                    label={String(a.quests.length)}
                    icon={<Image source={TAB_ICONS.activities} style={styles.tagIcon} />}
                    accessibilityLabel={`${a.quests.length} quests`}
                  />
                )}
                {locked && <Tag tone="red" label={`Locked: ${QUESTS[r.questGate!]?.name ?? 'a quest'}`} />}
              </View>
            </Panel>
          </Pressable>
        );
      })}
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tagIcon: { width: 20, height: 20 },
  map: { aspectRatio: 2 / 3 },
  mapClip: { overflow: 'hidden', margin: 6 },
  mapImage: { width: '100%', height: '100%' },
  // Centred on its point: shifted back by half of a generous fixed width.
  marker: { position: 'absolute', width: 220, marginLeft: -110, marginTop: -16, alignItems: 'center' },
  markerPlate: {
    backgroundColor: 'rgba(20,14,7,0.85)', borderWidth: 2, borderColor: kitColors.gold, paddingHorizontal: space.sm, paddingVertical: 2,
  },
  markerLocked: { borderColor: kitColors.textFaint, opacity: 0.85 },
  markerText: { color: kitColors.text },
  locked: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});
