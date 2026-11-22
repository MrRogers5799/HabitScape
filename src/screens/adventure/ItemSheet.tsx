/**
 * The item sheet (owner notes 2026-11-22, #6 and #7): tap any item slot in the game to see
 * what it is, how many you have, what makes it or drops it, and what you can do with it.
 * Uses queue straight from here ("Cook shrimp": all you can, as a work order, PROG-043),
 * so a bank item is one tap from being put to work. Creatures open a short card too.
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useGame } from '../../context/GameContext';
import {
  canMakeFrom, collectionItems, CREATURES, formatHours, ITEMS, itemName, levelOf, METHODS, normaliseLeg, regionName, REGIONS, SKILL_PETS,
} from '../../game';
import { Body, ItemIcon, ItemInfoContext, KitButton, KitModal, NeedsTag, Row, space, Tag } from '../../game-ui';

const SLOT_NAMES: Record<string, string> = {
  head: 'head', neck: 'neck', cape: 'cape', chest: 'body', legs: 'legs', boots: 'feet', gloves: 'hands', ring: 'ring', mainHand: 'weapon', offHand: 'shield',
};
const TOOL_SKILL: Record<string, 'Mining' | 'Woodcutting' | 'Fishing'> = { pickaxe: 'Mining', hatchet: 'Woodcutting', small_net: 'Fishing', fishing_rod: 'Fishing' };
const PETS = new Set(Object.values(SKILL_PETS).concat('bogling'));

export function ItemSheetProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <ItemInfoContext.Provider value={{ open: setId }}>
      {children}
      <ItemSheet id={id} onClose={() => setId(null)} />
    </ItemInfoContext.Provider>
  );
}

function ItemSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, send } = useGame();
  const [busy, setBusy] = useState(false);
  if (!id || !state) return <KitModal visible={false} title="" onClose={onClose}>{null}</KitModal>;

  const creature = CREATURES[id];
  const item = ITEMS[id];
  const open = (regionId: string) => {
    const gate = REGIONS[regionId]?.questGate;
    return !gate || !!state.quests[gate];
  };

  const queue = async (methodId: string, regionId: string, count: number, label: string) => {
    setBusy(true);
    try {
      await send([{ activityId: methodId, regionId, hours: 0, count }]);
      onClose();
      Alert.alert('Added to the queue', label);
    } catch (e) {
      Alert.alert("Couldn't add that", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (creature) {
    const drops = [creature.bones, ...creature.drops.map((d) => d.item)];
    return (
      <KitModal visible title={creature.name} onClose={onClose}>
        <View style={styles.head}>
          <ItemIcon id={creature.id} name={creature.name} size={72} />
          <View style={styles.tags}>
            <Tag label={`Lv ${creature.level}`} accessibilityLabel={`Level ${creature.level}`} />
            <Tag label={`${creature.hp} HP`} accessibilityLabel={`${creature.hp} hitpoints`} />
            <Tag label={regionName(creature.region)} />
            {creature.weakness && <Tag label={`Weak: ${creature.weakness}`} tone="gold" />}
            {creature.boss && <Tag label="Boss" tone="gold" />}
          </View>
        </View>
        <Body muted>Kills so far: {(state.kills[creature.id] ?? 0).toLocaleString()}</Body>
        <View style={styles.tags}>
          {drops.map((d) => <Tag key={d} label={itemName(d)} icon={<ItemIcon id={d} name={itemName(d)} size={20} />} />)}
        </View>
      </KitModal>
    );
  }

  const name = item?.name ?? itemName(id);
  const have = state.bank[id] ?? 0;
  const facts: string[] = [];
  if (item?.equip) {
    const e = item.equip;
    facts.push(`Worn on the ${SLOT_NAMES[e.slot] ?? e.slot}${e.power ? `: power ${e.power}${e.attackType ? ` (${e.attackType})` : ''}` : ''}${e.defence ? `: defence ${e.defence}` : ''}.`);
  }
  if (item?.tool) facts.push(`A tool for ${TOOL_SKILL[item.tool.type] ?? 'gathering'}${item.tool.tier > 1 ? `, tier ${item.tool.tier}: gathers faster` : ''}.`);
  if (item?.food) facts.push(`Food: heals ${item.food} in fights. Packed automatically when a fight needs it.`);
  if (PETS.has(id)) facts.push('A pet: a rare find, kept in your collection log.');
  else if (collectionItems().includes(id)) facts.push('A rare find for your collection log.');
  if (facts.length === 0) facts.push('A material, used to make other things.');

  const makers = Object.values(METHODS).filter((m) => m.output === id && !m.id.startsWith('melt-'));
  const droppers = Object.values(CREATURES).filter((c) => c.bones === id || c.drops.some((d) => d.item === id));
  const uses = Object.values(METHODS).filter((m) => m.kind === 'process' && m.inputs[id] !== undefined);

  return (
    <KitModal visible title={name} onClose={onClose}>
      <View style={styles.head}>
        <ItemIcon id={id} name={name} size={72} />
        <View style={styles.flex}>
          {facts.map((f) => <Body key={f} muted>{f}</Body>)}
          <Tag label={`You have ${have.toLocaleString()}`} tone={have > 0 ? 'green' : 'text'} />
        </View>
      </View>

      {uses.map((m) => {
        if (m.kind !== 'process') return null;
        const regionId = m.regions.find(open);
        const lvlOk = levelOf(state, m.skill) >= m.level;
        const questOk = !m.quest || !!state.quests[m.quest];
        const n = canMakeFrom(state.bank, m);
        const hours = regionId && n > 0 ? normaliseLeg(state, { activityId: m.id, regionId, hours: 0, count: n }).hours : 0;
        return (
          <Row
            key={m.id}
            dim={!lvlOk || !questOk || !regionId}
            title={m.name}
            detail={!lvlOk ? <NeedsTag skill={m.skill} level={m.level} met={false} />
              : !questOk ? <Tag label="Taught by a quest" tone="red" />
                : n === 0 ? <Tag label="not enough to make one" tone="red" />
                  : <Tag label={`×${n} · ${formatHours(hours)}`} accessibilityLabel={`${n}, taking ${formatHours(hours)}`} />}
            right={lvlOk && questOk && regionId && n > 0 ? (
              <KitButton compact label="Queue" disabled={busy} accessibilityLabel={`Queue: ${m.name}, all ${n}`}
                onPress={() => queue(m.id, regionId, n, `${m.name}: ${n}, about ${formatHours(hours)}.`)} />
            ) : undefined}
          />
        );
      })}

      {(makers.length > 0 || droppers.length > 0) && (
        <View style={styles.tags}>
          {makers.map((m) => <Tag key={m.id} label={`${m.name} · ${m.regions.map(regionName).join(', ')}`} />)}
          {droppers.map((c) => <Tag key={c.id} label={`Dropped by ${c.name}`} icon={<ItemIcon id={c.id} name={c.name} size={20} />} />)}
        </View>
      )}
    </KitModal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  flex: { flex: 1, gap: space.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
