/**
 * Skill icons for the new version (PROD-025: an icon and a number instead of a word).
 * Until a skill's illustrated icon exists, the 1.0 pixel icon stands in.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SKILL_ICONS as CLASSIC_SKILL_ICONS } from '../constants/osrsSkills';
import { NineSlice } from './NineSlice';
import { FRAMES } from './frames';
import { SKILL_ICONS } from './icons';
import { kitColors, kitFonts, space } from './tokens';

export function SkillIcon({ skill, size = 24 }: { skill: string; size?: number }) {
  const src = SKILL_ICONS[skill.toLowerCase()] ?? CLASSIC_SKILL_ICONS[skill];
  if (!src) return null;
  return <Image source={src} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
}

/** A skill in a slot with its level in the corner, like an item stack. */
export function SkillSlot({ skill, level, size = 64, selected }: { skill: string; level?: number; size?: number; selected?: boolean }) {
  return (
    <View accessible accessibilityLabel={level !== undefined ? `${skill} level ${level}` : skill} style={{ width: size, height: size }}>
      <NineSlice frame={FRAMES.slot} style={[StyleSheet.absoluteFill, styles.center, selected && styles.selected]}>
        {/* With a level shown, the icon sits up and left so the number in the corner stays clear. */}
        <View style={level !== undefined && styles.raised}><SkillIcon skill={skill} size={size * (level !== undefined ? 0.56 : 0.66)} /></View>
      </NineSlice>
      {level !== undefined && <Text style={styles.level}>{level}</Text>}
    </View>
  );
}

/** "+1,234 XP" with the skill's icon in front. */
export function XpChip({ skill, amount }: { skill: string; amount: number }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={`${Math.round(amount).toLocaleString()} ${skill} XP`}>
      <SkillIcon skill={skill} size={22} />
      <Text style={styles.chipText}>+{Math.round(amount).toLocaleString()}</Text>
    </View>
  );
}

/** A small "needs" tag: the skill's icon and the level required. */
export function NeedsTag({ skill, level, met }: { skill: string; level: number; met: boolean }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={`Needs ${skill} level ${level}`}>
      <SkillIcon skill={skill} size={20} />
      <Text style={[styles.chipText, { color: met ? kitColors.green : kitColors.red }]}>{level}</Text>
    </View>
  );
}

/** A small dark tag for a short fact ("120/h", "45% win"), with an optional icon in front. */
export function Tag({ label, icon, tone = 'text', accessibilityLabel }: {
  label: string; icon?: React.ReactNode; tone?: 'text' | 'green' | 'gold' | 'red'; accessibilityLabel?: string;
}) {
  const color = tone === 'green' ? kitColors.green : tone === 'gold' ? kitColors.gold : tone === 'red' ? kitColors.red : kitColors.text;
  return (
    <View style={styles.chip} accessible accessibilityLabel={accessibilityLabel ?? label}>
      {icon}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  selected: { borderWidth: 2, borderColor: kitColors.gold },
  raised: { transform: [{ translateX: -5 }, { translateY: -5 }] },
  level: {
    position: 'absolute', bottom: 2, right: 7, fontFamily: kitFonts.text, fontSize: 22, lineHeight: 22, color: '#ffe066',
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: 2,
    backgroundColor: 'rgba(20,14,7,0.55)', borderWidth: 2, borderColor: kitColors.divider,
  },
  chipText: { fontFamily: kitFonts.text, fontSize: 20, lineHeight: 22, color: kitColors.green },
});
