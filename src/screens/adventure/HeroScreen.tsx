/**
 * Hero: the adventurer's skills, gear, bank and XP lamps (placeholder art).
 */
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { colors } from '../../constants/colors';
import { SKILL_ICONS } from '../../constants/osrsSkills';
import { GAME_SKILLS, GameSkill, ITEMS, itemName, levelOf } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { Body, Button, Heading, ItemTile, Panel, Row, styles } from './ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Hero'>;

export function HeroScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { state, applyLamp } = useGame();
  const [lampSkill, setLampSkill] = useState<GameSkill>('Mining');
  if (!state) return null;

  const owned = Object.entries(state.bank).filter(([, n]) => n > 0);
  const gear = owned.filter(([id]) => ITEMS[id]?.equip || ITEMS[id]?.tool);
  const total = GAME_SKILLS.reduce((sum, s) => sum + levelOf(state, s), 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back"><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.headerTitle}>Hero</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {state.lamps.length > 0 && (
          <Panel tone="gold">
            <Heading>XP LAMPS</Heading>
            <Body muted>{"Put a quest's XP into any skill."}</Body>
            <Row>
              {GAME_SKILLS.map((s) => (
                <Button key={s} small kind={s === lampSkill ? 'primary' : 'secondary'} label={s} onPress={() => setLampSkill(s)} />
              ))}
            </Row>
            {state.lamps.map((amount, i) => (
              <Button key={i} label={`Use ${amount.toLocaleString()} XP on ${lampSkill}`} onPress={() => applyLamp(i, lampSkill)} />
            ))}
          </Panel>
        )}

        <Panel>
          <Heading>SKILLS · TOTAL {total}</Heading>
          <Row>
            {GAME_SKILLS.map((s) => (
              <View key={s} style={{ width: '30%', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {SKILL_ICONS[s] && <Image source={SKILL_ICONS[s]} style={{ width: 24, height: 24 }} />}
                <Body>{levelOf(state, s)}</Body>
              </View>
            ))}
          </Row>
          <Body muted>The other 14 skills come in later updates.</Body>
        </Panel>

        <Panel>
          <Heading>GEAR AND TOOLS</Heading>
          {gear.length === 0 && <Body muted>None yet.</Body>}
          {gear.map(([id, n]) => {
            const eq = ITEMS[id].equip;
            const tool = ITEMS[id].tool;
            const stat = eq?.power ? `power ${eq.power} (${eq.attackType})` : eq?.defence ? `defence ${eq.defence}` : tool ? `tier ${tool.tier} tool` : '';
            const need = eq ? `${eq.wear.skill} ${eq.wear.level}` : tool ? `level ${tool.level}` : '';
            return (
              <Body key={id}>
                {itemName(id)}{n > 1 ? ` ×${n}` : ''} <Text style={{ color: colors.textSecondary }}>· {stat} · needs {need}</Text>
              </Body>
            );
          })}
          <Body muted>Your best gear is worn automatically on each trip.</Body>
        </Panel>

        <Panel>
          <Heading>BANK</Heading>
          {owned.length === 0 ? <Body muted>Empty.</Body> : (
            <Row>{owned.map(([id, n]) => <ItemTile key={id} name={itemName(id)} count={n} />)}</Row>
          )}
        </Panel>
      </ScrollView>
    </View>
  );
}
