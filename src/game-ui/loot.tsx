/**
 * Item icons and loot grids (PROD-025: show the icon, put the number on it).
 */
import React, { createContext, useContext } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NineSlice } from './NineSlice';
import { FRAMES } from './frames';
import { CREATURE_ICONS, GEAR_ICONS, ITEM_ICONS } from './icons';
import { kitColors, kitFonts, space } from './tokens';

/** An item's (or creature's) icon, or (until its art exists) its initials on a dark tile. */
export function ItemIcon({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  // Art files use underscores; some game ids use hyphens (creature 'bog-warden').
  const key = id.replace(/-/g, '_');
  const src = ITEM_ICONS[key] ?? GEAR_ICONS[key] ?? CREATURE_ICONS[key];
  if (src) return <Image source={src} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[styles.fallback, { width: size, height: size }]}>
      <Text style={[styles.fallbackText, { fontSize: size * 0.42 }]}>{initials}</Text>
    </View>
  );
}

/**
 * Tapping an item slot opens its info sheet (owner notes 2026-11-22: tap an icon to learn what
 * it is, and use bank items from there). The game screens provide `open`; elsewhere a slot is
 * just a picture.
 */
export const ItemInfoContext = createContext<{ open?: (id: string) => void }>({});

/** One slot: the icon with its count in the corner. Tappable for its info sheet where one is provided. */
export function ItemSlot({ id, name, count, size = 64 }: { id: string; name: string; count?: number; size?: number }) {
  const { open } = useContext(ItemInfoContext);
  const label = count !== undefined ? `${count.toLocaleString()} ${name}` : name;
  const body = (
    <View accessible={!open} accessibilityLabel={label} style={{ width: size, height: size }}>
      <NineSlice frame={FRAMES.slot} style={[StyleSheet.absoluteFill, styles.center]}>
        <ItemIcon id={id} name={name} size={size * 0.74} />
      </NineSlice>
      {count !== undefined && <Text style={styles.count}>{formatCount(count)}</Text>}
    </View>
  );
  if (!open) return body;
  return (
    <Pressable onPress={() => open(id)} accessibilityRole="button" accessibilityLabel={`${label}. What is this?`} hitSlop={2}
      style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

/** A wrapping grid of item slots. */
export function LootGrid({ items, nameOf, size = 64 }: { items: [string, number][]; nameOf: (id: string) => string; size?: number }) {
  return (
    <View style={styles.grid}>
      {items.map(([id, n]) => <ItemSlot key={id} id={id} name={nameOf(id)} count={n} size={size} />)}
    </View>
  );
}

/** Short counts so they fit a slot corner: 1,234 → 1.2k. */
export function formatCount(n: number): string {
  if (n >= 100000) return `${Math.round(n / 1000)}k`;
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString();
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  count: {
    position: 'absolute', top: 3, left: 7, fontFamily: kitFonts.text, fontSize: 20, lineHeight: 20, color: '#ffe066',
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1,
  },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3a2c16', borderRadius: 4 },
  fallbackText: { fontFamily: kitFonts.bold, color: kitColors.textMuted },
});
