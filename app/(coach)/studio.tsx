/**
 * Coach — Studio télémétrique (P0/VISION_COACH_STUDIO.md).
 *
 * Au retour aux stands, la lecture d'UNE séance pour le coach : le TRIAGE
 * factuel (où regarder), le radar QDI 5 branches, le résumé des marges, les
 * moments-clés. Câblé sur getStudioSession (agrégation déjà en place et testée).
 *
 * Doctrine : des FAITS. Le triage désigne les virages les plus serrés — il ne
 * dit jamais quoi faire (la cause reste au coach, ou à une suggestion IA qu'il
 * valide, C3). QDI en 5 branches, JAMAIS un score composite (garde-fou T6).
 *
 * Skia (build-pending) : la superposition de traces et le diagramme G-G ne
 * tournent pas en Expo Go — ils apparaissent au build natif. Les panneaux de
 * données ci-dessous sont, eux, pleinement lisibles dès maintenant.
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { QdiRadar } from '@/components/QdiRadar';
import { EmptyState } from '@/components/instruments';
import { getStudioSession, type StudioSession } from '@/services/coachStudioService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { KingNumber } from '@/ui/KingNumber';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatLapTime } from '@/utils/format';

const { palette, spacing } = theme;

export default function CoachStudioScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [data, setData] = useState<StudioSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const sessionId = params.sessionId;
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getStudioSession(sessionId)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, reloadKey]);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : !params.sessionId || !data
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="STUDIO" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        <StateWrapper
          state={state}
          skeletonLines={6}
          emptyLabel="Aucune séance"
          emptyMessage="Ouvrez le Studio depuis une séance de votre file de lecture."
          errorCause="La séance n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {data ? <StudioBody data={data} /> : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

function StudioBody({ data }: { data: StudioSession }) {
  return (
    <View>
      {/* Méta séance */}
      <Text style={s.eyebrow}>Séance · 25 Hz</Text>
      <Text style={s.title}>{data.circuitName ?? 'Séance'}</Text>
      <Text style={s.meta}>
        {data.lapCount} tour{data.lapCount > 1 ? 's' : ''}
        {data.bestLapSeconds != null ? ` · meilleur ${formatLapTime(data.bestLapSeconds)}` : ''}
      </Text>

      {/* Mode présentation : la même séance, en vue calme à montrer au pilote. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le mode présentation du débrief"
        hitSlop={8}
        onPress={() =>
          router.push({
            pathname: '/(coach)/debrief',
            params: { sessionId: data.sessionId },
          } as never)
        }
        style={{ marginTop: spacing.md }}
      >
        <Text style={s.triageLink}>Mode présentation ›</Text>
      </Pressable>

      {/* Radar QDI 5 branches — jamais un composite (T6). */}
      <View style={{ marginTop: spacing.xl }}>
        {data.qdi ? (
          <CockpitPanel>
            <Text style={s.panelLabel}>Radar QDI</Text>
            <QdiRadar current={data.qdi} reference={null} detail />
          </CockpitPanel>
        ) : (
          <EmptyState
            label="QDI en préparation"
            message="Les cinq branches apparaîtront après l'analyse de la séance."
          />
        )}
      </View>

      {/* Triage — les virages les plus serrés (fait seul, où regarder). */}
      <View style={[s.triageHead, { marginTop: spacing.xxl }]}>
        <Text style={s.sectionLabel}>À REGARDER EN PREMIER</Text>
        {data.triage.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir le triage sur la carte"
            hitSlop={8}
            onPress={() =>
              router.push({
                pathname: '/(coach)/triage',
                params: { sessionId: data.sessionId },
              } as never)
            }
          >
            <Text style={s.triageLink}>Sur la carte ›</Text>
          </Pressable>
        ) : null}
      </View>
      {data.triage.length === 0 ? (
        <EmptyState
          label="Triage en attente"
          message="Le classement des virages suit l'analyse des marges de la séance."
          source="app_segment_analyses"
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {data.triage.map((c, i) => (
            <Card key={c.segmentIndex} style={s.triageRow}>
              <Text style={s.triageRank}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.triageName}>{c.label}</Text>
                <Text style={s.triageFact}>{c.fact}</Text>
              </View>
              <Text style={s.triageMargin}>{Math.round(c.marginPercent)} %</Text>
            </Card>
          ))}
        </View>
      )}

      {/* Marges (résumé) */}
      {data.margins.global != null ? (
        <View style={{ marginTop: spacing.xxl }}>
          <CockpitPanel plain>
            <Text style={s.panelLabel}>Marge globale de la séance</Text>
            <KingNumber value={`${Math.round(data.margins.global)}`} unit="%" label="Marge" />
          </CockpitPanel>
        </View>
      ) : null}

      {/* Moments-clés */}
      {data.keyMoments.length > 0 ? (
        <>
          <Text style={[s.sectionLabel, { marginTop: spacing.xxl }]}>MOMENTS DE LA SÉANCE</Text>
          <View style={{ gap: spacing.sm }}>
            {data.keyMoments.map((m) => (
              <Card key={m.key}>
                <Text style={s.kmTitle}>{m.title}</Text>
                <Text style={s.kmFact}>{m.fact}</Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {/* Superposition de traces + diagramme G-G = Skia (build natif). */}
      <View style={{ marginTop: spacing.xxl }}>
        <EmptyState
          label="Au build natif"
          message="La superposition des tours et le diagramme G-G s'affichent dans le build de l'application (rendu Skia)."
        />
      </View>
    </View>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  panelLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  triageHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.md,
  },
  triageLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: palette.creamSoft,
  },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  triageRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  triageRank: {
    fontFamily: theme.fonts.king,
    fontSize: 22,
    // Rang/ordre (pas un chrono) → neutre. L'or reste au chrono/record.
    color: palette.creamMute,
    width: 26,
    textAlign: 'center' as const,
  },
  triageName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  triageFact: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
    lineHeight: theme.fontSize.small * 1.4,
  },
  triageMargin: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.h3,
    // Valeur de marge (pas un chrono) → neutre crème ; la marge code sa zone
    // ailleurs (dégradé §7.6), pas via l'or.
    color: palette.cream,
  },
  kmTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },
  kmFact: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
};
