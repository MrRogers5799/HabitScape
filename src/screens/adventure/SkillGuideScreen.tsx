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
import { GameSkill, ITEMS, itemName, levelOf, METHODS, QUESTS, regionName, ToolType } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, FRAMES, ItemSlot, KitButton, KitScreen, kitColors, NineSlice, Panel, ProgressBar, Row, SkillIcon, SkillSlot, space, StatReadout,
  TAB_ICONS, Tag, type,
} from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Skill'>;

const SLOT = 52;
/** The skill each tool type is used with. */
const TOOL_SKILL: Record<ToolType, GameSkill> = { pickaxe: 'Mining', hatchet: 'Woodcutting', small_net: 'Fishing', fishing_rod: 'Fishing' };

interface Unlock { key: string; level: number; title: string; icon: React.ReactNode; detail?: string }

function unlocksFor(skill: GameSkill): Unlock[] {
  const out: Unlock[] = [];
  for (const m of Object.values(METHODS)) {
    if (m.skill !== skill || m.id.startsWith('melt-')) continue;
    const icon = m.output ?? (m.kind === 'process' ? Object.keys(m.inputs)[0] : undefined);
    out.push({
      key: m.id, level: m.level, title: m.name,
      icon: icon ? <ItemSlot id={icon} name={itemName(icon)} size={SLOT} /> : <SkillSlot skill={skill} size={SLOT} />,
      detail: `${m.xpEach} XP each · ${m.regions.map(regionName).join(', ')}`,
    });
  }
  for (const item of Object.values(ITEMS)) {
    if (item.equip?.wear.skill === skill) {
      out.push({ key: `wear-${item.id}`, level: item.equip.wear.level, title: `Wear ${item.name.toLowerCase()}`, icon: <ItemSlot id={item.id} name={item.name} size={SLOT} /> });
    }
    if (item.tool && TOOL_SKILL[item.tool.type] === skill && item.tool.level > 1) {
      out.push({ key: `tool-${item.id}`, level: item.tool.level, title: `Use ${item.name.toLowerCase()}`, icon: <ItemSlot id={item.id} name={item.name} size={SLOT} /> });
    }
  }
  for (const q of Object.values(QUESTS)) {
    const req = q.requirements.find((r) => r.kind === 'skill' && r.skill === skill);
    if (req && req.kind === 'skill') {
      out.push({
        key: `quest-${q.id}`, level: req.level, title: `Quest: ${q.name}`,
        icon: <NineSlice frame={FRAMES.slot} style={styles.questSlot}><Image source={TAB_ICONS.activities} style={styles.questIcon} /></NineSlice>,
      });
    }
  }
  return out.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
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
        <StatReadout label="Level" value={String(level)} max="99" tone="gold" icon={<SkillIcon skill={skill} size={40} />} />
        {to !== undefined && <ProgressBar fraction={(xp - from) / (to - from)} />}
        <Body muted>{xp.toLocaleString()} XP{to !== undefined ? ` · ${(to - xp).toLocaleString()} to level ${level + 1}` : ''}</Body>
      </Panel>

      {state.lamps.length > 0 && (
        <Panel title="XP lamps">
          {/* The amount stays out of the button: Pixelify's small digits misread. */}
          {state.lamps.map((amount, i) => (
            <View key={i} style={styles.lampRow}>
              <Text style={[type.readout, styles.flex, { color: kitColors.gold }]} accessibilityLabel={`${amount.toLocaleString()} XP lamp`}>+{amount.toLocaleString()}</Text>
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
