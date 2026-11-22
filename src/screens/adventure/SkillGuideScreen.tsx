/**
 * A skill's guide in the new version (PROD-024/025), opened by tapping a skill on Hero:
 * level and XP to the next, then everything the skill unlocks in level order (methods and
 * recipes, gear to wear, tools, quests), built from the game content so it stays current.
 * It's also where XP lamps are used on this skill (one home, PROD-029). Replaces the live
 * app's skill guide, which listed habit activities.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { XP_TABLE } from '../../constants/xpTable';
import { GameSkill, itemName, lampFits, lampXP, levelOf, SKILL_INFO, skillUnlocks } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, FRAMES, ItemSlot, KitButton, KitScreen, kitColors, NineSlice, Panel, ProgressBar, Row, SkillIcon, SkillSlot, space, StatReadout,
  TAB_ICONS, Tag, type,
} from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Skill'>;

const SLOT = 52;

/** A skill's unlocks (built in the game, src/game/unlocks.ts), with their pictures. */
function unlocksFor(skill: GameSkill) {
  return skillUnlocks(skill).map((u) => ({
    ...u,
    icon: u.kind === 'quest'
      ? <NineSlice frame={FRAMES.slot} style={styles.questSlot}><Image source={TAB_ICONS.activities} style={styles.questIcon} /></NineSlice>
      : u.icon ? <ItemSlot id={u.icon} name={itemName(u.icon)} size={SLOT} /> : <SkillSlot skill={skill} size={SLOT} />,
  }));
}

export function SkillGuideScreen({ navigation, route }: Props) {
  const { state, applyLamp } = useGame();
  const skill = route.params.skill;
  if (!state) return null;
  const level = levelOf(state, skill);
  const xp = Math.floor(state.xp[skill] ?? 0);
  const from = XP_TABLE[level] ?? 0;
  const to = XP_TABLE[level + 1];
  const unlocks = unlocksFor(skill);

  return (
    <KitScreen title={skill} onBack={() => navigation.goBack()}>
      <Panel>
        <Body>{SKILL_INFO[skill]}</Body>
        <StatReadout label="Level" value={String(level)} max="99" tone="gold" icon={<SkillIcon skill={skill} size={40} />} />
        {to !== undefined && <ProgressBar fraction={(xp - from) / (to - from)} />}
        <Body muted>{xp.toLocaleString()} XP{to !== undefined ? ` · ${(to - xp).toLocaleString()} to level ${level + 1}` : ''}</Body>
      </Panel>

      {/* Only the lamps that fit this skill (combat lamps go into combat skills only, PROG-053). */}
      {state.lamps.some((l) => lampFits(l, skill)) && (
        <Panel title="XP lamps">
          {/* The amount stays out of the button: Pixelify's small digits misread. */}
          {state.lamps.map((lamp, i) => !lampFits(lamp, skill) ? null : (
            <View key={i} style={styles.lampRow}>
              <Text style={[type.readout, styles.flex, { color: kitColors.gold }]} accessibilityLabel={`${lampXP(lamp).toLocaleString()} XP ${typeof lamp === 'number' ? 'lamp' : 'combat lamp'}`}>+{lampXP(lamp).toLocaleString()}</Text>
              <KitButton compact label="Use here" accessibilityLabel={`Use the lamp on ${skill}`} onPress={() => applyLamp(i, skill)} />
            </View>
          ))}
        </Panel>
      )}

      <Panel title="Unlocks">
        {unlocks.length === 0 && <Body muted>{skill} rises as you fight; nothing unlocks with it yet.</Body>}
        {unlocks.map((u) => (
          <Row
            key={u.key}
            dim={level < u.level}
            left={u.icon}
            title={u.title}
            subtitle={u.detail}
            detail={<Tag label={`Lv ${u.level}`} tone={level >= u.level ? 'green' : 'red'} accessibilityLabel={`Level ${u.level}`} />}
          />
        ))}
      </Panel>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  lampRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  questSlot: { width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' },
  questIcon: { width: SLOT * 0.62, height: SLOT * 0.62 },
});
