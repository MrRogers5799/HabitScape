/**
 * The new version's Settings, opened from the cog on Hero (PROD-026), in the UI kit.
 * The account (name, password, sign out) comes first, then habits, week and timezone,
 * about and legal, and deleting the account. Same features as the live Settings and
 * Profile screens, which stay as they are until launch (PROD-024).
 */
import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useActivities } from '../../context/ActivitiesContext';
import { ActivitySelectionWizard } from '../../components/ActivitySelectionWizard';
import { COMMON_TIMEZONES } from '../../constants/timezones';
import { DISCORD_URL, ROADMAP_URL } from '../../constants/links';
import { PRIVACY_POLICY, PRIVACY_UPDATED } from '../../constants/privacyPolicy';
import { Cadence } from '../../types';
import { AdventureStackParamList } from '../../navigation/AdventureNavigator';
import {
  Body, ButtonRow, Choice, KitButton, KitField, KitModal, KitScreen, kitColors, kitFonts, Panel, Row, space, Tag, type,
} from '../../game-ui';

type Props = NativeStackScreenProps<AdventureStackParamList, 'Settings'>;

const PLAY_ID = 'com.buckorogers.habitscape';
const FEEDBACK_MAIL = 'mailto:rogersalec99@gmail.com?subject=HabitScape%20Feedback';

const nameFromEmail = (email: string) => {
  const prefix = email.split('@')[0] ?? 'Adventurer';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
};

