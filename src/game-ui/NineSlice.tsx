/**
 * Draws a frame texture at any size: the four corners stay as drawn, the edges stretch
 * along one axis and the centre stretches both ways. Plain images, no native module.
 */
import React from 'react';
import { Image, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { FrameDef } from './frames';

type Props = {
  frame: FrameDef;
  style?: StyleProp<ViewStyle>;
  /** Extra padding inside the frame's border, in dp. */
  padding?: number;
  children?: React.ReactNode;
  /** Hide the stretched centre (e.g. a frame laid over a picture). */
  hollow?: boolean;
};

export function NineSlice({ frame, style, padding = 0, children, hollow }: Props) {
  const { inset, pieces } = frame;
  return (
    <View
      style={[
        {
          paddingTop: inset.top + padding,
          paddingBottom: inset.bottom + padding,
          paddingLeft: inset.left + padding,
          paddingRight: inset.right + padding,
        },
        style,
      ]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.row, { height: inset.top }]}>
          <Image source={pieces.tl} style={{ width: inset.left, height: '100%' }} resizeMode="stretch" />
          <Image source={pieces.t} style={styles.fill} resizeMode="stretch" />
          <Image source={pieces.tr} style={{ width: inset.right, height: '100%' }} resizeMode="stretch" />
        </View>
        <View style={[styles.row, styles.fill]}>
          <Image source={pieces.l} style={{ width: inset.left, height: '100%' }} resizeMode="stretch" />
          {hollow ? <View style={styles.fill} /> : <Image source={pieces.c} style={styles.fill} resizeMode="stretch" />}
          <Image source={pieces.r} style={{ width: inset.right, height: '100%' }} resizeMode="stretch" />
        </View>
        <View style={[styles.row, { height: inset.bottom }]}>
          <Image source={pieces.bl} style={{ width: inset.left, height: '100%' }} resizeMode="stretch" />
          <Image source={pieces.b} style={styles.fill} resizeMode="stretch" />
          <Image source={pieces.br} style={{ width: inset.right, height: '100%' }} resizeMode="stretch" />
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  fill: { flex: 1, height: '100%' },
});
