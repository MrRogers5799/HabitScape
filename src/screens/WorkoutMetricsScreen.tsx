import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutStackParamList } from '../navigation/WorkoutNavigator';
import { useAuth } from '../context/AuthContext';
import { SetLog, WorkoutSession } from '../types';
import { getTemplateSessionHistory } from '../services/workoutService';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'WorkoutMetrics'>;
type SessionEntry = { session: WorkoutSession; sets: SetLog[] };

type ExerciseProgress = {
  name: string;
  unit: string;
  points: Array<{ date: Date; maxWeight: number }>;
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

function SparkLine({ values, width, height = 60 }: { values: number[]; width: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 8;
  const cw = width - pad * 2;
  const ch = height - pad * 2;
  const xStep = cw / (values.length - 1);

  const pts = values.map((v, i) => ({
    x: pad + i * xStep,
    y: pad + ch - ((v - min) / range) * ch,
  }));

  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Path
        d={d}
        stroke={colors.gold}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === pts.length - 1 ? 4 : 2.5}
          fill={i === pts.length - 1 ? colors.gold : `${colors.gold}77`}
        />
      ))}
    </Svg>
  );
}

// ─── Session card (collapsible) ───────────────────────────────────────────────

function SessionCard({
  item,
  expanded,
  onToggle,
}: {
  item: SessionEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { session, sets } = item;
  const grouped: Record<string, SetLog[]> = {};
  for (const s of sets) {
    if (!grouped[s.exerciseName]) grouped[s.exerciseName] = [];
    grouped[s.exerciseName].push(s);
  }
  const exerciseNames = Object.keys(grouped);
  const durationMin = Math.round(
    (session.completedAt!.getTime() - session.startedAt.getTime()) / 60000
  );

  return (
    <View style={styles.sessionCard}>
      <Pressable style={styles.sessionCardHeader} onPress={onToggle}>
        <View style={styles.sessionCardMeta}>
          <Text style={styles.sessionDate}>
            {session.completedAt!.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          <Text style={styles.sessionSummary}>
            {exerciseNames.length} exercise{exerciseNames.length !== 1 ? 's' : ''} · {sets.length} set{sets.length !== 1 ? 's' : ''} · {durationMin}m
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.sessionCardBody}>
          {exerciseNames.map(name => (
            <View key={name} style={styles.exGroup}>
              <Text style={styles.exGroupName}>{name}</Text>
              {grouped[name].map(s => (
                <View key={s.id} style={styles.setLogRow}>
                  <Text style={styles.setLogNum}>Set {s.setNumber}</Text>
                  <Text style={styles.setLogVal}>
                    {s.weight != null ? `${s.weight} ${s.unit}` : '—'}
                    {' × '}
                    {s.reps != null ? `${s.reps} reps` : '—'}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function WorkoutMetricsScreen({ route, navigation }: Props) {
  const { templateId, templateName } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<SessionEntry[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    getTemplateSessionHistory(user.uid, templateId)
      .then(h => setHistory(h))
      .finally(() => setLoading(false));
  }, []);

  // Per-exercise progress points (oldest → newest for charts)
  const exerciseProgress = useMemo<ExerciseProgress[]>(() => {
    const map = new Map<string, ExerciseProgress>();
    for (const { session, sets } of history) {
      if (!session.completedAt) continue;
      const byEx: Record<string, SetLog[]> = {};
      for (const s of sets) {
        if (!byEx[s.exerciseName]) byEx[s.exerciseName] = [];
        byEx[s.exerciseName].push(s);
      }
      for (const [name, exSets] of Object.entries(byEx)) {
        const weights = exSets.map(s => s.weight ?? 0).filter(w => w > 0);
        if (weights.length === 0) continue;
        if (!map.has(name)) map.set(name, { name, unit: exSets[0].unit, points: [] });
        map.get(name)!.points.push({
          date: session.completedAt!,
          maxWeight: Math.max(...weights),
        });
      }
    }
    return Array.from(map.values())
      .filter(ep => ep.points.length >= 2)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [history]);

  // Newest-first for history list
  const historyDesc = useMemo(() => [...history].reverse(), [history]);

  const totalSets = history.reduce((acc, { sets }) => acc + sets.length, 0);
  // 24px horizontal screen padding × 2 + 12px card padding × 2
  const chartWidth = screenWidth - 72;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{templateName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => navigation.push('ActiveSession', { templateId, templateName })}
          >
            <Text style={styles.startBtnText}>▶  Start Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => navigation.push('TemplateDetail', { templateId, templateName })}
          >
            <Text style={styles.manageBtnText}>✎  Exercises</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySubtext}>
              Complete a workout to see your progress here.
            </Text>
          </View>
        ) : (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{history.length}</Text>
                <Text style={styles.statLabel}>sessions</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{totalSets}</Text>
                <Text style={styles.statLabel}>total sets</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statValue}>
                  {historyDesc[0].session.completedAt!.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.statLabel}>last session</Text>
              </View>
            </View>

            {/* Progress charts — OSRS green quest panel, only shown with ≥ 2 sessions per exercise */}
            {exerciseProgress.length > 0 && (
              <View style={styles.progressSection}>
                <Text style={styles.progressSectionTitle}>Progress</Text>
                {exerciseProgress.map(ep => {
                  const latest = ep.points[ep.points.length - 1];
                  const first = ep.points[0];
                  const delta = latest.maxWeight - first.maxWeight;
                  return (
                    <View key={ep.name} style={styles.progressCard}>
                      <View style={styles.progressCardHeader}>
                        <Text style={styles.progressExName}>{ep.name}</Text>
                        <View style={styles.progressLatestGroup}>
                          <Text style={styles.progressLatestWeight}>
                            {latest.maxWeight} {ep.unit}
                          </Text>
                          {delta !== 0 && (
                            <Text style={[styles.progressDelta, delta > 0 ? styles.progressDeltaUp : styles.progressDeltaDown]}>
                              {delta > 0 ? `+${delta}` : delta}
                            </Text>
                          )}
                        </View>
                      </View>
                      <SparkLine values={ep.points.map(p => p.maxWeight)} width={chartWidth} />
                      <View style={styles.chartAxisRow}>
                        <Text style={styles.chartAxisLabel}>
                          {first.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </Text>
                        <Text style={styles.chartAxisLabel}>
                          {latest.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Session history */}
            <Text style={styles.sectionTitle}>Session History</Text>
            {historyDesc.map((item, i) => (
              <SessionCard
                key={item.session.id}
                item={item}
                expanded={expandedIdx === i}
                onToggle={() => setExpandedIdx(prev => (prev === i ? null : i))}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  backBtn: { paddingRight: 12, paddingVertical: 4 },
  backBtnText: { fontFamily: fonts.display, fontSize: 28, color: colors.gold, lineHeight: 30 },
  headerTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 13, color: colors.gold },
  headerSpacer: { width: 40 },

  // Scroll
  scroll: { paddingHorizontal: 12, paddingBottom: 32, paddingTop: 12 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  startBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.gold,
    ...bevel.raised,
  },
  startBtnText: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.background },
  manageBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  manageBtnText: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.textSecondary },
  emptySubtext: { fontFamily: fonts.display, fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    ...bevel.raised,
    marginBottom: 16,
    paddingVertical: 12,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.gold },
  statLabel: { fontFamily: fonts.display, fontSize: 12, color: colors.textMuted },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Progress section — OSRS green quest-panel style
  progressSection: {
    backgroundColor: colors.successSurface,
    ...bevel.green,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 16,
  },
  progressSectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.successText,
    marginBottom: 10,
  },
  progressCard: {
    marginBottom: 14,
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressExName: { fontFamily: fonts.display, fontSize: 15, color: colors.successText, flex: 1 },
  progressLatestGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressLatestWeight: { fontFamily: fonts.display, fontSize: 15, color: colors.gold },
  progressDelta: { fontFamily: fonts.display, fontSize: 13 },
  progressDeltaUp: { color: colors.successText },
  progressDeltaDown: { color: colors.error },
  chartAxisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  chartAxisLabel: { fontFamily: fonts.display, fontSize: 11, color: `${colors.successText}88` },

  // Section title
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.gold,
    marginBottom: 8,
  },

  // Session card
  sessionCard: {
    backgroundColor: colors.surface,
    marginBottom: 8,
    ...bevel.raised,
    overflow: 'hidden',
  },
  sessionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sessionCardMeta: { flex: 1 },
  sessionDate: { fontFamily: fonts.display, fontSize: 17, color: colors.textPrimary },
  sessionSummary: { fontFamily: fonts.display, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontFamily: fonts.display, fontSize: 11, color: colors.textMuted, marginLeft: 8 },

  // Session card body
  sessionCardBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  exGroup: { marginBottom: 10 },
  exGroupName: { fontFamily: fonts.display, fontSize: 14, color: colors.gold, marginBottom: 4 },
  setLogRow: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  setLogNum: { fontFamily: fonts.display, fontSize: 13, color: colors.textMuted, width: 48 },
  setLogVal: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary },
});