/** A tappable row that opens something (a link, a modal) with a gold arrow. */
function LinkRow({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  return <Row title={title} subtitle={subtitle} onPress={onPress} right={<Text style={styles.arrow}>›</Text>} />;
}

export function KitSettingsScreen({ navigation }: Props) {
  const { user, updateDisplayName, changePassword, logOut, updateTimezone, updateWeekStartDay, deleteAccount } = useAuth();
  const { userActivities, addActivity, removeActivity } = useActivities();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [modal, setModal] = useState<null | 'password' | 'signOut' | 'timezone' | 'privacy' | 'delete'>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<'warn' | 'confirm'>('warn');
  const [deletePassword, setDeletePassword] = useState('');
  const [wizard, setWizard] = useState(false);

  const displayName = user?.displayName?.trim() || nameFromEmail(user?.email ?? 'adventurer');
  const tzLabel = COMMON_TIMEZONES.find((t) => t.value === user?.timezone)?.label ?? user?.timezone ?? '—';
  const close = () => { setModal(null); setPwError(null); };

  async function run(fn: () => Promise<unknown>, failure = 'Something went wrong. Please try again.') {
    try {
      setBusy(true);
      await fn();
      return true;
    } catch (e: unknown) {
      Alert.alert('Something went wrong', e instanceof Error && e.message ? e.message : failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (await run(() => updateDisplayName(trimmed))) setEditingName(false);
  }

  async function savePassword() {
    if (!pw.current || !pw.next) return setPwError('Fill in all three fields.');
    if (pw.next !== pw.confirm) return setPwError('The new passwords don’t match.');
    if (pw.next.length < 6) return setPwError('Use at least 6 characters.');
    setPwError(null);
    if (await run(() => changePassword(pw.current, pw.next))) {
      setPw({ current: '', next: '', confirm: '' });
      close();
      Alert.alert('Password updated');
    }
  }

  async function confirmDelete() {
    if (!deletePassword) return;
    try {
      setBusy(true);
      await deleteAccount(deletePassword);
      // Signing out happens through the auth state; the app returns to the login screen.
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      Alert.alert('Couldn’t delete the account', code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? 'That password is wrong.' : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function openRating() {
    const market = `market://details?id=${PLAY_ID}`;
    await Linking.openURL((await Linking.canOpenURL(market)) ? market : `https://play.google.com/store/apps/details?id=${PLAY_ID}`);
  }

  return (
    <KitScreen title="Settings" onBack={() => navigation.goBack()}>
      <Panel title="Account">
        {editingName ? (
          <>
            <KitField value={nameInput} onChangeText={setNameInput} placeholder="Your name" autoCapitalize="words" maxLength={24} autoFocus editable={!busy} />
            <ButtonRow>
              <KitButton kind="secondary" label="Cancel" onPress={() => setEditingName(false)} disabled={busy} />
              <KitButton label="Save" onPress={saveName} disabled={busy || !nameInput.trim()} />
            </ButtonRow>
          </>
        ) : (
          <Row
            title={displayName}
            subtitle={user?.email}
            right={<KitButton compact kind="secondary" label="Rename" onPress={() => { setNameInput(user?.displayName ?? ''); setEditingName(true); }} />}
          />
        )}
        <ButtonRow>
          <KitButton kind="secondary" label="Password" onPress={() => setModal('password')} />
          <KitButton kind="secondary" label="Sign out" onPress={() => setModal('signOut')} />
        </ButtonRow>
      </Panel>

      <Panel title="Habits" right={<Tag label={String(userActivities.length)} accessibilityLabel={`${userActivities.length} habits`} />}>
        <ButtonRow><KitButton label="Edit habits" onPress={() => setWizard(true)} /></ButtonRow>
      </Panel>

      <Panel title="Week and time">
        <Text style={type.caption}>Week starts on</Text>
        <Choice
          options={[{ label: 'Monday', value: 1 as const }, { label: 'Sunday', value: 0 as const }]}
          value={user?.weekStartDay ?? 1}
          disabled={busy}
          onChange={(d) => { if (d !== (user?.weekStartDay ?? 1)) run(() => updateWeekStartDay(d)); }}
        />
        <Row title="Timezone" subtitle={tzLabel} onPress={() => setModal('timezone')} right={<Text style={styles.arrow}>›</Text>} />
      </Panel>

      <Panel title="About">
        <Row title="Version" right={<Tag label={Constants.expoConfig?.version ?? '—'} />} />
        <LinkRow title="Rate HabitScape" subtitle="On Google Play" onPress={openRating} />
        <LinkRow title="Feedback and support" subtitle="Send us a message" onPress={() => Linking.openURL(FEEDBACK_MAIL)} />
        <LinkRow title="Discord" subtitle="Join the community" onPress={() => Linking.openURL(DISCORD_URL)} />
        <LinkRow title="Roadmap" subtitle="See what’s coming" onPress={() => Linking.openURL(ROADMAP_URL)} />
        <LinkRow title="Privacy policy" onPress={() => setModal('privacy')} />
        <Body muted>
          A fan-made app inspired by Old School RuneScape, not affiliated with or endorsed by Jagex Ltd. Old School RuneScape is a trademark of Jagex Ltd. All HabitScape art is original. Fonts: Pixelify Sans, VT323 and Press Start 2P (SIL Open Font License).
        </Body>
        <Body muted>HabitScape staff will never ask for your password, bank PIN or game login. Anyone who does is a scammer.</Body>
      </Panel>

      <Panel title="Danger zone">
        <ButtonRow><KitButton kind="secondary" label="Delete account" onPress={() => { setDeleteStep('warn'); setDeletePassword(''); setModal('delete'); }} /></ButtonRow>
      </Panel>

      {/* ---- Modals ---- */}
      <KitModal visible={modal === 'password'} title="Change password" onClose={close}>
        <KitField placeholder="Current password" secureTextEntry autoCapitalize="none" value={pw.current} onChangeText={(t) => setPw({ ...pw, current: t })} />
        <KitField placeholder="New password" secureTextEntry autoCapitalize="none" value={pw.next} onChangeText={(t) => setPw({ ...pw, next: t })} />
        <KitField placeholder="Confirm new password" secureTextEntry autoCapitalize="none" value={pw.confirm} onChangeText={(t) => setPw({ ...pw, confirm: t })} error={pwError ?? undefined} />
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={close} disabled={busy} />
          <KitButton label="Save" onPress={savePassword} disabled={busy} />
        </ButtonRow>
      </KitModal>

      <KitModal visible={modal === 'signOut'} title="Sign out?" onClose={close}>
        <ButtonRow>
          <KitButton kind="secondary" label="Cancel" onPress={close} />
          <KitButton label="Sign out" onPress={() => { close(); logOut(); }} />
        </ButtonRow>
      </KitModal>

      <KitModal visible={modal === 'timezone'} title="Timezone" onClose={close}>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {COMMON_TIMEZONES.map((tz) => {
            const selected = tz.value === user?.timezone;
            return (
              <Pressable
                key={tz.value}
                onPress={() => { close(); if (!selected) run(() => updateTimezone(tz.value)); }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={styles.listRow}
              >
                <Text style={[type.body, selected && { color: kitColors.gold }]}>{tz.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ButtonRow><KitButton kind="secondary" label="Close" onPress={close} /></ButtonRow>
      </KitModal>

      <KitModal visible={modal === 'privacy'} title="Privacy policy" onClose={close}>
        <ScrollView style={styles.list}>
          <Text style={type.caption}>{PRIVACY_UPDATED}</Text>
          {PRIVACY_POLICY.map((p) => (
            <View key={p.heading} style={styles.policyBlock}>
              <Text style={type.bodyBold}>{p.heading}</Text>
              <Text style={type.body}>{p.body}</Text>
            </View>
          ))}
        </ScrollView>
        <ButtonRow><KitButton kind="secondary" label="Close" onPress={close} /></ButtonRow>
      </KitModal>

      <KitModal visible={modal === 'delete'} title="Delete account" onClose={close}>
        {deleteStep === 'warn' ? (
          <>
            <Text style={[type.bodyBold, { color: kitColors.red }]}>This can’t be undone.</Text>
            <Body>Deleting your account erases your habits, streaks and history, your adventurer and everything in their bank, and your workouts. It can’t be recovered.</Body>
            <ButtonRow>
              <KitButton kind="secondary" label="Cancel" onPress={close} />
              <KitButton label="Continue" onPress={() => setDeleteStep('confirm')} />
            </ButtonRow>
          </>
        ) : (
          <>
            <Body>Enter your password to delete your account for good.</Body>
            <KitField placeholder="Your password" secureTextEntry autoCapitalize="none" autoFocus value={deletePassword} onChangeText={setDeletePassword} editable={!busy} />
            <ButtonRow>
              <KitButton kind="secondary" label="Back" onPress={() => setDeleteStep('warn')} disabled={busy} />
              <KitButton label={busy ? 'Deleting…' : 'Delete'} onPress={confirmDelete} disabled={busy || !deletePassword} />
            </ButtonRow>
          </>
        )}
      </KitModal>

      <ActivitySelectionWizard
        visible={wizard}
        onClose={() => setWizard(false)}
        selectedActivities={userActivities}
        onActivityAdded={async (id: string, cadence: Cadence) => { await run(() => addActivity(id, cadence)); }}
        onActivityRemoved={async (id: string) => { await run(() => removeActivity(id)); }}
        loading={busy}
        mode="manage"
      />
    </KitScreen>
  );
}

const styles = StyleSheet.create({
  arrow: { fontFamily: kitFonts.text, fontSize: 28, color: kitColors.gold, paddingHorizontal: space.xs },
  list: { maxHeight: 420 },
  listRow: { paddingVertical: space.sm },
  policyBlock: { gap: space.xxs, marginTop: space.md },
});
