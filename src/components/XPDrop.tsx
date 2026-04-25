import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors } from '../constants/colors';

interface XPDropProps {
  xp: number;
  skillId: string;
  onComplete: () => void;
}

export function XPDrop({ xp, skillId, onComplete }: XPDropProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -60,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start(onComplete);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.xpText}>+{xp} XP</Text>
      <Text style={styles.skillText}>{skillId}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    pointerEvents: 'none',
  },
  xpText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  skillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
