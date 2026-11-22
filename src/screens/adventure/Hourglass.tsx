/**
 * Adventure time as an hourglass (PROD-038): the top bulb's sand is what's banked (the Planner
 * fills it at 12 hours), the bottom bulb's is what you've earned this week out of the weekly cap.
 * The sand shapes are cut from the art's own bulbs (art/game/ui/hourglass_sand_*.png), so
 * they fill the glass exactly; the app shows the lower part of each to set its level.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const GLASS = require('../../../assets/game-ui/planner/hourglass.png');
const SAND_TOP = require('../../../assets/game-ui/planner/hourglass_sand_top.png');
const SAND_BOTTOM = require('../../../assets/game-ui/planner/hourglass_sand_bottom.png');
/** Each bulb's top and bottom row in the 1024 px art. */
const TOP_BULB = [288, 505] as const;
const BOTTOM_BULB = [515, 741] as const;
const ART = 1024;

/** The lower `fraction` of a bulb's sand, drawn over the glass at `size`. */
function Sand({ source, bulb, fraction, size }: { source: number; bulb: readonly [number, number]; fraction: number; size: number }) {
  const f = Math.max(0, Math.min(1, fraction));
  if (f <= 0) return null;
  const [y0, y1] = bulb;
  const top = ((y0 + (1 - f) * (y1 - y0)) / ART) * size;
  const height = ((f * (y1 - y0)) / ART) * size + 1;
  return (
    <View style={[styles.clip, { top, height, width: size }]}>
      <Image source={source} style={{ position: 'absolute', top: -top, left: 0, width: size, height: size }} />
    </View>
  );
}

export function Hourglass({ banked, earned, size = 112 }: { banked: number; earned: number; size?: number }) {
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Sand source={SAND_TOP} bulb={TOP_BULB} fraction={banked} size={size} />
      <Sand source={SAND_BOTTOM} bulb={BOTTOM_BULB} fraction={earned} size={size} />
      <Image source={GLASS} style={{ position: 'absolute', width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', left: 0, overflow: 'hidden' },
});
