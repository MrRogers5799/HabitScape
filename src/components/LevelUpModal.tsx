import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { colors } from '../constants/colors';
import { ConfettiBurst } from './ConfettiBurst';

// To enable the level-up sound:
// 1. Drop an MP3 into assets/sounds/levelup.mp3
// 2. Replace `null` below with: require('../../assets/sounds/levelup.mp3')
const LEVELUP_SOUND_FILE: number | null = null;

interface LevelUpModalProps {
  visible: boolean;
  skillName: string;
  newLevel: number;
  onClose: () => void;
}

export function LevelUpModal({ visible, skillName, newLevel, onClose }: LevelUpModalProps) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0.5);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let sound: Audio.Sound | null = null;
    if (LEVELUP_SOUND_FILE !== null) {
      Audio.Sound.createAsync(LEVELUP_SOUND_FILE, { shouldPlay: true })
        .then(({ sound: s }) => { sound = s; })
        .catch(() => {});
    }

    return () => {
      sound?.unloadAsync();
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ConfettiBurst active={visible} />
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.congratsText}>LEVEL UP!</Text>
          <Text style={styles.skillName}>{skillName}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelNumber}>{newLevel}</Text>
          </View>
          <Text style={styles.subtitle}>
            Your {skillName} skill has reached level {newLevel}!
          </Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gold,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '80%',
  },
  congratsText: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.gold,
    letterSpacing: 3,
    marginBottom: 8,
  },
  skillName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  levelBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.background,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  button: {
    backgroundColor: colors.gold,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
});
