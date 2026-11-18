/**
 * The developer's welcome note, shown once per account:
 *  - new players see <DevNote> inside the onboarding welcome panel;
 *  - players who had the app before 1.0 get <WelcomeOneZeroModal> on their next open.
 * Either way the account's seenNotes gets WELCOME_NOTE_ID, so it never shows twice.
 */
import React from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';
import { DISCORD_URL, ROADMAP_URL, WELCOME_NOTE_ID } from '../constants/links';

/** "A note from the dev" with Discord and roadmap links. */
export function DevNote({ intro }: { intro?: string }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteTitle}>A note from the dev</Text>
      <Text style={styles.noteBody}>
        {intro ?? 'HabitScape is brand new and built by one person (hi!).'} There&apos;s a lot more on the
        way, and if something feels off or you&apos;ve got an idea, I&apos;d genuinely love to hear it.
      </Text>
      <View style={styles.links}>
        <TouchableOpacity onPress={() => Linking.openURL(DISCORD_URL)} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.link}>Join the Discord →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(ROADMAP_URL)} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.link}>See what&apos;s coming →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const WHATS_NEW = [
  'Brand-new original art for every skill',
  'Forgot your password? Reset it from the login screen',
  'Fixed 2x/month streaks and Total Level',
  'Plenty of smaller fixes and polish',
];

/** One-time card for accounts that existed before 1.0 (they never see onboarding again). */
export function WelcomeOneZeroModal() {
  const { user, markNoteSeen } = useAuth();
  const visible = !!user && user.profileComplete && !(user.seenNotes ?? []).includes(WELCOME_NOTE_ID);
  const close = () => { markNoteSeen(WELCOME_NOTE_ID); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.cardContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>HabitScape 1.0 is here!</Text>
            <Text style={styles.body}>Thanks for being here early. Here&apos;s what&apos;s new:</Text>
            <View style={styles.list}>
              {WHATS_NEW.map(item => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.listItem}>•</Text>
                  <Text style={[styles.listItem, styles.listText]}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.divider} />
            <DevNote intro="HabitScape is still early and built by one person." />
            <TouchableOpacity style={styles.button} onPress={close}>
              <Text style={styles.buttonText}>Back to the grind  →</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  note: { gap: 6 },
  noteTitle: {
    fontFamily: fonts.heading,
    fontSize: 8,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  noteBody: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 6, marginTop: 2 },
  link: { fontFamily: fonts.display, fontSize: 18, color: colors.gold },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: { backgroundColor: colors.surface, ...bevel.raised, maxHeight: '85%' },
  cardContent: { padding: 24 },
  title: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  body: { fontFamily: fonts.display, fontSize: 17, color: colors.textPrimary, lineHeight: 22 },
  list: { gap: 4, marginTop: 8, marginBottom: 4 },
  listRow: { flexDirection: 'row', gap: 10 },
  listText: { flex: 1 },
  listItem: { fontFamily: fonts.display, fontSize: 16, color: colors.textSecondary, lineHeight: 22 },
  divider: { height: 1, backgroundColor: colors.bevelDark, marginVertical: 16 },
  button: {
    backgroundColor: colors.gold,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 24,
    ...bevel.raised,
  },
  buttonText: { fontFamily: fonts.display, fontSize: 20, color: colors.background },
});
