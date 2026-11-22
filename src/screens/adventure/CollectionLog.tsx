/**
 * The collection log (PROG-047): every unique in the game by section (each boss, then
 * the skilling pets of PROG-046), found ones lit and the rest dim. Under each section,
 * when each find came and at what kill count or level. Its one home is Hero's Log section.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CollectionEntry, collectionLog, collectionProgress, GameState, itemName } from '../../game';
import { Body, ItemSlot, Panel, ProgressBar, space, StatReadout, Tag } from '../../game-ui';

const SLOT = 64;

/** "Nov 21 · 145 kills", "Nov 21 · level 72", or "Found" when the date isn't known. */
function foundLine(e: CollectionEntry): string {
  const when = e.atMs > 0 ? new Date(e.atMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Found';
  if (e.kc !== undefined) return `${when} · ${e.kc.toLocaleString()} kills`;
  if (e.level !== undefined) return `${when} · level ${e.level}`;
  return when;
}

export function CollectionLogSections({ state }: { state: GameState }) {
  const { found, total } = collectionProgress(state);
  return (
    <>
      <Panel>
        <StatReadout label="Found" value={String(found)} max={String(total)} tone="gold" />
        <ProgressBar fraction={total ? found / total : 0} />
      </Panel>
      {collectionLog().map((section) => {
        const got = section.items.filter((i) => state.collection[i]);
        return (
          <Panel key={section.id} title={section.title} right={<Tag label={`${got.length}/${section.items.length}`} tone={got.length === section.items.length ? 'green' : 'text'} />}>
            <View style={styles.grid}>
              {section.items.map((item) => {
                const has = !!state.collection[item];
                return (
                  <View key={item} style={!has && styles.missing} accessible accessibilityLabel={has ? `${itemName(item)}, found` : 'Not found yet'}>
                    <ItemSlot id={item} name={itemName(item)} size={SLOT} />
                  </View>
                );
              })}
            </View>
            {got.map((item) => <Body key={item} muted>{itemName(item)}: {foundLine(state.collection[item])}</Body>)}
          </Panel>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Not found yet: a faint shape only, so the log hints at what's out there.
  missing: { opacity: 0.18 },
});
