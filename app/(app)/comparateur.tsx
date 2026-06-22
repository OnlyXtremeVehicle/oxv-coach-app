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
 *
 * Reskin V2 : Screen + AppBar, Segmented (modes), Card/SectionLabel, typo
 * et couleurs @/theme/v2. Logique (sélection, delta, lecture coach) inchangée.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { CircuitTraceHero } from '@/circuit/CircuitTraceHero';
import { type RecentAnalysisRow, listRecentAnalyses } from '@/services/analysesService';
import { useAuthStore } from '@/store/useAuthStore';
import { marginLabelOf, marginZoneOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { Segmented } from '@/ui/Segmented';
import { timeAgoFr } from '@/utils/time';

type Mode = 'immediate' | 'recent' | 'progression';

const MODE_LABELS: Record<Mode, string> = {
  immediate: 'Immédiate',
  recent: 'Récente',
  progression: 'Long terme',
};

const MODES: Mode[] = ['immediate', 'recent', 'progression'];
const MODE_BY_LABEL: Record<string, Mode> = {
  Immédiate: 'immediate',
  Récente: 'recent',
  'Long terme': 'progression',
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
    listRecentAnalyses(profile.id, 100)
      .then((rows) => {
        if (cancelled) return;
        setAnalyses(rows);
        setLoading(false);
        // Pré-sélection : les deux plus récentes
        if (rows.length >= 2) {
          setSelectedA(rows[1].telemetrySessionId);
          setSelectedB(rows[0].telemetrySessionId);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
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
      <Screen scroll={false}>
        <AppBar title="COMPARATEUR" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="COMPARATEUR" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Évolution</Text>

        <View style={{ marginBottom: theme.spacing.xxl }}>
          <Segmented
            options={MODES.map((m) => MODE_LABELS[m])}
            value={MODE_LABELS[mode]}
            onChange={(label) => setMode(MODE_BY_LABEL[label])}
          />
        </View>

        {analyses.length < 2 ? (
          <EmptyState count={analyses.length} />
        ) : (
          <>
            <DeltaPanel a={rowA} b={rowB} />

            {/* Lecture coach (specs v4 §05 §4.3) : où le temps se loge sur le tracé
                (perte de temps par secteur), couche comparative attribuée au coach
                (badge + liseré or). Sur VOS propres tours — aucune comparaison
                inter-pilotes ici, donc pas d'exposition de données d'un tiers. */}
            {selectedA ? (
              <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xl }}>
                <CircuitTraceHero sessionId={selectedA} role="coach" defaultLayer="timeLoss" />
              </View>
            ) : null}

            <SessionPicker
              label="Référence A"
              accent={theme.palette.gold}
              sessions={filtered}
              selectedId={selectedA}
              onSelect={setSelectedA}
            />
            <SessionPicker
              label="Référence B"
              accent={theme.palette.cream}
              sessions={filtered}
              selectedId={selectedB}
              onSelect={setSelectedB}
            />

            <Text style={s.signature}>
              Vos chronos évoluent aussi, mais ce n&apos;est pas l&apos;essentiel.
            </Text>
          </>
        )}
      </View>
    </Screen>
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
    return <Text style={s.deltaHint}>Sélectionnez deux sessions pour comparer.</Text>;
  }
  const deltaMargin = Number(b.marginGlobal) - Number(a.marginGlobal);
  const sign = deltaMargin > 0 ? '+' : '';
  const deltaColor =
    deltaMargin > 1
      ? theme.dataColors.accel
      : deltaMargin < -1
        ? theme.palette.red
        : theme.palette.creamSoft;

  const zoneB = marginZoneOf(Number(b.marginGlobal));

  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
      <SectionLabel>DELTA MARGE</SectionLabel>
      <Text style={[s.deltaValue, { color: deltaColor }]}>
        {sign}
        {Math.round(deltaMargin)}%
      </Text>
      <Text style={s.deltaDetail}>
        Référence A {Math.round(Number(a.marginGlobal))}% (
        {marginLabelOf(marginZoneOf(Number(a.marginGlobal)))}){'\n'}Référence B{' '}
        {Math.round(Number(b.marginGlobal))}% ({marginLabelOf(zoneB)})
      </Text>
    </Card>
  );
}

function SessionPicker({
  label,
  accent,
  sessions,
  selectedId,
  onSelect,
}: {
  label: string;
  accent: string;
  sessions: RecentAnalysisRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ marginBottom: theme.spacing.xl, marginTop: theme.spacing.lg }}>
      <Text style={[s.pickerEyebrow, { color: accent }]}>{label.toUpperCase()}</Text>
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        {sessions.map((session) => {
          const active = selectedId === session.telemetrySessionId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={session.telemetrySessionId}
              onPress={() => onSelect(session.telemetrySessionId)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card
                style={{
                  borderColor: active ? theme.palette.edge : theme.palette.line,
                  backgroundColor: active ? 'rgba(255,255,255,0.07)' : theme.palette.card,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                  <Text style={s.pickName}>{session.circuitName ?? 'Session'}</Text>
                  <Text style={s.pickMeta}>{timeAgoFr(new Date(session.sessionStartedAt))}</Text>
                </View>
                <Text style={s.pickValue}>{Math.round(Number(session.marginGlobal))}%</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.emptyTitle}>Comparer demande deux sessions au moins.</Text>
      <Text style={s.emptyHint}>
        {count === 0 ? 'Aucune session encore.' : '1 session enregistrée.'}
      </Text>
    </Card>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  deltaHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.xl,
  },
  deltaValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.hud,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  deltaDetail: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.small * 1.6,
  },
  signature: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
  },
  pickerEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  pickName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  pickMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  pickValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
};
