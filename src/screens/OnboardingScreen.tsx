import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { SKILL_COLORS } from '../constants/osrsSkills';
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
      {[1, 2, 3].map(n => (
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
}: {
  displayName: string;
  onChange: (v: string) => void;
  onNext: () => void;
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
      </View>

      <View style={styles.footer}>
        <StepDots step={1} />
        <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
          <Text style={styles.primaryButtonText}>Next  →</Text>
        </TouchableOpacity>
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

  const sections = useMemo(() => {
    const q = search.toLowerCase();
    const bySkill: Record<string, ActivityTemplate[]> = {};

    for (const t of ACTIVITY_TEMPLATES) {
      if (q && !t.activityName.toLowerCase().includes(q) && !t.skillId.toLowerCase().includes(q)) {
        continue;
      }
      if (!bySkill[t.skillId]) bySkill[t.skillId] = [];
      bySkill[t.skillId].push(t);
    }

    return Object.entries(bySkill)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([skillId, data]) => ({ title: skillId, data }));
  }, [search]);

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

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => {
          const c = SKILL_COLORS[section.title] ?? colors.gold;
          return (
            <View style={[styles.sectionHeader, { borderLeftColor: c }]}>
              <Text style={[styles.sectionHeaderText, { color: c }]}>{section.title}</Text>
            </View>
          );
        }}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          const skillColor = SKILL_COLORS[item.skillId] ?? colors.gold;
          return (
            <Pressable
              style={[styles.activityRow, isSelected && styles.activityRowSelected]}
              onPress={() => onToggle(item.id)}
            >
              <View style={[styles.activityCheckbox, isSelected && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.activityRowInfo}>
                <Text style={[styles.activityRowName, isSelected && { color: colors.gold }]}>
                  {item.activityName}
                </Text>
                <Text style={styles.activityRowDesc} numberOfLines={1}>{item.description}</Text>
              </View>
              <View style={[styles.skillPill, { backgroundColor: `${skillColor}22`, borderColor: `${skillColor}66` }]}>
                <Text style={[styles.skillPillText, { color: skillColor }]}>{item.skillId}</Text>
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.sectionListContent}
      />

      <View style={styles.footer}>
        <StepDots step={2} />
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
      </View>
    </View>
  );
}

// ─── Step 3: Cadence picker ───────────────────────────────────────────────────

function Step3({
  selected,
  cadences,
  onCadenceChange,
  onFinish,
  onBack,
  saving,
}: {
  selected: Set<string>;
  cadences: Record<string, Cadence>;
  onCadenceChange: (templateId: string, cadence: Cadence) => void;
  onFinish: () => void;
  onBack: () => void;
  saving: boolean;
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
        <StepDots step={3} />
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
      </View>
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const { user, completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cadences, setCadences] = useState<Record<string, Cadence>>({});
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
      await completeOnboarding(displayName, activities);
      // RootNavigator re-renders automatically once user.profileComplete flips to true
    } catch (err) {
      setSaving(false);
      Alert.alert('Something went wrong', 'Could not save your setup. Please try again.');
    }
  }

  return (
    <View style={styles.container}>
      {step === 1 && (
        <Step1
          displayName={displayName}
          onChange={setDisplayName}
          onNext={() => setStep(2)}
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
          onFinish={handleFinish}
          onBack={() => setStep(2)}
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

  // Step shell
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    paddingHorizontal: 20,
    paddingTop: 56,
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
    paddingTop: 72,
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
    marginTop: 4,
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
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderLeftWidth: 3,
    marginTop: 4,
  },
  sectionHeaderText: {
    fontFamily: fonts.heading,
    fontSize: 9,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  activityRowSelected: {
    backgroundColor: `${colors.gold}18`,
    borderColor: `${colors.gold}55`,
  },
  activityCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    marginRight: 12,
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
    marginRight: 8,
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
  skillPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 2,
  },
  skillPillText: {
    fontFamily: fonts.display,
    fontSize: 13,
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
    marginTop: 10,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
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
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    ...bevel.inset,
  },
  backButtonText: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.textSecondary,
  },
});
