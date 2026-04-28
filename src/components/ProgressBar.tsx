import React from 'react';
import { View, StyleSheet } from 'react-native';
import { bevel } from '../constants/colors';

interface ProgressBarProps {
  progress: number;
  height?: number;
  backgroundColor?: string;
  barColor?: string;
}

export function ProgressBar({
  progress,
  height = 8,
  backgroundColor = '#1a1208',
  barColor = '#D4AF37',
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={[styles.container, { height: height + 4, backgroundColor }]}>
      <View
        style={[
          styles.bar,
          { width: `${clampedProgress}%`, height, backgroundColor: barColor, boxShadow: `0 0 4px ${barColor}` } as any,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 1,
    ...bevel.inset,
  },
  bar: {
    borderRadius: 1,
  },
});
