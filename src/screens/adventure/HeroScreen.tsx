/**
 * Hero: the player's name, with the cog that opens Settings and the account (PROD-026), then one section
 * at a time (OQ-36): Skills (each opens its guide, where XP lamps are used), Gear, Bank and the collection log (PROG-047), as icons
 * with numbers (new-version kit, PROD-024/025). Each thing has one home: gear and tools live in Gear,
 * so the Bank shows everything else.
 */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { GAME_SKILLS, GameSkill, ITEMS, itemName, levelOf, ToolType, wornGear } from '../../game';
import { CollectionLogSections } from './CollectionLog';
import { QuestJournal } from './QuestJournal';
import { HeroRoom } from './HeroRoom';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, ItemSlot, KitScreen, LootGrid, NeedsTag, Panel, FRAMES, NineSlice, Row, SectionTabs, SkillTile, space, TAB_ICONS, Tag,
} from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Hero'>;


type Section = 'skills' | 'gear' | 'bank' | 'quests' | 'log';
const SECTIONS: { label: string; value: Section }[] = [
  { label: 'Skills', value: 'skills' }, { label: 'Gear', value: 'gear' }, { label: 'Bank', value: 'bank' }, { label: 'Quests', value: 'quests' }, { label: 'Log', value: 'log' },
];

/** The skill each tool type is used for, so its level requirement can show that skill's icon. */
const TOOL_SKILL: Record<ToolType, GameSkill> = { pickaxe: 'Mining', hatchet: 'Woodcutting', small_net: 'Fishing', fishing_rod: 'Fishing' };

export function HeroScreen({ navigation, route }: Props) {
  const { state } = useGame();
  const { user } = useAuth();
  // A link can open a section (the road to the Bog Warden's quest steps open Quests).
  const [section, setSection] = useState<Section>(route.params?.section ?? 'skills');
  useEffect(() => { if (route.params?.section) setSection(route.params.section); }, [route.params?.section]);
  if (!state) return null;

  const owned = (Object.entries(state.bank) as [string, number][]).filter(([, n]) => n > 0).sort(([, x], [, y]) => y - x);
  const isGear = (id: string) => !!(ITEMS[id]?.equip || ITEMS[id]?.tool);
  // What's worn or used comes first, marked, then spare pieces (UI review 2026-11-21).
  const worn = wornGear(state);
  const gear = owned.filter(([id]) => isGear(id)).sort(([a], [b]) => Number(worn.has(b)) - Number(worn.has(a)));
  const items = owned.filter(([id]) => !isGear(id));
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
        {/* The Hero room (PROD-037): the adventurer with what they wear and use. */}
        <HeroRoom state={state} />
        <View style={styles.tags}>
          <Tag label={`Total ${total}`} tone="gold" accessibilityLabel={`Total level ${total}`} />
          <Tag label={`Quests ${questsDone}`} accessibilityLabel={`${questsDone} quests done`} />
        </View>
      </Panel>

      <SectionTabs options={SECTIONS} value={section} onChange={setSection} />

      {/* Tapping a skill opens its guide, which is also where XP lamps are used (one home, PROD-029). */}
      {section === 'skills' && (
        // No panel title: the selected section button already names it.
        <Panel>
          {state.lamps.length > 0 && (
            <Body muted>{`You have ${state.lamps.length} XP lamp${state.lamps.length === 1 ? '' : 's'}: open a skill to use one there${state.lamps.some((l) => typeof l !== 'number') ? ' (combat lamps go into Attack, Strength, Defence or Hitpoints)' : ''}.`}</Body>
          )}
          <View style={styles.tiles}>
            {GAME_SKILLS.map((s) => <SkillTile key={s} skill={s} level={levelOf(state, s)} onPress={() => navigation.navigate('Skill', { skill: s })} />)}
          </View>
        </Panel>
      )}

      {section === 'gear' && <Panel>
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
                  {worn.has(id) && <Tag label={eq ? 'Worn' : 'Used'} tone="gold" />}
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
        {gear.length > 0 && <Body muted>Your best gear is worn on each trip; a fight may swap a weapon to hit a weakness.</Body>}
      </Panel>}

      {section === 'bank' && (
        <Panel>
          {items.length === 0 ? <Body muted>Empty.</Body> : <LootGrid items={items} nameOf={itemName} size={60} />}
        </Panel>
      )}

      {section === 'quests' && <QuestJournal />}
      {section === 'log' && <CollectionLogSections state={state} />}
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  cog: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  cogIcon: { width: 30, height: 30 },
  pressed: { opacity: 0.8 },
});
