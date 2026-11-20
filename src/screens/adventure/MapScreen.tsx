/**
 * Map: the valley's regions, each with icons for what's there, its travel time and what
 * opens it (new-version kit, PROD-024/025). A drawn world map comes later (art bible §11 step 3).
 */
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGame } from '../../context/GameContext';
import { activitiesIn, itemName, QUESTS, REGIONS } from '../../game';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import { ItemSlot, KitScreen, Panel, space, TAB_ICONS, Tag } from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Map'>;

const SLOT = 52;

export function MapScreen({ navigation }: Props) {
  const { state } = useGame();
  if (!state) return null;
  return (
    <KitScreen title="The valley" onBack={() => navigation.goBack()}>
      {Object.values(REGIONS).map((r) => {
        const locked = !!r.questGate && !state.quests[r.questGate];
        const a = activitiesIn(r.id);
        // What you can bring back from here, once each.
        const outputs = [...new Set(a.methods.map((m) => m.output).filter((o): o is string => !!o))];
        const travel = r.travelFraction ? `${Math.round(r.travelFraction * 100)}% travel` : 'No travel';
        return (
          <Pressable
            key={r.id}
            onPress={() => navigation.navigate('Region', { regionId: r.id })}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}${locked ? ', locked' : ''}`}
            style={({ pressed }) => [locked && styles.locked, pressed && styles.pressed]}
          >
            <Panel title={r.name} right={<Tag label={travel} />}>
              {(outputs.length > 0 || a.fights.length > 0) && (
                <View style={styles.icons}>
                  {outputs.map((id) => <ItemSlot key={id} id={id} name={itemName(id)} size={SLOT} />)}
                  {a.fights.map((c) => <ItemSlot key={c.id} id={c.id} name={c.name} size={SLOT} />)}
                </View>
              )}
              <View style={styles.tags}>
                {a.recipes.length > 0 && <Tag label="Anvil" />}
                {a.quests.length > 0 && (
                  <Tag
                    label={String(a.quests.length)}
                    icon={<Image source={TAB_ICONS.activities} style={styles.tagIcon} />}
                    accessibilityLabel={`${a.quests.length} quests`}
                  />
                )}
                {locked && <Tag tone="red" label={`Locked: ${QUESTS[r.questGate!]?.name ?? 'a quest'}`} />}
              </View>
            </Panel>
          </Pressable>
        );
      })}
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tagIcon: { width: 20, height: 20 },
  locked: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});
