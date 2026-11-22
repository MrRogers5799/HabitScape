/**
 * The road to the Bog Warden as a parchment map (PROD-038): the steps are stops on a dotted
 * path drawn by the app over the painted parchment. Done stops are ticked, the current one
 * glows gold, the last is the Warden. The parchment is art; the path and stops are not, so
 * the road can change length without new art.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CREATURE_ICONS, kitColors } from '../../game-ui';

const PARCHMENT = require('../../../assets/game-ui/planner/road_parchment.png');
/** Little dots drawn between two stops. */
const DASHES = 5;

/** Where stop `i` of `n` sits, as fractions of the map: left to right on a gentle wave. */
function stopAt(i: number, n: number) {
  const t = n > 1 ? i / (n - 1) : 0;
  return { x: 0.1 + t * 0.8, y: 0.5 + 0.14 * Math.sin(t * Math.PI * 2.2) };
}

export function RoadMap({ index, total, done }: { index: number; total: number; done: boolean }) {
  const stops = Array.from({ length: total }, (_, i) => stopAt(i, total));
  const pos = (p: { x: number; y: number }) => ({ left: `${p.x * 100}%` as const, top: `${p.y * 100}%` as const });
  return (
    <View style={styles.map} accessible accessibilityLabel={`Step ${index + 1} of ${total}${done ? ', done' : ''}`}>
      <Image source={PARCHMENT} style={styles.sheet} resizeMode="contain" accessibilityIgnoresInvertColors />
      {stops.slice(1).map((b, k) => {
        const a = stops[k];
        return Array.from({ length: DASHES }, (_, d) => {
          const f = (d + 1) / (DASHES + 1);
          return <View key={`${k}-${d}`} style={[styles.dash, pos({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })]} />;
        });
      })}
      {stops.map((p, i) => {
        const past = i < index || (i === index && done);
        const current = i === index && !done;
        const last = i === total - 1;
        return (
          <View key={i} style={[styles.stop, current && styles.current, past && styles.past, pos(p)]}>
            {last && !past ? <Image source={CREATURE_ICONS.bog_warden} style={styles.boss} resizeMode="contain" />
              : past ? <Text style={styles.tick}>✓</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const STOP = 22;
const styles = StyleSheet.create({
  // The whole torn sheet shows (its edges are transparent), so its own 3:2 shape.
  map: { aspectRatio: 3 / 2, width: '100%' },
  // Sized explicitly: absoluteFill alone let the image draw at its own size, past the card.
  sheet: { position: 'absolute', width: '100%', height: '100%' },
  dash: { position: 'absolute', width: 4, height: 4, marginLeft: -2, marginTop: -2, borderRadius: 2, backgroundColor: '#6b4a2a' },
  stop: {
    position: 'absolute', width: STOP, height: STOP, marginLeft: -STOP / 2, marginTop: -STOP / 2, borderRadius: STOP / 2,
    borderWidth: 2, borderColor: '#6b4a2a', backgroundColor: 'rgba(255,240,210,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  past: { backgroundColor: kitColors.green, borderColor: '#2c4a1c' },
  current: {
    width: STOP + 10, height: STOP + 10, marginLeft: -(STOP + 10) / 2, marginTop: -(STOP + 10) / 2, borderRadius: (STOP + 10) / 2,
    backgroundColor: kitColors.gold, borderColor: '#fff3c4', borderWidth: 3,
    shadowColor: kitColors.gold, shadowOpacity: 0.9, shadowRadius: 8, elevation: 6,
  },
  tick: { color: '#fff', fontSize: 13, fontWeight: 'bold', lineHeight: 15 },
  boss: { width: STOP + 8, height: STOP + 8 },
});
