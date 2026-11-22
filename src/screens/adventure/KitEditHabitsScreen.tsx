/**
 * Edit habits in the new version's kit (owner note 2026-11-22: the activity manager needed
 * the new style). Two sections: Your habits (change how often, or remove) and Add a habit
 * (search the catalog; each shows the adventure time it earns, PROD-015). The live app keeps
 * its own manager (PROD-024).
 */
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useActivities } from '../../context/ActivitiesContext';
import { ACTIVITY_TEMPLATES, ActivityTemplate } from '../../constants/activities';
import { CADENCE_CONFIG } from '../../constants/cadences';
import { Cadence } from '../../types';
import { formatHours, HOURS_PER_HABIT_XP } from '../../game';
import { habitAdventureXP } from '../../game/content/habitTiers';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, ButtonRow, KitButton, KitField, KitModal, KitScreen, kitColors, kitFonts, Panel, Row, SectionTabs, space, Tag,
} from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'EditHabits'>;
type Section = 'mine' | 'add';

const hoursOf = (id: string) => formatHours(habitAdventureXP(id) * HOURS_PER_HABIT_XP);
const cadenceLabel = (c: Cadence) => CADENCE_CONFIG[c]?.label ?? c;
const templateOf = (id: string) => ACTIVITY_TEMPLATES.find((t) => t.id === id);

/** A pick-one list of cadences, as rows with a tick (a row of buttons can't fit nine). */
function CadencePicker({ options, value, onChange }: { options: Cadence[]; value: Cadence; onChange: (c: Cadence) => void }) {
  return (
    <View>
      {options.map((c) => (
        <Row
          key={c}
          left={<Text style={[styles.tick, c !== value && styles.tickOff]}>{c === value ? '✓' : '·'}</Text>}
          title={cadenceLabel(c)}
          onPress={() => onChange(c)}
          accessibilityLabel={`${cadenceLabel(c)}${c === value ? ', chosen' : ''}`}
        />
      ))}
    </View>
  );
}

export function KitEditHabitsScreen({ navigation }: Props) {
  const { userActivities, addActivity, removeActivity, updateActivityCadence } = useActivities();
  const [section, setSection] = useState<Section>(userActivities.length ? 'mine' : 'add');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id: string; cadence: Cadence; adding: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const mineIds = useMemo(() => new Set(userActivities.map((a) => a.id)), [userActivities]);
  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ACTIVITY_TEMPLATES
      .filter((t) => !mineIds.has(t.id))
      .filter((t) => !q || t.activityName.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
      .sort((a, b) => Number(!!b.popular) - Number(!!a.popular) || a.activityName.localeCompare(b.activityName));
  }, [mineIds, query]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setEditing(null);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => Alert.alert(
    'Remove this habit?',
    'Its history and streak are kept, but it stops showing on the Habits tab.',
    [{ text: 'Keep it', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => run(() => removeActivity(id)) }],
  );

  const tmpl: ActivityTemplate | undefined = editing ? templateOf(editing.id) : undefined;

  return (
    <KitScreen title="Edit habits" onBack={() => navigation.goBack()}>
      <SectionTabs
        options={[{ label: 'Your habits', value: 'mine' }, { label: 'Add a habit', value: 'add' }]}
        value={section}
        onChange={setSection}
      />

      {section === 'mine' && (
        <Panel>
          {userActivities.length === 0 && <Body muted>No habits yet. Add one to start earning adventure time.</Body>}
          {userActivities.map((a) => (
            <Row
              key={a.id}
              title={templateOf(a.id)?.activityName ?? a.id}
              onPress={() => setEditing({ id: a.id, cadence: a.cadence, adding: false })}
              accessibilityLabel={`${templateOf(a.id)?.activityName ?? a.id}, ${cadenceLabel(a.cadence)}. Change or remove`}
              detail={(
                <>
                  <Tag label={cadenceLabel(a.cadence)} />
                  <Tag label={`+${hoursOf(a.id)}`} tone="gold" accessibilityLabel={`Earns about ${hoursOf(a.id)} of adventure time`} />
                </>
              )}
              right={<Text style={styles.arrow}>›</Text>}
            />
          ))}
        </Panel>
      )}

      {section === 'add' && (
        <Panel>
          <KitField placeholder="Search habits" value={query} onChangeText={setQuery} autoCapitalize="none" />
          {catalog.length === 0 && <Body muted>Nothing matches that.</Body>}
          {catalog.map((t) => (
            <Row
              key={t.id}
              title={t.activityName}
              subtitle={t.description}
              onPress={() => setEditing({ id: t.id, cadence: t.defaultCadence ?? t.availableCadences[0], adding: true })}
              accessibilityLabel={`Add ${t.activityName}`}
              detail={<Tag label={`+${hoursOf(t.id)}`} tone="gold" accessibilityLabel={`Earns about ${hoursOf(t.id)} of adventure time each time`} />}
              right={<Text style={styles.arrow}>+</Text>}
            />
          ))}
        </Panel>
      )}

      <KitModal visible={!!editing} title={tmpl?.activityName ?? 'Habit'} onClose={() => setEditing(null)}>
        {tmpl && editing && (
          <>
            <Body muted>{tmpl.description}</Body>
            <Text style={styles.heading}>How often</Text>
            <CadencePicker options={tmpl.availableCadences} value={editing.cadence} onChange={(cadence) => setEditing({ ...editing, cadence })} />
            <ButtonRow>
              {editing.adding ? (
                <KitButton label={busy ? 'Adding…' : 'Add habit'} disabled={busy} onPress={() => run(() => addActivity(editing.id, editing.cadence))} />
              ) : (
                <>
                  <KitButton kind="secondary" label="Remove" disabled={busy} onPress={() => remove(editing.id)} />
                  <KitButton label={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={() => run(() => updateActivityCadence(editing.id, editing.cadence))} />
                </>
              )}
            </ButtonRow>
          </>
        )}
      </KitModal>
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  arrow: { fontFamily: kitFonts.text, fontSize: 28, color: kitColors.gold, paddingHorizontal: space.xs },
  heading: { fontFamily: kitFonts.bold, fontSize: 16, color: kitColors.gold, marginTop: space.xs },
  tick: { fontFamily: kitFonts.text, fontSize: 26, color: kitColors.green, width: 24, textAlign: 'center' },
  tickOff: { color: kitColors.textFaint },
});
