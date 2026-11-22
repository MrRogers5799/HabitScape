/**
 * Map: the painted valley with a marker per region (new-version kit, PROD-024/025; art bible
 * §11 step 3). Tapping a marker opens the region, which is the one home for what's there,
 * its travel and what opens it (OQ-36: no second list of regions under the map).
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { queueRunning, REGIONS } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { FRAMES, KitScreen, kitColors, NineSlice, space, type } from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Map'>;

const MAP = require('../../../assets/game-ui/map/valley.png');

/** Where each region sits on the painted map, as fractions of its width and height (art/game/specs/world-map.json fixes the layout). */
const MARKERS: Record<string, { x: number; y: number }> = {
  stonecrest: { x: 0.55, y: 0.12 },
  greywood: { x: 0.2, y: 0.42 },
  millbrook: { x: 0.6, y: 0.36 },
  bog: { x: 0.72, y: 0.7 },
};

export function MapScreen({ navigation }: Props) {
  const { state, activeTrip } = useGame();
  if (!state) return null;
  // Where the adventurer is: the region of the block being worked, or home in Millbrook (UI review 2026-11-21).
  const out = queueRunning(activeTrip?.trip) ? activeTrip!.trip : null;
  const here = out?.legs.find((l) => !l.ended)?.regionId ?? 'millbrook';
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
            const isHere = r.id === here;
            return (
              <Pressable
                key={r.id}
                onPress={() => navigation.navigate('Region', { regionId: r.id })}
                accessibilityRole="button"
                accessibilityLabel={`${r.name} on the map${locked ? ', locked' : ''}${isHere ? ', you are here' : ''}`}
                hitSlop={8}
                style={[styles.marker, { left: `${at.x * 100}%`, top: `${at.y * 100}%` }]}
              >
                <View style={[styles.markerPlate, locked && styles.markerLocked, isHere && styles.markerHere]}>
                  <Text style={[type.caption, styles.markerText, isHere && styles.markerTextHere]} numberOfLines={1}>{r.name}</Text>
                  {isHere && <Text style={[type.caption, styles.hereText]}>You are here</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
        <NineSlice frame={FRAMES.sceneFrame} hollow style={StyleSheet.absoluteFill} />
      </View>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
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
  markerHere: { backgroundColor: 'rgba(60,40,10,0.95)', borderWidth: 3 },
  markerTextHere: { color: kitColors.gold },
  hereText: { color: kitColors.gold, textAlign: 'center' },
});
