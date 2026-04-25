/**
 * Progress Bar Component
 * 
 * Displays a visual progress bar for skill XP progress toward the next level.
 * Used in the Skills Hub to show visual representation of progression.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Optional: height of the bar in pixels */
  height?: number;
  /** Optional: background color */
  backgroundColor?: string;
  /** Optional: bar color */
  barColor?: string;
}

/**
 * ProgressBar Component
 * 
 * @param progress - Percentage complete (0-100)
 * @param height - Height of progress bar (default: 8)
 * @param backgroundColor - Background color (default: light gray)
 * @param barColor - Progress bar color (default: gold/OSRS theme)
 */
export function ProgressBar({
  progress,
  height = 8,
  backgroundColor = '#ddd',
  barColor = '#D4AF37', // Gold color from OSRS
}: ProgressBarProps) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View
      style={[
        styles.container,
        { height, backgroundColor },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            width: `${clampedProgress}%`,
            backgroundColor: barColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 4,
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
});
