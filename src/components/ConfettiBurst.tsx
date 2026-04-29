import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// Gold-heavy palette to match the OSRS theme
const COLORS = ['#D4AF37', '#D4AF37', '#D4AF37', '#F0E6D3', '#00C2D4', '#4CAF50', '#E8344E', '#FF7F2A'];
const COUNT = 30;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface PieceConfig {
  id: number;
  color: string;
  startX: number;
  driftX: number;
  rotationDeg: number;
  duration: number;
  delay: number;
  w: number;
  h: number;
}

function makePieces(): PieceConfig[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    id: i,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    startX: rand(0, SW),
    driftX: rand(-70, 70),
    rotationDeg: rand(-600, 600),
    duration: rand(1400, 2600),
    delay: rand(0, 600),
    w: rand(6, 11),
    h: rand(9, 15),
  }));
}

function ConfettiPiece({ cfg, active }: { cfg: PieceConfig; active: boolean }) {
  const translateY = useRef(new Animated.Value(-30)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    translateY.setValue(-30);
    translateX.setValue(0);
    rotation.setValue(0);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SH + 40,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: cfg.driftX,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 1,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
      // Appear at the start of the piece's delay, fade out near the end
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(opacity, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.delay(Math.max(0, cfg.duration - 380)),
        Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();
  }, [active]);

  const rot = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${cfg.rotationDeg}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cfg.startX,
        top: 0,
        width: cfg.w,
        height: cfg.h,
        backgroundColor: cfg.color,
        borderRadius: 1,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate: rot }],
      }}
    />
  );
}

interface Props {
  active: boolean;
}

export function ConfettiBurst({ active }: Props) {
  const [pieces, setPieces] = useState<PieceConfig[]>([]);

  useEffect(() => {
    if (active) {
      setPieces(makePieces());
    }
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map(cfg => (
        <ConfettiPiece key={cfg.id} cfg={cfg} active={active} />
      ))}
    </View>
  );
}
