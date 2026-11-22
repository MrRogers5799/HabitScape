/**
 * The Planner's banner (PROD-038, concept C): a painted scene of the adventurer at work,
 * a plate with what they're doing and how long is left, and signposts at the right edge for
 * the next blocks in the queue (icon and length), so the queue reads at a glance.
 */
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { FRAMES, ItemIcon, kitColors, NineSlice, ProgressBar, space, type } from '../../game-ui';

export type Signpost = { key: string; icon?: string; name: string; label: string };

export function PlannerBanner({ source, figure, label, sublabel, progress, progressLabel, next }: {
  source: ImageSourcePropType;
  /** Only when the banner isn't painted yet: the region's scene with this pose on top. */
  figure?: ImageSourcePropType;
  label: string; sublabel?: string; progress?: number; progressLabel?: string; next: Signpost[];
}) {
  return (
    <View style={styles.banner}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <Image source={source} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
        {figure && <Image source={figure} style={styles.figure} resizeMode="contain" accessibilityIgnoresInvertColors />}
      </View>
      <NineSlice frame={FRAMES.sceneFrame} hollow style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <View style={styles.posts} accessible accessibilityLabel={next.length ? `Up next: ${next.map((n) => `${n.name}, ${n.label}`).join('; ')}` : undefined}>
          {next.map((n) => (
            <NineSlice key={n.key} frame={FRAMES.plate} padding={space.xxs} style={styles.post}>
              {n.icon && <ItemIcon id={n.icon} name={n.name} size={26} />}
              <Text style={[type.number, styles.postText]} numberOfLines={1}>{n.label}</Text>
            </NineSlice>
          ))}
        </View>
        <View style={styles.plate}>
          <Text style={[type.bodyBold, styles.center]} numberOfLines={1}>{label}</Text>
          {sublabel !== undefined && <Text style={[type.caption, styles.center]} numberOfLines={1}>{sublabel}</Text>}
          {progress !== undefined && (
            <View style={styles.strip}>
              <View style={styles.flex}><ProgressBar fraction={progress} /></View>
              {progressLabel !== undefined && <Text style={[type.number, { color: kitColors.text }]}>{progressLabel}</Text>}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { aspectRatio: 3 / 2, width: '100%' },
  clip: { overflow: 'hidden', margin: 6 },
  image: { width: '100%', height: '100%' },
  figure: { position: 'absolute', left: '22%', bottom: '18%', height: '62%', aspectRatio: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: space.md },
  posts: { alignSelf: 'flex-end', gap: space.xs, alignItems: 'flex-end' },
  post: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, minHeight: 36 },
  postText: { color: kitColors.text },
  // Compact, so the painting shows: the activity, then the bar with what's left.
  plate: {
    alignSelf: 'center', width: '88%', backgroundColor: 'rgba(20,14,7,0.78)', borderWidth: 2, borderColor: kitColors.goldDeep,
    paddingHorizontal: space.sm, paddingVertical: 2, gap: 0,
  },
  center: { textAlign: 'center' },
  strip: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
