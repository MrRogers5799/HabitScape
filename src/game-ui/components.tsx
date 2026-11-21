/**
 * Shared building blocks for new-version screens (vault PROD-024). Every screen is made
 * of these so spacing, type and frames stay consistent.
 */
import React from 'react';
import { Image, ImageSourcePropType, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NineSlice } from './NineSlice';
import { FRAMES } from './frames';
import { kitColors, kitFonts, space, type } from './tokens';

/** A full screen: dark background, a title plate at the top, scrolling content with the standard gutter. */
export function KitScreen({ title, right, onBack, children }: {
  title?: string; right?: React.ReactNode; onBack?: () => void; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {title !== undefined && (
        <View style={styles.titleBar}>
          {onBack && (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
              <NineSlice frame={FRAMES.slot} style={styles.back}>
                <Text style={[type.title, styles.center]}>‹</Text>
              </NineSlice>
            </Pressable>
          )}
          <TitlePlate title={title} />
          {right}
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView>
    </View>
  );
}

/** A heading on the wooden plaque, for screen titles. */
export function TitlePlate({ title }: { title: string }) {
  return (
    <NineSlice frame={FRAMES.plate} style={styles.plate} padding={space.xxs}>
      <Text style={[type.title, styles.center]} numberOfLines={1} accessibilityRole="header">{title}</Text>
    </NineSlice>
  );
}

/** The main container: a framed wooden panel with an optional header (icon, title, right-hand chip). */
export function Panel({ title, icon, right, children, style }: {
  title?: string; icon?: ImageSourcePropType; right?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <NineSlice frame={FRAMES.panel} padding={space.sm} style={style}>
      {title !== undefined && <PanelHeader title={title} icon={icon} right={right} />}
      <View style={styles.panelBody}>{children}</View>
    </NineSlice>
  );
}

export function PanelHeader({ title, icon, right }: { title: string; icon?: ImageSourcePropType; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {icon && <Image source={icon} style={styles.headerIcon} />}
        <Text style={[type.heading, styles.flex]} accessibilityRole="header">{title}</Text>
        {right}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

/**
 * A list row in a sunken slot: optional left element (checkbox, icon), title, then a subtitle and/or a
 * `detail` line of chips, optional right element. `dim` greys out a row you can't use yet.
 */
export function Row({ left, title, subtitle, detail, right, onPress, accessibilityLabel, dim }: {
  left?: React.ReactNode; title: string; subtitle?: string; detail?: React.ReactNode; right?: React.ReactNode;
  onPress?: () => void; accessibilityLabel?: string; dim?: boolean;
}) {
  const content = (
    <NineSlice frame={FRAMES.slot} padding={space.xs} style={[styles.rowInner, dim && styles.dim]}>
      {left && <View style={styles.rowLeft}>{left}</View>}
      <View style={[styles.flex, styles.rowText]}>
        <Text style={type.bodyBold} numberOfLines={2}>{title}</Text>
        {subtitle !== undefined && <Text style={type.caption} numberOfLines={2}>{subtitle}</Text>}
        {detail !== undefined && <View style={styles.detail}>{detail}</View>}
      </View>
      {right}
    </NineSlice>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

/** A big number with a label, e.g. "Adventure time · 7.5h / 12h". */
export function StatReadout({ label, value, max, tone = 'green', icon }: {
  label: string; value: string; max?: string; tone?: 'green' | 'gold' | 'red'; icon?: React.ReactNode;
}) {
  const color = tone === 'gold' ? kitColors.gold : tone === 'red' ? kitColors.red : kitColors.green;
  return (
    <View style={styles.readout} accessible accessibilityLabel={`${label}: ${value}${max ? ` of ${max}` : ''}`}>
      {icon}
      <Text style={[type.bodyBold, styles.flex]}>{label}</Text>
      <Text style={[type.readout, { color }]}>
        {value}
        {max !== undefined && <Text style={[type.number, { color: kitColors.text }]}>{` / ${max}`}</Text>}
      </Text>
    </View>
  );
}

export function ProgressBar({ fraction, color = kitColors.green }: { fraction: number; color?: string }) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.barTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}>
      <View style={[styles.barFill, { width: `${f * 100}%`, backgroundColor: color }]}>
        <View style={styles.barShine} />
      </View>
    </View>
  );
}

/**
 * The illustrated scene at the top of a screen, framed, with a label plate and an optional progress strip.
 * `figure` (the adventurer's pose) stands on the right, over the scene: scenes have no characters baked in.
 */
export function SceneBanner({ source, label, sublabel, progress, progressLabel, figure }: {
  source: ImageSourcePropType; label: string; sublabel?: string; progress?: number; progressLabel?: string; figure?: ImageSourcePropType;
}) {
  return (
    <View style={styles.scene}>
      <View style={[StyleSheet.absoluteFill, styles.sceneClip]}>
        <Image source={source} style={styles.sceneImage} resizeMode="cover" />
        {figure && (
          <View style={[styles.sceneFigureBox, progress !== undefined && styles.sceneFigureRaised]} pointerEvents="none">
            <Image source={figure} style={styles.sceneFigure} resizeMode="contain" accessibilityIgnoresInvertColors />
          </View>
        )}
      </View>
      <NineSlice frame={FRAMES.sceneFrame} hollow style={StyleSheet.absoluteFill} />
      <View style={styles.sceneContent}>
        <View style={styles.sceneLabel}>
          <Text style={type.bodyBold} numberOfLines={1}>{label}</Text>
          {sublabel !== undefined && <Text style={type.caption} numberOfLines={1}>{sublabel}</Text>}
        </View>
        {progress !== undefined && (
          <View style={styles.sceneStrip}>
            <View style={styles.flex}><ProgressBar fraction={progress} /></View>
            {progressLabel !== undefined && <Text style={[type.number, { color: kitColors.text }]}>{progressLabel}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

/** A framed button. `compact` sizes it to its label (for row actions and steppers) instead of filling the row. */
export function KitButton({ label, onPress, disabled, kind = 'primary', compact, accessibilityLabel }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary'; compact?: boolean; accessibilityLabel?: string;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={compact ? 6 : undefined}
      style={({ pressed }) => [!compact && styles.flex, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <NineSlice frame={primary ? FRAMES.button : FRAMES.slot} padding={compact ? space.sm : space.xxs} style={compact ? styles.buttonCompact : styles.button}>
        <Text style={[type.button, !primary && { color: kitColors.text }, styles.center]} numberOfLines={1}>{label}</Text>
      </NineSlice>
    </Pressable>
  );
}

/** A small rounded tag, e.g. "Daily". */
export function Chip({ label, tone = 'green' }: { label: string; tone?: 'green' | 'gold' }) {
  const color = tone === 'gold' ? kitColors.gold : kitColors.green;
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[type.caption, { color }]}>{label}</Text>
    </View>
  );
}

export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[muted ? type.caption : type.body, style]}>{children}</Text>;
}

export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}


/** A text field in a sunken slot. `right` holds an inline action (Show/Hide); `error` shows under it in red. */
export function KitField({ error, right, style, ...input }: TextInputProps & { error?: string; right?: React.ReactNode }) {
  return (
    <View style={{ gap: space.xxs }}>
      <NineSlice frame={FRAMES.slot} padding={space.xxs} style={[styles.field, style as StyleProp<ViewStyle>]}>
        <TextInput
          placeholderTextColor={kitColors.textFaint}
          autoCorrect={false}
          accessibilityLabel={input.placeholder}
          {...input}
          style={styles.fieldInput}
        />
        {right}
      </NineSlice>
      {!!error && <Text style={[type.caption, { color: kitColors.red }]}>{error}</Text>}
    </View>
  );
}

/** A centred kit panel over a dimmed screen. Tapping outside or Back closes it. */
export function KitModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBack}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" accessibilityHint="Closes this panel" />
        <Panel title={title} style={styles.modalPanel}>{children}</Panel>
      </View>
    </Modal>
  );
}

/** Two or three choices side by side; the chosen one is the main button style. */
export function Choice<T extends string | number>({ options, value, onChange, disabled }: {
  options: { label: string; value: T }[]; value: T; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <View style={styles.buttonRow} accessibilityRole="radiogroup">
      {options.map((o) => (
        <KitButton key={String(o.value)} label={o.label} kind={o.value === value ? 'primary' : 'secondary'} disabled={disabled} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kitColors.background },
  titleBar: { paddingHorizontal: space.gutter, paddingTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  plate: { flex: 1, minHeight: 52, justifyContent: 'center' },
  scroll: { padding: space.gutter, gap: space.gap, paddingBottom: space.xl * 2 },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  panelBody: { gap: space.sm },
  header: { gap: space.sm, marginBottom: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerIcon: { width: 28, height: 28 },
  divider: { height: 2, backgroundColor: kitColors.divider, opacity: 0.8 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  rowLeft: { minWidth: 36, alignItems: 'center' },
  rowText: { gap: 2 },
  detail: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  dim: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  readout: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  barTrack: { height: 14, backgroundColor: kitColors.barTrack, borderWidth: 2, borderColor: '#3b2a12', overflow: 'hidden' },
  barFill: { height: '100%' },
  barShine: { height: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  scene: { aspectRatio: 3 / 2, justifyContent: 'space-between' },
  sceneClip: { overflow: 'hidden', margin: 6 },
  sceneImage: { width: '100%', height: '100%' },
  // Right-aligned box over the lower scene; the figure keeps its square shape inside it.
  sceneFigureBox: { ...StyleSheet.absoluteFillObject, top: '34%', bottom: '3%', right: '3%', alignItems: 'flex-end', justifyContent: 'flex-end' },
  sceneFigureRaised: { top: '30%', bottom: '27%' },
  sceneFigure: { height: '100%', aspectRatio: 1 },
  sceneContent: { flex: 1, justifyContent: 'space-between', padding: space.lg + space.xs },
  sceneLabel: { alignSelf: 'flex-start', maxWidth: '85%', backgroundColor: 'rgba(20,14,7,0.82)', borderWidth: 2, borderColor: kitColors.goldDeep, paddingHorizontal: space.md, paddingVertical: space.xs },
  sceneStrip: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: 'rgba(20,14,7,0.82)', borderWidth: 2, borderColor: kitColors.goldDeep, paddingHorizontal: space.md, paddingVertical: space.sm },
  button: { minHeight: 52, justifyContent: 'center' },
  buttonCompact: { minHeight: 44, minWidth: 64, justifyContent: 'center' },
  back: { width: 48, height: 52, justifyContent: 'center' },
  buttonRow: { flexDirection: 'row', gap: space.sm },
  chip: { borderWidth: 2, paddingHorizontal: space.sm, paddingVertical: 1 },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 },
  fieldInput: { flex: 1, fontFamily: kitFonts.text, fontSize: 22, color: kitColors.text, paddingVertical: 0 },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.gutter },
  modalPanel: { maxWidth: 460, alignSelf: 'center', width: '100%' },
});
