/**
 * Écran #18 — Comparateur.
 *
 * 3 modes selon l'horizon temporel :
 *   - Évolution immédiate : 2 sessions récentes (< 7 jours)
 *   - Évolution récente   : périodes 7j vs 3 mois
 *   - Progression         : vue long terme (> 3 mois)
 *
 * V1 simplifié : on liste les 10 dernières analyses, on permet d'en
 * sélectionner 2, et on affiche le delta de marge composite + delta
 * chronos. La phrase signature en bas rappelle la doctrine :
 *   "Vos chronos évoluent aussi, mais ce n'est pas l'essentiel."
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { type RecentAnalysisRow, listRecentAnalyses } from '@/services/analysesService';
import { useAuthStore } from '@/store/useAuthStore';
import { marginLabelOf, marginZoneOf } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { timeAgoFr } from '@/utils/time';

type Mode = 'immediate' | 'recent' | 'progression';

const MODE_LABELS: Record<Mode, string> = {
  immediate: 'Immédiate',
  recent: 'Récente',
  progression: 'Long terme',
};

const MODE_WINDOW_DAYS: Record<Mode, number> = {
  immediate: 7,
  recent: 90,
  progression: 9999,
};

export default function ComparateurScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [analyses, setAnalyses] = useState<RecentAnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('immediate');
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    listRecentAnalyses(profile.id, 100).then((rows) => {
      if (cancelled) return;
      setAnalyses(rows);
      setLoading(false);
      // Pré-sélection : les deux plus récentes
      if (rows.length >= 2) {
        setSelectedA(rows[1].telemetrySessionId);
        setSelectedB(rows[0].telemetrySessionId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - MODE_WINDOW_DAYS[mode] * 24 * 60 * 60 * 1000;
    return analyses.filter((a) => new Date(a.sessionStartedAt).getTime() >= cutoff);
  }, [analyses, mode]);

  const rowA = analyses.find((a) => a.telemetrySessionId === selectedA);
  const rowB = analyses.find((a) => a.telemetrySessionId === selectedB);

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>COMPARATEUR</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Évolution
        </Text>

        <ModePicker value={mode} onChange={setMode} />

        {analyses.length < 2 ? (
          <EmptyState count={analyses.length} />
        ) : (
          <>
            <DeltaPanel a={rowA} b={rowB} />
            <SessionPicker
              label="Référence A"
              sessions={filtered}
              selectedId={selectedA}
              onSelect={setSelectedA}
            />
            <SessionPicker
              label="Référence B"
              sessions={filtered}
              selectedId={selectedB}
              onSelect={setSelectedB}
            />

            <Text
              style={[
                typography.caption,
                {
                  color: colors.text.tertiary,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginTop: spacing.xxxl,
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              Vos chronos évoluent aussi, mais ce n'est pas l'essentiel.
            </Text>
          </>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModePicker({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const modes: Mode[] = ['immediate', 'recent', 'progression'];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl }}>
      {modes.map((m) => {
        const active = m === value;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: active ? colors.accent.red : colors.border.subtle,
              backgroundColor: active ? 'rgba(200, 16, 46, 0.10)' : 'transparent',
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: active ? colors.text.primary : colors.text.secondary,
                fontSize: fontSize.caption,
                fontWeight: active ? fontWeight.medium : fontWeight.regular,
              }}
            >
              {MODE_LABELS[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DeltaPanel({
  a,
  b,
}: {
  a: RecentAnalysisRow | undefined;
  b: RecentAnalysisRow | undefined;
}) {
  if (!a || !b) {
    return (
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, marginBottom: spacing.xl, textAlign: 'center' },
        ]}
      >
        Sélectionnez deux sessions pour comparer.
      </Text>
    );
  }
  const deltaMargin = Number(b.marginGlobal) - Number(a.marginGlobal);
  const sign = deltaMargin > 0 ? '+' : '';
  const deltaColor =
    deltaMargin > 1
      ? colors.margin.green
      : deltaMargin < -1
        ? colors.margin.red
        : colors.text.secondary;

  const zoneB = marginZoneOf(Number(b.marginGlobal));

  return (
    <View
      style={{
        padding: spacing.xl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        marginBottom: spacing.xl,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>DELTA MARGE</Text>
      <Text
        style={{
          color: deltaColor,
          fontSize: fontSize.hero,
          fontWeight: fontWeight.ultralight,
          marginBottom: spacing.sm,
        }}
      >
        {sign}
        {Math.round(deltaMargin)}%
      </Text>
      <Text style={[typography.caption, { color: colors.text.secondary, textAlign: 'center' }]}>
        Référence A {Math.round(Number(a.marginGlobal))}% (
        {marginLabelOf(marginZoneOf(Number(a.marginGlobal)))}){'\n'}Référence B{' '}
        {Math.round(Number(b.marginGlobal))}% ({marginLabelOf(zoneB)})
      </Text>
    </View>
  );
}

function SessionPicker({
  label,
  sessions,
  selectedId,
  onSelect,
}: {
  label: string;
  sessions: RecentAnalysisRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.md, color: colors.text.tertiary }]}>
        {label.toUpperCase()}
      </Text>
      <View style={{ gap: spacing.sm }}>
        {sessions.map((s) => {
          const active = selectedId === s.telemetrySessionId;
          return (
            <Pressable
              key={s.telemetrySessionId}
              onPress={() => onSelect(s.telemetrySessionId)}
              style={({ pressed }) => ({
                padding: spacing.md,
                borderRadius: borderRadius.md,
                borderWidth: active ? 1 : 0.5,
                borderColor: active ? colors.accent.red : colors.border.subtle,
                backgroundColor: active ? 'rgba(200, 16, 46, 0.08)' : colors.background.secondary,
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              })}
            >
              <View>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.regular,
                  }}
                >
                  {s.circuitName ?? 'Session'}
                </Text>
                <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                  {timeAgoFr(new Date(s.sessionStartedAt))}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.medium,
                }}
              >
                {Math.round(Number(s.marginGlobal))}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <View
      style={{
        marginTop: spacing.xxxl,
        padding: spacing.xl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.manifest, { textAlign: 'center', marginBottom: spacing.lg }]}>
        Comparer demande deux sessions au moins.
      </Text>
      <Text style={[typography.caption, { color: colors.text.tertiary }]}>
        {count === 0 ? 'Aucune session encore.' : '1 session enregistrée.'}
      </Text>
    </View>
  );
}
