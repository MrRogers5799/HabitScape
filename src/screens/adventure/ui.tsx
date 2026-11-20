/**
 * Small shared building blocks for the Adventure (beta) screens, in the app's
 * bevelled panel style (PROD-007). Placeholder art only (PROD-018).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { bevel, colors } from '../../constants/colors';
import { fonts } from '../../constants/typography';

export function Panel({ children, style, tone }: { children: React.ReactNode; style?: ViewStyle; tone?: 'gold' | 'green' }) {
  return (
    <View style={[styles.panel, tone === 'gold' && styles.panelGold, tone === 'green' && styles.panelGreen, style]}>
      {children}
    </View>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[styles.body, muted && styles.muted, style]}>{children}</Text>;
}

export function Button({ label, onPress, disabled, kind = 'primary', small }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary'; small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        kind === 'secondary' && styles.buttonSecondary,
        small && styles.buttonSmall,
        disabled && styles.buttonDisabled,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.buttonText, kind === 'secondary' && styles.buttonTextSecondary, small && styles.buttonTextSmall]}>{label}</Text>
    </Pressable>
  );
}

export function Bar({ fraction, color = colors.gold }: { fraction: number; color?: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** A placeholder item tile: the count in a framed square with the item's name underneath. */
export function ItemTile({ name, count }: { name: string; count?: number }) {
  return (
    <View style={styles.tileWrap} accessible accessibilityLabel={count !== undefined ? `${count} ${name}` : name}>
      <View style={styles.tile}>
        <Text style={styles.tileCount}>{count !== undefined ? count.toLocaleString() : ''}</Text>
      </View>
      <Text style={styles.tileName} numberOfLines={2}>{name}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, padding: 12, marginHorizontal: 12, marginTop: 10, gap: 8, ...bevel.raised },
  panelGold: { borderTopColor: colors.gold, borderLeftColor: colors.gold },
  panelGreen: { backgroundColor: colors.successSurface, ...bevel.green },
  heading: { fontFamily: fonts.heading, fontSize: 10, color: colors.gold, lineHeight: 16 },
  body: { fontFamily: fonts.display, fontSize: 19, color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  button: { backgroundColor: colors.gold, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', ...bevel.raised },
  buttonSecondary: { backgroundColor: colors.surfaceRaised },
  buttonSmall: { paddingVertical: 6, paddingHorizontal: 10 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.display, fontSize: 21, color: colors.background },
  buttonTextSecondary: { color: colors.textPrimary },
  buttonTextSmall: { fontSize: 18 },
  barTrack: { height: 12, backgroundColor: colors.surfaceSunken, ...bevel.inset },
  barFill: { height: '100%' },
  tileWrap: { width: 72, alignItems: 'center', gap: 2 },
  tile: { width: 56, height: 44, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', ...bevel.inset },
  tileCount: { fontFamily: fonts.display, fontSize: 20, color: '#ffff60' },
  tileName: { fontFamily: fonts.display, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, ...bevel.raised },
  headerTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.gold, flexShrink: 1 },
  back: { fontFamily: fonts.display, fontSize: 24, color: colors.textSecondary, paddingRight: 4 },
});
