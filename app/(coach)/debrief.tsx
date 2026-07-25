/**
 * Coach — Débrief, MODE PRÉSENTATION, RESPONSIVE DEUX FORMATS (décision fondateur
 * 2026-07-13, handoff §12 · coach/18-debrief + coach-mobile/14-debrief-stand).
 *
 * Une vue CALME, LECTURE SEULE : la lecture d'une séance à montrer au pilote
 * côte à côte (le miroir partagé). Distincte du Studio (atelier dense) — ici, de
 * l'air, UN fait dominant, aucune action d'édition.
 *
 *  - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes fidèles
 *    à la maquette — à gauche l'eyebrow « ce qu'on regarde ensemble » + le fait
 *    dominant + le chiffre roi (marge du virage) ; à droite la trajectoire avec
 *    le virage mis en évidence.
 *  - COMPAGNON téléphone (« au stand ») : une colonne — chiffre roi, lecture, et
 *    une carte pour ouvrir le virage sur la carte. Pas de contrôle d'édition.
 *
 * Doctrine : des FAITS, le vouvoiement, aucune prescription. Le triage désigne le
 * virage le plus serré (la marge la plus fine) et sa zone ; il ne dit jamais quoi
 * faire. La marge se lit sur le dégradé §7.6 (serré→rouge de donnée, moyen→or,
 * large→vert), jamais l'or par défaut — l'or reste au chrono/record. C'est un
 * miroir qu'on regarde ensemble ; les conclusions appartiennent au pilote.
 *
 * Données réelles uniquement : getStudioSession (agrégation testée) + la trace
 * GPS (loadSessionTrajectory) en best-effort. Sans donnée de marge, la lecture
 * s'efface proprement (EmptyState). On n'invente rien.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { CoachPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { EmptyState } from '@/components/instruments';
import {
  biometryQualityOf,
  biometrySourceOf,
  biometryVisible,
  toBiometrySamples,
} from '@/features/miroir/bilanLogic';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { getStudioSession, type StudioSession } from '@/services/coachStudioService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { getSessionBiometry } from '@/services/v2/biometryService';
import { BiometryStrip, type BiometrySource, type BiometryQuality } from '@/ui/v2';
import { marginZoneExportColor, type ZoneLike } from '@/services/marginZoneColorLogic';
import { loadSessionTrajectory } from '@/services/sessionTelemetryService';
import { theme } from '@/theme/v2';
import type { MarginZone } from '@/types/domain';
import { AppBar } from '@/ui/AppBar';
import { KingNumber } from '@/ui/KingNumber';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatLapTimeMs } from '@/utils/format';

const { palette, spacing } = theme;

export default function CoachDebriefScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [data, setData] = useState<StudioSession | null>(null);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Cardio de la séance (BIO-2) — donnée de SANTÉ : la LECTURE est gatée par le
  // drapeau, et la RLS BE-1 arbitre l'accès coach (binôme détaillé + partage
  // consenti). Échec, flag OFF ou absence → section absente, jamais un teasing.
  const [bio, setBio] = useState<{
    samples: { ts: number; hr: number }[];
    source: BiometrySource;
    quality: BiometryQuality | undefined;
  } | null>(null);

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
    // Trace GPS : best-effort, ne conditionne pas l'état de l'écran (la topologie
    // du circuit reste lisible tant que le boîtier n'a pas déposé de trames).
    loadSessionTrajectory(sessionId)
      .then((pts) => {
        if (!cancelled && pts.length > 1) setTrajectory(pts);
      })
      .catch(() => undefined);
    // Cardio : best-effort et FAIL-CLOSED. Drapeau OFF → on ne lit rien. La RLS
    // refuse si le pilote n'a pas consenti le partage coach → section absente.
    setBio(null);
    isFlagEnabled('biometry')
      .then(async (flag) => {
        if (cancelled || !flag) return;
        const rows = await getSessionBiometry(sessionId);
        if (cancelled) return;
        const samples = toBiometrySamples(rows);
        const source = biometrySourceOf(rows);
        if (
          source !== null &&
          biometryVisible({ flagEnabled: flag, captureConsent: true, sampleCount: samples.length })
        ) {
          setBio({ samples, source, quality: biometryQualityOf(rows) });
        }
      })
      .catch(() => undefined);
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
          skeletonLines={5}
          emptyLabel="Aucune séance"
          emptyMessage="Ouvrez le débrief depuis une séance de votre file de lecture."
          errorCause="La séance n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {data ? <DebriefBody data={data} trajectory={trajectory} isConsole={isConsole} /> : null}
          {/* Cardio de la séance — présent SEULEMENT si le pilote l'a partagé
              (drapeau + RLS binôme). Factuel : valeur, source, confiance. Aucune
              zone cible, aucun seuil : le coach juge, l'app ne diagnostique pas. */}
          {data && bio ? (
            <BiometryStrip
              samples={bio.samples}
              source={bio.source}
              quality={bio.quality}
              style={{ marginTop: spacing.xl }}
            />
          ) : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

// ── Lecture dominante dérivée des faits réels ───────────────────────────────

interface Dominant {
  /** Nom du virage (« Virage 3 ») ou libellé de séance. */
  headline: string;
  /** Phrase factuelle et descriptive (jamais une consigne). */
  narrative: string;
  /** Marge mesurée, en %. */
  marginPercent: number;
  /** Zone de marge (couleur du chiffre roi + de la pastille sur la carte). */
  zone: ZoneLike;
  /** Segment mis en évidence sur la carte, ou null (lecture de séance). */
  segmentIndex: number | null;
}

/**
 * Le fait dominant à montrer : le virage le plus serré (marge la plus fine) si le
 * triage l'a désigné, sinon la marge globale de la séance. Rien si aucune marge
 * n'est mesurée (honnêteté — on n'affiche pas de chiffre inventé).
 */
function deriveDominant(data: StudioSession): Dominant | null {
  const top = data.triage[0];
  if (top) {
    return {
      headline: top.label,
      narrative: cornerNarrative(top.label, top.marginZone),
      marginPercent: top.marginPercent,
      zone: top.marginZone,
      segmentIndex: top.segmentIndex,
    };
  }
  if (data.margins.global != null) {
    return {
      headline: 'Lecture de séance',
      narrative: 'La marge globale de cette séance.',
      marginPercent: data.margins.global,
      zone: data.margins.zone,
      segmentIndex: null,
    };
  }
  return null;
}

/** Phrase descriptive d'un virage selon sa zone (vocabulaire du triage). */
function cornerNarrative(label: string, zone: ZoneLike): string {
  if (zone === 'red') return `${label} : le terrain le plus serré mesuré sur la séance.`;
  if (zone === 'yellow') return `${label} : la marge la plus fine, un terrain à explorer.`;
  if (zone === 'green') return `${label} : la marge la plus fine, et elle reste confortable.`;
  return `${label} : la marge la plus fine mesurée sur la séance.`;
}

function DebriefBody({
  data,
  trajectory,
  isConsole,
}: {
  data: StudioSession;
  trajectory: TrajectoryPoint[] | null;
  isConsole: boolean;
}) {
  const dominant = useMemo(() => deriveDominant(data), [data]);

  // Couleur des pastilles de virage = zone de marge du triage (dégradé §7.6).
  // Seules les zones réellement mesurées colorent un virage.
  const zoneByIndex = useMemo(() => {
    const out: Record<number, MarginZone> = {};
    for (const c of data.triage) {
      if (c.marginZone) out[c.segmentIndex] = c.marginZone as MarginZone;
    }
    return out;
  }, [data.triage]);

  const meta = (
    <Text style={s.meta}>
      {data.circuitName ?? 'Séance'} · {data.lapCount} tour{data.lapCount > 1 ? 's' : ''}
      {data.bestLapSeconds != null ? (
        <Text style={s.metaGold}> · meilleur {formatLapTimeMs(data.bestLapSeconds)}</Text>
      ) : null}
    </Text>
  );

  // Aucune marge mesurée : la lecture s'efface proprement, quel que soit le format.
  if (!dominant) {
    return (
      <View>
        <Text style={s.presentEyebrow}>Mode débrief</Text>
        <Text style={s.presentTitle}>À montrer côte à côte</Text>
        <View style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>{meta}</View>
        <EmptyState
          label="Lecture en préparation"
          message="Les repères de marge de cette séance ne sont pas encore disponibles."
          source="app_segment_analyses"
        />
        <MirrorLine />
      </View>
    );
  }

  if (isConsole) {
    // Console : deux colonnes, aérées — à gauche la lecture, à droite la carte.
    return (
      <View>
        <Text style={s.presentEyebrow}>Mode débrief</Text>
        <Text style={s.presentTitle}>À montrer côte à côte</Text>
        <View style={{ marginTop: spacing.sm }}>{meta}</View>

        <View style={s.consoleRow}>
          <View style={s.consoleReadCol}>
            <Text style={s.eyebrow}>Ce qu'on regarde ensemble</Text>
            <Text style={[s.narrative, s.narrativeConsole]}>{dominant.narrative}</Text>
            <View style={{ marginTop: spacing.xl }}>
              <KingNumber
                value={`${Math.round(dominant.marginPercent)}`}
                unit="%"
                label="de marge"
                color={marginZoneExportColor(dominant.zone)}
                size={54}
              />
            </View>
          </View>

          <View style={s.consoleMapCol}>
            <TrackPanel
              trajectory={trajectory}
              zoneByIndex={zoneByIndex}
              selectedIndex={dominant.segmentIndex}
              headline={dominant.headline}
              height={320}
            />
          </View>
        </View>

        <MirrorLine />
      </View>
    );
  }

  // Compagnon téléphone : une colonne, le chiffre roi en tête pour ancrer la lecture.
  return (
    <View style={{ gap: spacing.xl }}>
      <View>
        <Text style={s.presentEyebrow}>Mode débrief</Text>
        {meta}
      </View>

      <View>
        <Text style={s.eyebrow}>Ce qui ressort de votre run</Text>
        <View style={{ marginTop: spacing.md }}>
          <KingNumber
            value={`${Math.round(dominant.marginPercent)}`}
            unit="%"
            label="de marge"
            color={marginZoneExportColor(dominant.zone)}
            size={46}
          />
        </View>
        <Text style={[s.narrative, s.narrativeMobile]}>{dominant.narrative}</Text>
      </View>

      {dominant.segmentIndex != null ? (
        <MapCard sessionId={data.sessionId} headline={dominant.headline} />
      ) : null}

      <MirrorLine />
    </View>
  );
}

// ── Carte : trajectoire réelle, le virage dominant mis en évidence ──────────

function TrackPanel({
  trajectory,
  zoneByIndex,
  selectedIndex,
  headline,
  height,
}: {
  trajectory: TrajectoryPoint[] | null;
  zoneByIndex: Record<number, MarginZone>;
  selectedIndex: number | null;
  headline: string;
  height: number;
}) {
  return (
    <View>
      <CoachPreset
        trajectory={trajectory ?? undefined}
        zoneByIndex={zoneByIndex}
        selectedIndex={selectedIndex}
        height={height}
      />
      {selectedIndex != null ? (
        <Text style={s.mapCaption}>{headline} en évidence</Text>
      ) : (
        <Text style={s.mapCaption}>
          La trace GPS apparaîtra avec les premières trames du boîtier.
        </Text>
      )}
    </View>
  );
}

// ── Carte d'accès (téléphone) : ouvrir le virage sur la carte du triage ─────

function MapCard({ sessionId, headline }: { sessionId: string; headline: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${headline} sur la carte du triage`}
      onPress={() => router.push({ pathname: '/(coach)/triage', params: { sessionId } } as never)}
      style={({ pressed }) => [s.mapCard, pressed ? { opacity: 0.92 } : null]}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.mapCardTitle}>Le virage à regarder ensemble</Text>
        <Text style={s.mapCardName}>{headline}</Text>
      </View>
      <Text style={s.mapCardChevron}>Sur la carte ›</Text>
    </Pressable>
  );
}

function MirrorLine() {
  return (
    <Text style={s.mirror}>
      Un miroir, pas un verdict. La piste est à vous. Les décisions aussi.
    </Text>
  );
}

const s = StyleSheet.create({
  // En-tête présentation
  presentEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  presentTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    marginTop: spacing.sm,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  // Meilleur tour = record → OR (seule donnée dorée autorisée).
  metaGold: {
    color: palette.gold,
  },

  // Colonnes console
  consoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
    marginTop: spacing.xxl * 2,
  },
  consoleReadCol: {
    flex: 1.1,
  },
  consoleMapCol: {
    flex: 1,
  },

  // Lecture dominante
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  narrative: {
    fontFamily: theme.fonts.display,
    color: palette.cream,
  },
  narrativeConsole: {
    fontSize: theme.fontSize.display,
    lineHeight: theme.fontSize.display * 1.25,
    marginTop: spacing.md,
  },
  narrativeMobile: {
    fontSize: theme.fontSize.h3,
    lineHeight: theme.fontSize.h3 * 1.35,
    marginTop: spacing.md,
  },

  // Carte
  mapCaption: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.md,
  },

  // Carte d'accès téléphone
  mapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderLeftColor: palette.coachAccent,
    borderLeftWidth: 2,
    borderRadius: theme.radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  mapCardTitle: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  mapCardName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
    marginTop: 2,
  },
  mapCardChevron: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: palette.creamSoft,
  },

  // Ligne-miroir de clôture
  mirror: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    color: palette.creamSoft,
    textAlign: 'center',
    marginTop: spacing.xxl * 1.5,
    paddingHorizontal: spacing.lg,
    lineHeight: theme.fontSize.bodyLg * 1.6,
  },
});
