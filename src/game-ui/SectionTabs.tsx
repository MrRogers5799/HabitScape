/**
 * Section tabs for long screens (PROD-029): a dark wooden rail with text tabs, the chosen
 * one "lit" like the bottom tab bar (gold label, gold bar on the rail's edge, warm glow).
 * Deliberately not buttons or slot frames, which mean "do something" and "item" elsewhere,
 * so the rail reads as navigation at a glance.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { kitColors, kitFonts, space } from './tokens';

export function SectionTabs<T extends string>({ options, value, onChange }: {
  options: { label: string; value: T }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.rail} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.tab, pressed && !on && styles.pressed]}
          >
            {on && (
              <>
                <LinearGradient colors={['rgba(255,170,60,0)', 'rgba(255,170,60,0.14)', 'rgba(255,196,92,0.4)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bar} />
              </>
            )}
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row', backgroundColor: '#24170b',
    borderTopWidth: 2, borderTopColor: kitColors.goldDeep, borderBottomWidth: 2, borderBottomColor: '#1a0f06',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: space.xs },
  bar: { position: 'absolute', bottom: 0, left: space.sm, right: space.sm, height: 4, backgroundColor: kitColors.gold, borderTopWidth: 1, borderTopColor: kitColors.goldDeep },
  label: { fontFamily: kitFonts.bold, fontSize: 17, lineHeight: 22, color: kitColors.textFaint },
  labelOn: { color: kitColors.gold },
  pressed: { opacity: 0.7 },
});
