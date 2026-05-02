import React, { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ACTIVITY_TEMPLATES, ActivityTemplate } from '../constants/activities';
import { Cadence } from '../types';
import { OSRS_SKILLS, SKILL_COLORS, SKILL_ICONS } from '../constants/osrsSkills';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

// ─── Cadence display helpers ──────────────────────────────────────────────────

const CADENCE_LABEL: Record<Cadence, string> = {
  'daily':   'Daily',
  '6x/week': '6×/wk',
  '5x/week': '5×/wk',
  '4x/week': '4×/wk',
  '3x/week': '3×/wk',
  '2x/week': '2×/wk',
  'weekly':  'Weekly',
  'monthly': 'Monthly',
};

// ─── Step dots ───────────────────────────────────────────────────────────────

function StepDots({ step }: { step: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4].map(n => (
        <View key={n} style={[styles.dot, n === step && styles.dotActive]} />
      ))}
    </View>
  );
}

// ─── Step 1: Welcome + display name ──────────────────────────────────────────

function Step1({
  displayName,
  onChange,
  onNext,
  onSignOut,
}: {
  displayName: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onSignOut: () => void;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.welcomeTop}>
        <Text style={styles.logo}>HABITSCAPE</Text>
        <Text style={styles.logoTagline}>Level up your real life</Text>
      </View>

      <View style={styles.welcomeMid}>
        <Text style={styles.stepTitle}>Welcome, Adventurer!</Text>
        <Text style={styles.stepSubtitle}>
          Track your daily habits as if they were OSRS skills — earn XP, level up, and build streaks.
        </Text>
        <Text style={styles.inputLabel}>What shall we call you?</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Adventurer name (optional)"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={onChange}
          maxLength={24}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={onNext}
        />

        <Text style={styles.howItWorksLabel}>HOW IT WORKS</Text>
        <View style={styles.howItWorksCard}>
          {([
            { num: '1', title: 'Pick your activities', desc: 'Choose from dozens of habits across all OSRS skills.' },
            { num: '2', title: 'Set your schedule', desc: 'Each activity gets its own cadence — daily, 3×/week, weekly, and more.' },
            { num: '3', title: 'Earn XP & level up', desc: 'Complete activities to gain XP and watch your skills grow.' },
          ] as const).map(({ num, title, desc }, i, arr) => (
            <View key={num} style={[styles.howItWorksRow, i < arr.length - 1 && styles.howItWorksRowDivider]}>
              <View style={styles.howItWorksNum}>
                <Text style={styles.howItWorksNumText}>{num}</Text>
              </View>
              <View style={styles.howItWorksBody}>
                <Text style={styles.howItWorksTitle}>{title}</Text>
                <Text style={styles.howItWorksDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, styles.primaryButtonGrow]} onPress={onNext}>
            <Text style={styles.primaryButtonText}>Next  →</Text>
          </TouchableOpacity>
        </View>
        <StepDots step={1} />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Step 2: Activity multi-select ───────────────────────────────────────────

function Step2({
  selected,
  onToggle,
  onNext,
  onBack,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const allSkills = useMemo(
    () => {
      const skillSet = new Set(ACTIVITY_TEMPLATES.map(t => t.skillId));
      return OSRS_SKILLS.filter(s => skillSet.has(s));
    },
    []
  );

  const sections = useMemo(() => {
    const q = search.toLowerCase();
    const bySkill: Record<string, ActivityTemplate[]> = {};

    for (const t of ACTIVITY_TEMPLATES) {
      if (selectedSkill && t.skillId !== selectedSkill) continue;
      if (q && !t.activityName.toLowerCase().includes(q) && !t.skillId.toLowerCase().includes(q)) continue;
      if (!bySkill[t.skillId]) bySkill[t.skillId] = [];
      bySkill[t.skillId].push(t);
    }

    return OSRS_SKILLS
      .filter(skill => bySkill[skill]?.length)
      .map(skill => ({ title: skill, data: bySkill[skill] }));
  }, [search, selectedSkill]);

  const count = selected.size;

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Choose Your Training</Text>
        <Text style={styles.stepSubtitle}>Pick the habits you want to track. You can add more later in Settings.</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search activities…"
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.skillFilterRow}
        contentContainerStyle={styles.skillFilterContent}
      >
        <Pressable
          style={[styles.filterPill, !selectedSkill && styles.filterPillActive]}
          onPress={() => setSelectedSkill(null)}
        >
          <Text style={[styles.filterPillText, !selectedSkill && styles.filterPillTextActive]}>ALL</Text>
        </Pressable>
        {allSkills.map(skill => {
          const active = selectedSkill === skill;
          return (
            <Pressable
              key={skill}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setSelectedSkill(active ? null : skill)}
            >
              <Image source={SKILL_ICONS[skill]} style={styles.filterPillIcon} resizeMode="contain" />
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{skill.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Image source={SKILL_ICONS[section.title]} style={styles.sectionHeaderIcon} resizeMode="contain" />
            <Text style={styles.sectionHeaderText}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              style={[styles.activityRow, isSelected && styles.activityRowSelected]}
              onPress={() => onToggle(item.id)}
            >
              <Image source={SKILL_ICONS[item.skillId]} style={styles.activityRowIcon} resizeMode="contain" />
              <View style={styles.activityRowInfo}>
                <Text style={[styles.activityRowName, isSelected && { color: colors.gold }]}>
                  {item.activityName}
                </Text>
                <Text style={styles.activityRowDesc} numberOfLines={1}>{item.description}</Text>
              </View>
              <View style={[styles.activityCheckbox, isSelected && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.sectionListContent}
      />

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.primaryButtonGrow, count === 0 && styles.primaryButtonDisabled]}
            onPress={onNext}
            disabled={count === 0}
          >
            <Text style={styles.primaryButtonText}>
              {count === 0 ? 'Select at least 1' : `Continue with ${count} →`}
            </Text>
          </TouchableOpacity>
        </View>
        <StepDots step={2} />
      </View>
    </View>
  );
}

// ─── Step 3: Cadence picker ───────────────────────────────────────────────────

function Step3({
  selected,
  cadences,
  onCadenceChange,
  onNext,
  onBack,
}: {
  selected: Set<string>;
  cadences: Record<string, Cadence>;
  onCadenceChange: (templateId: string, cadence: Cadence) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const templates = useMemo(
    () => ACTIVITY_TEMPLATES.filter(t => selected.has(t.id)),
    [selected]
  );

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Set Your Schedule</Text>
        <Text style={styles.stepSubtitle}>How often will you train each activity?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.cadenceList}>
        {templates.map(t => {
          const skillColor = SKILL_COLORS[t.skillId] ?? colors.gold;
          const chosen = cadences[t.id] ?? t.defaultCadence ?? t.availableCadences[0];
          return (
            <View key={t.id} style={styles.cadenceCard}>
              <View style={styles.cadenceCardHeader}>
                <Text style={styles.cadenceCardName}>{t.activityName}</Text>
                <View style={[styles.skillPill, { backgroundColor: `${skillColor}22`, borderColor: `${skillColor}66` }]}>
                  <Text style={[styles.skillPillText, { color: skillColor }]}>{t.skillId}</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cadenceButtons}>
                {t.availableCadences.map(c => {
                  const active = c === chosen;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.cadenceBtn, active && styles.cadenceBtnActive]}
                      onPress={() => onCadenceChange(t.id, c)}
                    >
                      <Text style={[styles.cadenceBtnText, active && styles.cadenceBtnTextActive]}>
                        {CADENCE_LABEL[c]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.primaryButtonGrow]}
            onPress={onNext}
          >
            <Text style={styles.primaryButtonText}>Next  →</Text>
          </TouchableOpacity>
        </View>
        <StepDots step={3} />
      </View>
    </View>
  );
}

// ─── Step 4: Week start day ───────────────────────────────────────────────────

function Step4({
  weekStartDay,
  onSelect,
  onFinish,
  onBack,
  saving,
}: {
  weekStartDay: 0 | 1;
  onSelect: (day: 0 | 1) => void;
  onFinish: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Week Start Day</Text>
        <Text style={styles.stepSubtitle}>
          Choose which day your week begins. This affects streaks, progress tracking, and your activity calendar.
        </Text>
      </View>

      <View style={styles.weekStartOptions}>
        {([{ label: 'Monday', sub: 'Mon → Sun', value: 1 }, { label: 'Sunday', sub: 'Sun → Sat', value: 0 }] as const).map(({ label, sub, value }) => {
          const active = weekStartDay === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.weekStartCard, active && styles.weekStartCardActive]}
              onPress={() => onSelect(value)}
            >
              <Text style={[styles.weekStartCardLabel, active && styles.weekStartCardLabelActive]}>{label}</Text>
              <Text style={[styles.weekStartCardSub, active && styles.weekStartCardSubActive]}>{sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={saving}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.primaryButtonGrow, saving && styles.primaryButtonDisabled]}
            onPress={onFinish}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.background} />
              : <Text style={styles.primaryButtonText}>Begin Training!</Text>
            }
          </TouchableOpacity>
        </View>
        <StepDots step={4} />
      </View>
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const { user, completeOnboarding, logOut, updateWeekStartDay } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cadences, setCadences] = useState<Record<string, Cadence>>({});
  const [weekStartDay, setWeekStartDay] = useState<0 | 1>(1);
  const [saving, setSaving] = useState(false);

  // Pre-fill cadences to each template's defaultCadence when entering step 3
  useEffect(() => {
    if (step === 3) {
      setCadences(prev => {
        const next = { ...prev };
        for (const id of Array.from(selected)) {
          if (!next[id]) {
            const t = ACTIVITY_TEMPLATES.find(t => t.id === id);
            if (t) next[id] = t.defaultCadence ?? t.availableCadences[0];
          }
        }
        return next;
      });
    }
  }, [step]);

  function toggleActivity(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    try {
      const activities = ACTIVITY_TEMPLATES
        .filter(t => selected.has(t.id))
        .map(t => ({
          templateId: t.id,
          cadence: cadences[t.id] ?? t.defaultCadence ?? t.availableCadences[0],
          skillId: t.skillId,
          baseXP: t.baseXP,
        }));
      await Promise.all([
        completeOnboarding(displayName, activities),
        updateWeekStartDay(weekStartDay),
      ]);
      // RootNavigator re-renders automatically once user.profileComplete flips to true
    } catch (err) {
      setSaving(false);
      Alert.alert('Something went wrong', 'Could not save your setup. Please try again.');
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {step === 1 && (
        <Step1
          displayName={displayName}
          onChange={setDisplayName}
          onNext={() => setStep(2)}
          onSignOut={logOut}
        />
      )}
      {step === 2 && (
        <Step2
          selected={selected}
          onToggle={toggleActivity}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Step3
          selected={selected}
          cadences={cadences}
          onCadenceChange={(id, c) => setCadences(prev => ({ ...prev, [id]: c }))}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && (
        <Step4
          weekStartDay={weekStartDay}
          onSelect={setWeekStartDay}
          onFinish={handleFinish}
          onBack={() => setStep(3)}
          saving={saving}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  signOutBtn: {
    alignSelf: 'center',
    marginTop: 12,
  },
  signOutText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Step shell
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  stepTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.gold,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },

  // Step 1 layout
  welcomeTop: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  logo: {
    fontFamily: fonts.heading,
    fontSize: 32,
    color: colors.gold,
    letterSpacing: 4,
  },
  logoTagline: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
  },
  welcomeMid: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  inputLabel: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 20,
  },
  textInput: {
    backgroundColor: colors.surface,
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...bevel.inset,
  },

  // Step 1 — how it works
  howItWorksLabel: {
    fontFamily: fonts.heading,
    fontSize: 8,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 8,
  },
  howItWorksCard: {
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  howItWorksRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  howItWorksRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.bevelDark,
  },
  howItWorksNum: {
    width: 24,
    height: 24,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    ...bevel.raised,
    marginTop: 1,
  },
  howItWorksNumText: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.background,
  },
  howItWorksBody: {
    flex: 1,
  },
  howItWorksTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  howItWorksDesc: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Step 2 — activity list
  searchRow: {
    marginTop: 8,
  },
  searchInput: {
    backgroundColor: colors.surfaceSunken,
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...bevel.inset,
  },
  sectionListContent: {
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 4,
    gap: 6,
    elevation: 2,
  },
  sectionHeaderIcon: {
    width: 14,
    height: 14,
    opacity: 0.7,
  },
  sectionHeaderText: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.surface,
    ...bevel.raised,
    gap: 10,
  },
  activityRowSelected: {
    backgroundColor: `${colors.gold}18`,
    borderColor: `${colors.gold}55`,
  },
  activityRowIcon: {
    width: 26,
    height: 26,
  },
  activityCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...bevel.inset,
  },
  checkmark: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
  activityRowInfo: {
    flex: 1,
  },
  activityRowName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
  },
  activityRowDesc: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // Step 3 — cadence cards
  cadenceList: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  cadenceCard: {
    backgroundColor: colors.surface,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...bevel.raised,
  },
  cadenceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cadenceCardName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  cadenceButtons: {
    gap: 6,
    paddingRight: 4,
  },
  cadenceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  cadenceBtnActive: {
    backgroundColor: colors.gold,
    ...bevel.raised,
  },
  cadenceBtnText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.textSecondary,
  },
  cadenceBtnTextActive: {
    color: colors.background,
    fontWeight: '700',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSunken,
    ...bevel.inset,
  },
  dotActive: {
    backgroundColor: colors.gold,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...bevel.raised,
  },
  primaryButtonGrow: {
    flex: 1,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.background,
  },
  backButton: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...bevel.raised,
  },
  backButtonText: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.textSecondary,
  },
  signOutButton: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: '#7a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderTopColor: '#c04040',
    borderLeftColor: '#c04040',
    borderBottomColor: '#3a0a0a',
    borderRightColor: '#3a0a0a',
  },
  signOutButtonText: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: '#ff9999',
  },

  skillFilterRow: {
    backgroundColor: colors.surfaceSunken,
    flexGrow: 0,
    borderBottomWidth: 2,
    borderBottomColor: colors.bevelDark,
  },
  skillFilterContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, flexDirection: 'row', alignItems: 'center' },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    ...bevel.raised,
    gap: 5,
  },
  filterPillActive: {
    backgroundColor: colors.gold,
    borderTopColor: '#f0d060',
    borderLeftColor: '#f0d060',
    borderBottomColor: colors.bevelDark,
    borderRightColor: colors.bevelDark,
  },
  filterPillIcon: { width: 14, height: 14 },
  filterPillText: { fontFamily: fonts.heading, fontSize: 7, color: colors.textSecondary },
  filterPillTextActive: { color: colors.background },
  // Step 4 — week start
  weekStartOptions: { flex: 1, justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  weekStartCard: { paddingVertical: 24, alignItems: 'center', backgroundColor: colors.surface, ...bevel.raised },
  weekStartCardActive: { backgroundColor: colors.gold, ...bevel.raised },
  weekStartCardLabel: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  weekStartCardLabelActive: { color: colors.background },
  weekStartCardSub: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  weekStartCardSubActive: { color: colors.background },
});
