/**
 * The new version's bottom tab bar (PROD-025): a wooden plank with kit icons and fonts.
 * The active tab sits in a sunken slot with a gold label. Tabs without a kit icon yet
 * fall back to the icon the screen already gives the navigator.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NineSlice } from './NineSlice';
import { FRAMES } from './frames';
import { TAB_ICONS } from './icons';
import { kitColors, kitFonts, space } from './tokens';

/** Route name → kit icon id. */
const ICON_FOR: Record<string, string> = {
  ActivitiesTab: 'activities', AdventureTab: 'adventure', SkillsTab: 'skills', ProfileTab: 'profile', WorkoutTab: 'workout', SettingsTab: 'settings',
};

export function KitTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.edge} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
          const kitIcon = TAB_ICONS[ICON_FOR[route.name] ?? ''];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const icon = kitIcon
            ? <Image source={kitIcon} style={[styles.icon, !focused && styles.iconIdle]} />
            : options.tabBarIcon?.({ focused, color: focused ? kitColors.gold : kitColors.textMuted, size: 26 });
          const content = (
            <>
              {icon}
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
            </>
          );
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.tab}
            >
              {focused
                ? <NineSlice frame={FRAMES.slot} style={styles.tabInner}>{content}</NineSlice>
                : <View style={styles.tabInner}>{content}</View>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#3a2412' },
  edge: { height: 4, backgroundColor: '#8b5a2b', borderBottomWidth: 2, borderBottomColor: '#1a0f06' },
  row: { flexDirection: 'row', paddingHorizontal: space.xs, paddingVertical: space.xs, gap: 2 },
  tab: { flex: 1 },
  tabInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, minHeight: 58 },
  icon: { width: 30, height: 30 },
  iconIdle: { opacity: 0.6 },
  label: { fontFamily: kitFonts.regular, fontSize: 11, lineHeight: 14, color: kitColors.textMuted, marginTop: 2 },
  labelActive: { color: kitColors.gold },
});
