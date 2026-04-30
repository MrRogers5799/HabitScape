import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutStackParamList } from '../navigation/WorkoutNavigator';
import { useAuth } from '../context/AuthContext';
import { SetLog, WorkoutSession } from '../types';
import { getTemplateSessionHistory, updateSetLog } from '../services/workoutService';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'WorkoutMetrics'>;
type SessionEntry = { session: WorkoutSession; sets: SetLog[] };

type ProgressPoint = {
  date: Date;
  volume: number;      // Σ(weight × reps) across all sets
  maxWeight: number;   // heaviest single set
  est1RM: number;      // Epley: max(weight × (1 + reps/30))
  isPR: boolean;       // volume exceeds all prior sessions for this exercise
};

type ExerciseProgress = {
  name: string;
  unit: string;
  points: ProgressPoint[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(Math.round(v));
}

function calcEst1RM(sets: SetLog[]): number {
  return Math.round(
    Math.max(
      0,
      ...sets.map(s => {
        if (!s.weight || !s.reps || s.reps <= 0) return 0;
        return s.weight * (1 + s.reps / 30); // Epley formula
      })
    )
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function SparkLine({
  points,
  width,
  height = 64,
}: {
  points: ProgressPoint[];
  width: number;
  height?: number;
}) {
  if (points.length < 1) return null;

  const values = points.map(p => p.volume);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 10;
  const cw = width - pad * 2;
  const ch = height - pad * 2 - 14; // leave 14px room at top for PR labels

  const coords = values.map((v, i) => ({
    x: points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * cw,
    y: pad + 14 + ch - ((v - min) / range) * ch,
  }));

  const d = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');

  return (
    <Svg width={width} height={height}>
      {points.length > 1 && (
        <Path
          d={d}
          stroke={colors.gold}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {coords.map((c, i) => {
        const isLast = i === coords.length - 1;
        const isPR = points[i].isPR;
        return (
          <React.Fragment key={i}>
            {isPR && (
              <SvgText
                x={c.x}
                y={c.y - 9}
                fill={colors.successText}
                fontSize={8}
                fontWeight="bold"
                textAnchor="middle"
              >
                PR
              </SvgText>
            )}
            <Circle
              cx={c.x}
              cy={c.y}
              r={isPR || isLast ? 5 : 3}
              fill={isPR ? colors.successText : isLast ? colors.gold : `${colors.gold}55`}
              stroke={isPR ? colors.success : 'none'}
              strokeWidth={isPR ? 1.5 : 0}
            />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Session card (collapsible + inline set editing) ─────────────────────────

function SessionCard({
  item,
  expanded,
  userId,
  onToggle,
  onSetUpdated,
}: {
  item: SessionEntry;
  expanded: boolean;
  userId: string;
  onToggle: () => void;
  onSetUpdated: (sessionId: string, setId: string, weight: number | null, reps: number | null) => void;
}) {
  const { session, sets } = item;
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [saving, setSaving] = useState(false);

  const grouped: Record<string, SetLog[]> = {};
  for (const s of sets) {
    if (!grouped[s.exerciseName]) grouped[s.exerciseName] = [];
    grouped[s.exerciseName].push(s);
  }
  const exerciseNames = Object.keys(grouped);
  const durationMin = Math.round(
    (session.completedAt!.getTime() - session.startedAt.getTime()) / 60000
  );
  const sessionVolume = sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const unit = sets[0]?.unit ?? 'lbs';

  function startEdit(s: SetLog) {
    setEditingSetId(s.id);
    setEditWeight(s.weight != null ? String(s.weight) : '');
    setEditReps(s.reps != null ? String(s.reps) : '');
  }

  async function confirmEdit(s: SetLog) {
    setSaving(true);
    const weight = editWeight ? parseFloat(editWeight) : null;
    const reps = editReps ? parseInt(editReps, 10) : null;
    try {
      await updateSetLog(userId, session.id, s.id, weight, reps);
      onSetUpdated(session.id, s.id, weight, reps);
      setEditingSetId(null);
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.sessionCard}>
      <Pressable style={styles.sessionCardHeader} onPress={onToggle}>
        <View style={styles.sessionCardMeta}>
          <Text style={styles.sessionDate}>
            {session.completedAt!.toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
          </Text>
          <Text style={styles.sessionSummary}>
            {exerciseNames.length} exercise{exerciseNames.length !== 1 ? 's' : ''}
            {' · '}
            {formatVolume(sessionVolume)} {unit} volume
            {' · '}
            {durationMin}m
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.sessionCardBody}>
          {exerciseNames.map(name => {
            const exSets = grouped[name];
            const exVolume = exSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
            return (
              <View key={name} style={styles.exGroup}>
                <View style={styles.exGroupHeader}>
                  <Text style={styles.exGroupName}>{name}</Text>
                  <Text style={styles.exGroupVolume}>{formatVolume(exVolume)} {exSets[0]?.unit}</Text>
                </View>
                {exSets.map(s => {
                  const isEditing = editingSetId === s.id;
                  return (
                    <View key={s.id} style={[styles.setLogRow, isEditing && styles.setLogRowEditing]}>
                      <Text style={styles.setLogNum}>Set {s.setNumber}</Text>

                      {isEditing ? (
                        <View style={styles.setEditRow}>
                          <TextInput
                            style={styles.setEditInput}
                            value={editWeight}
                            onChangeText={setEditWeight}
                            keyboardType="decimal-pad"
                            placeholder="weight"
                            placeholderTextColor={colors.textMuted}
                            selectTextOnFocus
                            autoFocus
                          />
                          <Text style={styles.setEditLabel}>{s.unit} ×</Text>
                          <TextInput
                            style={styles.setEditInput}
                            value={editReps}
                            onChangeText={setEditReps}
                            keyboardType="number-pad"
                            placeholder="reps"
                            placeholderTextColor={colors.textMuted}
                            selectTextOnFocus
                          />
                          <Text style={styles.setEditLabel}>reps</Text>
                          <TouchableOpacity
                            style={styles.setEditConfirm}
                            onPress={() => confirmEdit(s)}
                            disabled={saving}
                          >
                            {saving
                              ? <ActivityIndicator size="small" color={colors.background} />
                              : <Text style={styles.setEditConfirmText}>✓</Text>
                            }
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.setEditCancel}
                            onPress={() => setEditingSetId(null)}
                            disabled={saving}
                          >
                            <Text style={styles.setEditCancelText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.setLogVal}>
                          {s.weight != null ? `${s.weight} ${s.unit}` : '—'}
                          {' × '}
                          {s.reps != null ? `${s.reps} reps` : '—'}
                          {s.weight && s.reps ? `  =  ${formatVolume(s.weight * s.reps)} ${s.unit}` : ''}
                        </Text>
                      )}

                      {!isEditing && (
                        <TouchableOpacity
                          style={styles.setEditBtn}
                          onPress={() => startEdit(s)}
                        >
                          <Text style={styles.setEditBtnText}>✎</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.uid, templateId]);

  // Build per-exercise progress (oldest → newest for chart)
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
        if (!map.has(name)) map.set(name, { name, unit: exSets[0].unit, points: [] });
        const ep = map.get(name)!;

        const volume = exSets.reduce(
          (sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0),
          0
        );
        const maxWeight = Math.max(0, ...exSets.map(s => s.weight ?? 0));
        const est1RM = calcEst1RM(exSets);
        const prevMaxVolume = ep.points.length > 0
          ? Math.max(...ep.points.map(p => p.volume))
          : -Infinity;
        const isPR = ep.points.length > 0 && volume > prevMaxVolume;

        ep.points.push({ date: session.completedAt!, volume, maxWeight, est1RM, isPR });
      }
    }

    return Array.from(map.values())
      .filter(ep => ep.points.length >= 1)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [history]);

  const historyDesc = useMemo(() => [...history].reverse(), [history]);

  function handleSetUpdated(sessionId: string, setId: string, weight: number | null, reps: number | null) {
    setHistory(prev => prev.map(entry =>
      entry.session.id !== sessionId ? entry : {
        ...entry,
        sets: entry.sets.map(s => s.id === setId ? { ...s, weight, reps } : s),
      }
    ));
  }

  const totalVolume = history.reduce(
    (sum, { sets }) =>
      sum + sets.reduce((s2, s) => s2 + (s.weight ?? 0) * (s.reps ?? 0), 0),
    0
  );
  const unit = history[0]?.sets[0]?.unit ?? 'lbs';
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
                <Text style={styles.statValue}>{formatVolume(totalVolume)}</Text>
                <Text style={styles.statLabel}>total {unit}</Text>
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

            {/* Progress */}
            {exerciseProgress.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Progress</Text>
                {exerciseProgress.map(ep => {
                  const latest = ep.points[ep.points.length - 1];
                  const first = ep.points[0];
                  const volumeDelta = ep.points.length > 1
                    ? latest.volume - first.volume
                    : 0;
                  const prCount = ep.points.filter(p => p.isPR).length;

                  return (
                    <View key={ep.name} style={[styles.progressCard, latest.isPR && styles.progressCardPR]}>
                      {/* Name + volume + delta */}
                      <View style={styles.progressCardHeader}>
                        <Text style={styles.progressExName}>{ep.name}</Text>
                        <View style={styles.progressCardRight}>
                          <Text style={styles.progressVolume}>
                            {formatVolume(latest.volume)} {ep.unit}
                          </Text>
                          {volumeDelta !== 0 && (
                            <Text style={[
                              styles.progressDelta,
                              volumeDelta > 0 ? styles.progressDeltaUp : styles.progressDeltaDown,
                            ]}>
                              {volumeDelta > 0 ? '+' : ''}{formatVolume(volumeDelta)}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Inline secondary stats */}
                      <Text style={styles.progressMeta}>
                        {latest.maxWeight} {ep.unit} max
                        {'  ·  '}
                        Est. 1RM {latest.est1RM} {ep.unit}
                        {prCount > 0 ? `  ·  ${prCount} PR${prCount !== 1 ? 's' : ''}` : ''}
                      </Text>

                      {/* Sparkline */}
                      {ep.points.length >= 2 && (
                        <>
                          <SparkLine points={ep.points} width={chartWidth} />
                          <View style={styles.chartAxisRow}>
                            <Text style={styles.chartAxisLabel}>
                              {first.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </Text>
                            <Text style={styles.chartAxisLabelCenter}>volume ({ep.unit})</Text>
                            <Text style={styles.chartAxisLabel}>
                              {latest.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
                <View style={styles.sectionSpacer} />
              </>
            )}

            {/* Session history */}
            <Text style={styles.sectionTitle}>Session History</Text>
            {historyDesc.map((item, i) => (
              <SessionCard
                key={item.session.id}
                item={item}
                expanded={expandedIdx === i}
                userId={user!.uid}
                onToggle={() => setExpandedIdx(prev => (prev === i ? null : i))}
                onSetUpdated={handleSetUpdated}
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    ...bevel.raised,
  },
  backBtn: { paddingRight: 12, paddingVertical: 4 },
  backBtnText: { fontFamily: fonts.display, fontSize: 28, color: colors.gold, lineHeight: 30 },
  headerTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 13, color: colors.gold },
  headerSpacer: { width: 40 },

  // Scroll
  scroll: { paddingHorizontal: 12, paddingBottom: 32, paddingTop: 12 },

  // Actions
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

  // Empty
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
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.gold },
  statLabel: { fontFamily: fonts.display, fontSize: 12, color: colors.textMuted },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Progress cards — one per exercise, standard surface
  progressCard: {
    backgroundColor: colors.surface,
    ...bevel.raised,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    marginBottom: 6,
  },
  progressCardPR: {
    borderTopColor: colors.gold,
    borderLeftColor: colors.gold,
    borderBottomColor: colors.goldDark,
    borderRightColor: colors.goldDark,
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  progressExName: { fontFamily: fonts.display, fontSize: 16, color: colors.textPrimary, flex: 1 },
  progressCardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressVolume: { fontFamily: fonts.display, fontSize: 14, color: colors.gold },
  progressDelta: { fontFamily: fonts.display, fontSize: 12 },
  progressDeltaUp: { color: colors.successText },
  progressDeltaDown: { color: colors.error },
  progressMeta: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },

  // Chart axis
  chartAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  chartAxisLabel: { fontFamily: fonts.display, fontSize: 11, color: colors.textMuted },
  chartAxisLabelCenter: { fontFamily: fonts.display, fontSize: 10, color: colors.textDisabled },
  sectionSpacer: { height: 10 },

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

  // Session body
  sessionCardBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  exGroup: { marginBottom: 12 },
  exGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exGroupName: { fontFamily: fonts.display, fontSize: 14, color: colors.gold },
  exGroupVolume: { fontFamily: fonts.display, fontSize: 13, color: colors.textMuted },
  setLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 6,
  },
  setLogRowEditing: {
    backgroundColor: colors.background,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  setLogNum: { fontFamily: fonts.display, fontSize: 13, color: colors.textMuted, width: 48 },
  setLogVal: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary, flex: 1 },

  // Inline edit row
  setEditRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  setEditInput: {
    width: 56,
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
    ...bevel.inset,
  },
  setEditLabel: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary },
  setEditConfirm: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.success,
    ...bevel.green,
  },
  setEditConfirmText: { fontFamily: fonts.display, fontSize: 14, color: colors.successText },
  setEditCancel: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${colors.destructive}55`,
    ...bevel.inset,
  },
  setEditCancelText: { fontFamily: fonts.display, fontSize: 14, color: colors.textPrimary },
  setEditBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  setEditBtnText: { fontFamily: fonts.display, fontSize: 14, color: colors.textMuted },
});
