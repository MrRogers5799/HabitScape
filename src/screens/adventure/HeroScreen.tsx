/**
 * Hero: the player's name, with the cog that opens Settings and the account (PROD-026), then the adventurer's skills, gear, bank and XP lamps, as icons with numbers
 * (new-version kit, PROD-024/025).
 */
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { GAME_SKILLS, GameSkill, ITEMS, itemName, levelOf, ToolType } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, ItemSlot, KitButton, KitScreen, LootGrid, NeedsTag, Panel, FRAMES, NineSlice, Row, SkillIcon, SkillSlot, space, kitColors, TAB_ICONS, Tag, type,
} from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Hero'>;

const SKILL_SLOT = 56;

/** The skill each tool type is used for, so its level requirement can show that skill's icon. */
const TOOL_SKILL: Record<ToolType, GameSkill> = { pickaxe: 'Mining', hatchet: 'Woodcutting', small_net: 'Fishing', fishing_rod: 'Fishing' };

export function HeroScreen({ navigation }: Props) {
  const { state, applyLamp } = useGame();
  const { user } = useAuth();
  const [lampSkill, setLampSkill] = useState<GameSkill>('Mining');
  if (!state) return null;

  const owned = (Object.entries(state.bank) as [string, number][]).filter(([, n]) => n > 0).sort(([, x], [, y]) => y - x);
  const gear = owned.filter(([id]) => ITEMS[id]?.equip || ITEMS[id]?.tool);
  const total = GAME_SKILLS.reduce((sum, s) => sum + levelOf(state, s), 0);
  const questsDone = Object.values(state.quests).filter(Boolean).length;

  return (
    <KitScreen
      title="Hero"
      right={(
        // Settings opens from here (PROD-026).
        <Pressable onPress={() => navigation.navigate('Settings')} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <NineSlice frame={FRAMES.slot} style={styles.cog}>
            <Image source={TAB_ICONS.settings} style={styles.cogIcon} accessibilityIgnoresInvertColors />
          </NineSlice>
        </Pressable>
      )}
    >
      <Panel title={user?.displayName || 'Adventurer'} icon={TAB_ICONS.profile}>
        <View style={styles.tags}>
          <Tag label={`Total ${total}`} tone="gold" accessibilityLabel={`Total level ${total}`} />
          <Tag label={`Quests ${questsDone}`} accessibilityLabel={`${questsDone} quests done`} />
        </View>
      </Panel>

      {state.lamps.length > 0 && (
        <Panel title="XP lamps" right={<Tag label={String(state.lamps.length)} tone="gold" accessibilityLabel={`${state.lamps.length} lamps`} />}>
          <Body muted>{"Pick a skill for the lamp's XP."}</Body>
          <View style={styles.grid}>
            {GAME_SKILLS.map((s) => (
              <Pressable key={s} onPress={() => setLampSkill(s)} accessibilityRole="button" accessibilityState={{ selected: s === lampSkill }} accessibilityLabel={s}>
                <SkillSlot skill={s} size={SKILL_SLOT} selected={s === lampSkill} />
              </Pressable>
            ))}
          </View>
          {/* The amount stays out of the button: Pixelify's small digits misread (5 looks like 8). */}
          {state.lamps.map((amount, i) => (
            <View key={i} style={styles.lampRow}>
              <View style={[styles.flex, styles.lampAmount]} accessible accessibilityLabel={`${amount.toLocaleString()} ${lampSkill} XP`}>
                <SkillIcon skill={lampSkill} size={36} />
                <Text style={[type.readout, { color: kitColors.gold }]}>+{amount.toLocaleString()}</Text>
              </View>
              <KitButton compact label="Use lamp" onPress={() => applyLamp(i, lampSkill)} />
            </View>
          ))}
        </Panel>
      )}

      <Panel title="Skills">
        <View style={styles.grid}>
          {GAME_SKILLS.map((s) => <SkillSlot key={s} skill={s} level={levelOf(state, s)} size={SKILL_SLOT} />)}
        </View>
      </Panel>

      <Panel title="Gear and tools">
        {gear.length === 0 && <Body muted>None yet.</Body>}
        {gear.map(([id, n]) => {
          const eq = ITEMS[id].equip;
          const tool = ITEMS[id].tool;
          return (
            <Row
              key={id}
              left={<ItemSlot id={id} name={itemName(id)} count={n > 1 ? n : undefined} size={52} />}
              title={itemName(id)}
              detail={(
                <>
                  {eq?.power ? <Tag label={`Power ${eq.power}`} tone="green" /> : null}
                  {eq?.attackType ? <Tag label={eq.attackType} /> : null}
                  {eq?.defence ? <Tag label={`Defence ${eq.defence}`} tone="green" /> : null}
                  {tool ? <Tag label={`Tier ${tool.tier}`} tone="green" /> : null}
                  {eq ? <NeedsTag skill={eq.wear.skill} level={eq.wear.level} met={levelOf(state, eq.wear.skill) >= eq.wear.level} /> : null}
                  {!eq && tool ? <NeedsTag skill={TOOL_SKILL[tool.type]} level={tool.level} met={levelOf(state, TOOL_SKILL[tool.type]) >= tool.level} /> : null}
                </>
              )}
            />
          );
        })}
        {gear.length > 0 && <Body muted>Your best gear is worn on each trip.</Body>}
      </Panel>

      <Panel title="Bank">
        {owned.length === 0 ? <Body muted>Empty.</Body> : <LootGrid items={owned} nameOf={itemName} size={60} />}
      </Panel>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lampRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  cog: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  cogIcon: { width: 30, height: 30 },
  pressed: { opacity: 0.8 },
  lampAmount: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
