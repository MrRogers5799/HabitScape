/**
 * The new version's bottom tab bar (PROD-025): a wooden plank with kit icons and fonts.
 * The active tab is "lit": a gold bar on the plank's edge, a warm lantern glow, a bigger
 * raised icon and a gold label. It deliberately doesn't use the slot frame, which means
 * "item" everywhere else. Tabs without a kit icon fall back to the navigator's icon.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ICONS } from './icons';
import { kitColors, kitFonts, space } from './tokens';

/** Route name → kit icon id. */
const ICON_FOR: Record<string, string> = {
  HabitsTab: 'activities', PlannerTab: 'planner', MapTab: 'adventure', HeroTab: 'profile',
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
            ? <Image source={kitIcon} style={[styles.icon, focused ? styles.iconActive : styles.iconIdle]} />
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
              <View style={styles.tabInner}>
                {focused && (
                  <>
                    <LinearGradient colors={['rgba(255,196,92,0.42)', 'rgba(255,170,60,0.12)', 'rgba(255,170,60,0)']} style={StyleSheet.absoluteFill} />
                    <View style={styles.activeBar} />
                  </>
                )}
                {content}
              </View>
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
  row: { flexDirection: 'row', paddingHorizontal: space.xs, paddingBottom: space.xs, gap: 2 },
  tab: { flex: 1 },
  tabInner: { alignItems: 'center', justifyContent: 'center', paddingTop: space.sm, paddingBottom: 2, minHeight: 62 },
  activeBar: { position: 'absolute', top: 0, left: space.sm, right: space.sm, height: 4, backgroundColor: kitColors.gold, borderBottomWidth: 1, borderBottomColor: kitColors.goldDeep },
  icon: { width: 30, height: 30 },
  iconActive: { width: 36, height: 36, marginTop: -4 },
  iconIdle: { opacity: 0.55 },
  label: { fontFamily: kitFonts.regular, fontSize: 11, lineHeight: 14, color: kitColors.textMuted, marginTop: 2 },
  labelActive: { color: kitColors.gold },
});
