/**
 * Coach — Débrief, MODE PRÉSENTATION. Réintégration coach__debrief.
 *
 * Une vue calme, épurée, LECTURE SEULE : la synthèse d'une séance à montrer au
 * pilote côte à côte (le miroir partagé). Distincte du Studio (outil dense de
 * travail) — ici, de l'air, de grands repères, aucune action d'édition. Réutilise
 * getStudioSession (QDI 5 branches + faits + moments), présenté autrement.
 *
 * Doctrine : des FAITS, le vouvoiement, aucune prescription. QDI en 5 branches
 * (jamais un composite, T6). C'est un miroir qu'on regarde ensemble — les
 * conclusions appartiennent au pilote. SVG (QdiRadar), pas Skia.
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { QdiRadar } from '@/components/QdiRadar';
import { EmptyState } from '@/components/instruments';
import { type StudioSession, getStudioSession } from '@/services/coachStudioService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { KingNumber } from '@/ui/KingNumber';
import { marginZoneExportColor } from '@/services/marginZoneColorLogic';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatLapTime } from '@/utils/format';

const { palette, spacing } = theme;

export default function CoachDebriefScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;

  const [data, setData] = useState<StudioSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getStudioSession(sessionId)
      .then((s) => {
        if (!cancelled) {
          setData(s);
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
  }, [sessionId, reloadKey]);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : !sessionId || !data
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="DÉBRIEF" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.lg }}>
          <RoleBadge role="coach" />
        </View>

        <StateWrapper
          state={state}
          skeletonLines={6}
          emptyLabel="Aucune séance"
          emptyMessage="Ouvrez le débrief depuis une séance de votre file de lecture."
          errorCause="La séance n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {data ? <DebriefBody data={data} /> : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

function DebriefBody({ data }: { data: StudioSession }) {
  return (
    <View>
      {/* En-tête présentation : grand titre calme. */}
      <Text style={s.eyebrow}>Votre séance</Text>
      <Text style={s.heroTitle}>{data.circuitName ?? 'Séance'}</Text>
      <Text style={s.heroSub}>
        {data.lapCount} tour{data.lapCount > 1 ? 's' : ''}
        {data.bestLapSeconds != null ? ` · meilleur ${formatLapTime(data.bestLapSeconds)}` : ''}
      </Text>

      {/* QDI radar — le repère central, en grand. */}
      <View style={{ marginTop: spacing.xxl }}>
        {data.qdi ? (
          <CockpitPanel>
            <Text style={s.panelLabel}>Votre empreinte · 5 branches</Text>
            <QdiRadar current={data.qdi} reference={null} detail />
          </CockpitPanel>
        ) : (
          <EmptyState
            label="QDI en préparation"
            message="Les cinq branches apparaîtront après l'analyse de la séance."
          />
        )}
      </View>

      {/* Marge globale, en grand chiffre calme. */}
      {data.margins.global != null ? (
        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <Text style={s.eyebrowCentered}>Marge de la séance</Text>
          {/* Marge = dégradé §7.6 selon la zone, pas l'or par défaut. */}
          <KingNumber
            value={`${Math.round(data.margins.global)}`}
            unit="%"
            label="Marge"
            color={marginZoneExportColor(data.margins.zone)}
          />
        </View>
      ) : null}

      {/* Moments de la séance — calmes, un par ligne. */}
      {data.keyMoments.length > 0 ? (
        <View style={{ marginTop: spacing.xxl }}>
          <Text style={s.eyebrow}>Ce qui s'est passé</Text>
          <View style={{ marginTop: spacing.md, gap: spacing.lg }}>
            {data.keyMoments.map((m) => (
              <View key={m.key}>
                <Text style={s.momentTitle}>{m.title}</Text>
                <Text style={s.momentFact}>{m.fact}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Ligne-miroir de clôture (éditorial serif). */}
      <Text style={s.mirror}>
        Un miroir, pas un verdict. La piste est à vous. Les décisions aussi.
      </Text>
    </View>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  eyebrowCentered: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontFamily: theme.fonts.serif,
    fontSize: theme.fontSize.serifTitle,
    color: palette.cream,
    lineHeight: theme.fontSize.serifTitle,
    marginTop: spacing.sm,
  },
  heroSub: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  panelLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  momentTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  momentFact: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    color: palette.creamSoft,
    marginTop: spacing.xs,
    lineHeight: theme.fontSize.bodyLg * 1.5,
  },
  mirror: {
    fontFamily: theme.fonts.serifItalic,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: palette.creamSoft,
    textAlign: 'center' as const,
    marginTop: spacing.xxl * 1.5,
    paddingHorizontal: spacing.lg,
    lineHeight: theme.fontSize.bodyLg * 1.6,
  },
};
