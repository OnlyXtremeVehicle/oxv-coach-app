/**
 * Écran #28 — Tour-par-tour (lap-by-lap).
 *
 * Reskin fidèle à la maquette refonte-v2 §7bis (#6a, 19-tour-par-tour.png) :
 *   - Header « Tour par tour ».
 *   - Bandeau récap 2 colonnes : MEILLEUR TOUR (chrono or, inline mono, sans
 *     panneau cockpit) à gauche + MOYENNE (chrono crème, moyenne réelle des
 *     tours valides) à droite.
 *   - Liste plate des tours : « T{n} » à gauche, barre de delta horizontale au
 *     centre (fond line, remplissage proportionnel au delta vs meilleur —
 *     échelle honnête), chrono à droite + écart compact « +0,42 ».
 *   - Ligne du meilleur tour surlignée (fond or translucide + bordure or) avec
 *     tag « meilleur ».
 *   - Outlap/inlap conservés mais marqués distinctement (sortie / rentrée),
 *     sans barre de delta : ils ne se comparent pas au meilleur.
 *
 * Parti A (validé fondateur) : le haut de l'écran est fidèle au PNG ; la
 * substance existante hors-maquette est conservée SOUS la liste (frise de
 * régularité, faisceau des tours, toggle simple/détaillé, retour).
 *
 * Mode DÉTAILLÉ (coach, admin, ou pilote curieux après toggle) : métriques
 * réelles par tour (vitesse max, G) en seconde ligne compacte.
 *
 * Tap sur un tour → ouvre Télémétrie avec ce tour pré-sélectionné.
 * Logique, données, navigation, useDetailLevel + toggle et états inchangés.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { TrackStage } from '@/components/CircuitMap';
import { LapTimeline } from '@/components/LapTimeline';
import { EmptyState as DataEmptyState } from '@/components/instruments';
import { FadeInSection, GrowBar, PressableScale, Stagger, staggerDelay } from '@/components/motion';
import { useDetailLevel } from '@/hooks/useDetailLevel';
import { buildLapTimeline } from '@/services/lapTimelineLogic';
import { fetchSessionLaps } from '@/services/sessionsService';
import { loadLapFrames } from '@/services/sessionTelemetryService';
import type { Lap } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatLapTime } from '@/utils/format';

/** Écart au meilleur tour, compact façon maquette : « +0,42 » (virgule fr). */
function formatDeltaCompact(deltaSeconds: number): string {
  return `+${deltaSeconds.toFixed(2).replace('.', ',')}`;
}

export default function ToursScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { level, toggle, canToggle } = useDetailLevel();

  useEffect(() => {
    if (!params.sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchSessionLaps(params.sessionId)
      .then((rows) => {
        if (cancelled) return;
        setLaps(rows);
        setLoading(false);
      })
      .catch(() => {
        // Erreur de lecture honnête : on la montre plutôt que de l'avaler.
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, reloadKey]);

  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const validLaps = useMemo(() => laps.filter((l) => !l.is_outlap && !l.is_inlap), [laps]);
  const bestLap = useMemo(
    () =>
      validLaps.reduce<Lap | null>(
        (best, l) => (best === null || l.duration_seconds < best.duration_seconds ? l : best),
        null
      ),
    [validLaps]
  );
  // Moyenne RÉELLE des tours valides (outlap/inlap exclus — honnêteté).
  const avgSeconds = useMemo(
    () =>
      validLaps.length > 0
        ? validLaps.reduce((sum, l) => sum + l.duration_seconds, 0) / validLaps.length
        : null,
    [validLaps]
  );
  // Échelle honnête de la barre de delta : le plus grand écart au meilleur
  // tour = barre pleine. Aucun plancher artificiel.
  const maxDeltaSeconds = useMemo(
    () =>
      bestLap
        ? validLaps.reduce(
            (max, l) => Math.max(max, l.duration_seconds - bestLap.duration_seconds),
            0
          )
        : 0,
    [validLaps, bestLap]
  );
  const timeline = useMemo(
    () =>
      buildLapTimeline(
        validLaps.map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
      ),
    [validLaps]
  );

  // État de la liste des tours (SPEC_BUILD §5). L'offline honnête = un échec de
  // lecture, présenté comme reprise ; pas de cache dédié ici (suivi séparé).
  const listState: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : laps.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="Tour par tour" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {/* ——— Bandeau récap (maquette #6a) : meilleur tour OR à gauche,
            moyenne crème à droite. Inline mono, sans panneau cockpit. ——— */}
        {bestLap ? (
          <FadeInSection>
            <View
              accessibilityRole="summary"
              accessibilityLabel={`Meilleur tour : ${formatLapTime(bestLap.duration_seconds)}, tour ${
                bestLap.lap_number
              }. Moyenne des tours valides : ${
                avgSeconds !== null ? formatLapTime(avgSeconds) : 'non disponible'
              }.`}
            >
              <View style={s.recap}>
                <View>
                  <Text style={s.eyebrow}>Meilleur tour</Text>
                  <Text style={s.recapBest}>{formatLapTime(bestLap.duration_seconds)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.eyebrow}>Moyenne</Text>
                  <Text style={s.recapAvg}>
                    {avgSeconds !== null ? formatLapTime(avgSeconds) : '—'}
                  </Text>
                </View>
              </View>
              <Text style={s.recapCaption}>
                Moyenne calculée sur {validLaps.length} tour{validLaps.length > 1 ? 's' : ''} valide
                {validLaps.length > 1 ? 's' : ''}.
              </Text>
            </View>
          </FadeInSection>
        ) : null}

        {/* Toggle simple/détaillé pour les pilotes curieux */}
        {canToggle && validLaps.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginBottom: theme.spacing.xs,
            }}
          >
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ expanded: level === 'detailed' }}
              hitSlop={theme.hitSlop}
              onPress={toggle}
              style={s.toggleHit}
            >
              <Text style={s.toggle}>
                {level === 'simple' ? 'Voir les détails techniques' : 'Vue simplifiée'}
              </Text>
            </PressableScale>
          </View>
        ) : null}

        {/* ——— Liste plate des tours (maquette #6a) ——— */}
        <StateWrapper
          state={listState}
          skeletonLines={4}
          emptyLabel="Aucun tour"
          emptyMessage="Les tours apparaissent dès qu'une session complète a été analysée."
          errorCause="Vos tours n'ont pas pu être chargés."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {/* Cascade d'entrée des lignes (Stagger, plafonnée) ; la barre de
              delta de chaque ligne s'étire juste après son apparition. */}
          <Stagger interval={50} maxDelay={600}>
            {laps.map((lap, i) => (
              <LapRow
                key={lap.id}
                lap={lap}
                isBest={bestLap?.id === lap.id}
                isSelected={selectedLap === lap.lap_number}
                isLast={i === laps.length - 1}
                bestSeconds={bestLap?.duration_seconds ?? null}
                maxDeltaSeconds={maxDeltaSeconds}
                level={level}
                growDelay={staggerDelay(i, { interval: 50, initialDelay: 150, maxDelay: 750 })}
                onPress={() => {
                  if (!params.sessionId) return;
                  router.push({
                    pathname: '/(app)/telemetry',
                    params: {
                      sessionId: params.sessionId,
                      lapNumber: String(lap.lap_number),
                    },
                  } as never);
                }}
              />
            ))}
          </Stagger>
        </StateWrapper>

        {/* ——— Sous la liste (parti A) : la substance existante hors-maquette
            est conservée — rien ne se perd. ——— */}

        {/* Frise de régularité — l'écart de chaque tour au médian. Sort des durées
            de tour (table laps) : lisible AVANT toute frame du boîtier, là où le
            faisceau reste en attente. Au toucher : sélection liée à la liste. */}
        {!loading && validLaps.length >= 2 ? (
          <FadeInSection delay={200}>
            <View style={{ marginTop: theme.spacing.xxl }}>
              <Text style={[s.eyebrow, { marginBottom: theme.spacing.md }]}>
                Régularité, tour par tour
              </Text>
              <LapTimeline
                model={timeline}
                selectedLapNumber={selectedLap}
                onSelect={(n) => setSelectedLap((cur) => (cur === n ? null : n))}
              />
            </View>
          </FadeInSection>
        ) : null}

        {/* Faisceau : tous vos tours valides superposés sur le tracé (mode beam).
            La dispersion des lignes = votre régularité de trajectoire, vue d'en
            haut. Constat spatial, aucun jugement. */}
        {params.sessionId && validLaps.length > 0 ? (
          <FadeInSection delay={280}>
            <View style={{ marginTop: theme.spacing.xxl }}>
              <LapsBeam sessionId={params.sessionId} laps={validLaps} />
            </View>
          </FadeInSection>
        ) : null}

        <View style={{ marginTop: theme.spacing.xxl * 1.5, alignItems: 'center' }}>
          <PressableScale
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={s.backHit}
          >
            <Text style={s.back}>Retour</Text>
          </PressableScale>
        </View>
      </View>
    </Screen>
  );
}

function LapRow({
  lap,
  isBest,
  isSelected,
  isLast,
  bestSeconds,
  maxDeltaSeconds,
  level,
  growDelay,
  onPress,
}: {
  lap: Lap;
  isBest: boolean;
  isSelected?: boolean;
  isLast: boolean;
  bestSeconds: number | null;
  maxDeltaSeconds: number;
  level: 'simple' | 'detailed';
  /** Délai d'étirement de la barre de delta (cascade alignée sur la ligne). */
  growDelay: number;
  onPress: () => void;
}) {
  const isExcluded = lap.is_outlap || lap.is_inlap;
  const delta =
    bestSeconds !== null && !isBest && !isExcluded ? lap.duration_seconds - bestSeconds : null;
  // Remplissage proportionnel au delta vs meilleur — échelle honnête : le plus
  // grand écart = 100 %, delta nul = 0 %. Pas de plancher qui gonflerait.
  const fillPct =
    delta !== null && maxDeltaSeconds > 0
      ? Math.round(Math.min(1, Math.max(0, delta / maxDeltaSeconds)) * 100)
      : 0;

  const noteForA11y = isBest
    ? 'meilleur tour'
    : isExcluded
      ? lap.is_outlap
        ? 'tour de sortie'
        : 'tour de rentrée'
      : delta !== null
        ? `plus ${delta.toFixed(2).replace('.', ',')} seconde${delta >= 2 ? 's' : ''} que le meilleur`
        : '';
  const a11yLabel = `Tour ${lap.lap_number}, ${formatLapTime(lap.duration_seconds)}${
    noteForA11y ? `, ${noteForA11y}` : ''
  }`;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Ouvre la télémétrie de ce tour"
      onPress={onPress}
      style={[
        s.row,
        isBest ? s.rowBest : null,
        !isBest && !isLast ? s.rowSep : null,
        isSelected && !isBest ? { backgroundColor: theme.palette.surface3 } : null,
      ]}
    >
      {/* Voile des tours exclus porté par un conteneur interne : l'opacité
          animée du PressableScale (retour tactile) ne l'écrase pas. */}
      <View style={isExcluded ? { opacity: 0.55 } : null}>
        <View style={s.rowMain}>
          {/* N° de tour réel */}
          <Text style={[s.rowNum, isBest ? s.rowNumBest : null]}>T{lap.lap_number}</Text>

          {/* Barre de delta — décorative ; le delta chiffré porte l'information.
            Elle S'ÉTIRE à l'apparition (GrowBar), cascadée avec sa ligne. */}
          <View
            style={s.track}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {isBest ? (
              // Meilleur tour : delta nul → repère OR à l'origine de l'échelle
              // (pas une valeur ; la maquette porte l'or sur cette ligne).
              <View style={s.originMark} />
            ) : delta !== null ? (
              <GrowBar delay={growDelay} style={[s.fill, { width: `${fillPct}%` }]} />
            ) : null}
          </View>

          {/* Chrono réel */}
          <Text style={[s.rowTime, isBest ? s.rowTimeBest : null]}>
            {formatLapTime(lap.duration_seconds)}
          </Text>

          {/* Écart compact / tag */}
          <Text style={[s.rowDelta, isBest ? s.rowDeltaBest : null]}>
            {isBest
              ? 'meilleur'
              : isExcluded
                ? lap.is_outlap
                  ? 'sortie'
                  : 'rentrée'
                : delta !== null
                  ? formatDeltaCompact(delta)
                  : '—'}
          </Text>
        </View>

        {/* Détails techniques (mode détaillé) — données réelles de la table laps */}
        {level === 'detailed' && !isExcluded ? (
          <View style={s.rowDetails}>
            {lap.max_speed_kmh != null ? (
              <Detail label="Vmax" value={`${Math.round(lap.max_speed_kmh)} km/h`} />
            ) : null}
            {lap.max_g_lateral != null ? (
              <Detail label="G lat" value={lap.max_g_lateral.toFixed(2).replace('.', ',')} />
            ) : null}
            {lap.max_g_braking != null ? (
              <Detail label="Frein" value={lap.max_g_braking.toFixed(2).replace('.', ',')} />
            ) : null}
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text style={s.detail}>
      <Text style={s.detailLabel}>{label} </Text>
      <Text style={s.detailValue}>{value}</Text>
    </Text>
  );
}

/** Point projeté (forme attendue par TrackStage). */
type Pt = { lat: number; lon: number; speed: number };

/** Faisceau de tous les tours valides superposés (mode `beam`). Charge les
 *  frames de chaque tour en parallèle ; on écarte les tours sans position.
 *  Vide tant que telemetry_frames n'est pas alimentée (avant Valence). */
function LapsBeam({ sessionId, laps }: { sessionId: string; laps: Lap[] }) {
  const [beam, setBeam] = useState<Pt[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      laps.map(async (l) => {
        const rows = await loadLapFrames(sessionId, l.lap_number);
        return rows
          .filter((f) => f.lat != null && f.lon != null)
          .map((f) => ({ lat: f.lat as number, lon: f.lon as number, speed: f.speedKmh ?? 0 }));
      })
    )
      .then((all) => {
        if (cancelled) return;
        setBeam(all.filter((t) => t.length >= 2));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, laps]);

  if (loading) {
    return (
      <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
        <ActivityIndicator color={theme.palette.creamMute} />
      </View>
    );
  }

  if (beam.length === 0) {
    return (
      <DataEmptyState
        label="Faisceau en attente"
        message="Vos tours superposés apparaîtront dès vos premières frames réelles."
        source="telemetry_frames"
      />
    );
  }

  return (
    <TrackStage
      mode="beam"
      laps={beam}
      height={300}
      statusLabel={`FAISCEAU · ${beam.length} TOUR${beam.length > 1 ? 'S' : ''}`}
    />
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.monoSemi,
    fontSize: 10, // .eyebrow maquette : mono 600 10px, letter-spacing 1.6
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.eyebrow,
  },
  // Bandeau récap — 2 colonnes en baseline, marge 18 (maquette #6a).
  recap: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-end' as const,
    marginTop: theme.spacing.sm,
  },
  recapBest: {
    fontFamily: theme.fonts.kingMedium,
    fontSize: 26,
    letterSpacing: -0.5,
    color: theme.palette.gold,
    marginTop: 6,
  },
  recapAvg: {
    fontFamily: theme.fonts.kingMedium,
    fontSize: 20,
    color: theme.palette.secondary,
    marginTop: 6,
  },
  // Portée honnête de la moyenne (donnée réelle : tours valides uniquement).
  recapCaption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.micro,
    color: theme.palette.legend,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  // — Liste plate (maquette : ligne 11px de padding, séparateur #17171A) —
  row: {
    minHeight: 44, // cible tactile
    justifyContent: 'center' as const,
    paddingVertical: 11,
  },
  rowMain: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  rowSep: {
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.separator,
  },
  // Meilleur tour surligné : fond or translucide + bordure or, débord latéral
  // léger comme la maquette. #FFB70314 = or de la maquette à ~8 % (brief).
  rowBest: {
    backgroundColor: '#FFB70314', // or translucide (maquette, non tokenisé)
    borderWidth: 1,
    borderColor: theme.palette.gold,
    borderRadius: theme.radius.hud,
    marginHorizontal: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  rowNum: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.micro,
    color: theme.palette.eyebrow,
    width: 30,
  },
  rowNumBest: {
    fontFamily: theme.fonts.monoSemi,
    color: theme.palette.gold,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.borderHair, // fond de barre (#1A1A1D maquette)
    overflow: 'hidden' as const,
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2A2A2E', // remplissage neutre de la maquette (non tokenisé)
  },
  originMark: {
    width: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
  },
  rowTime: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.secondary,
    minWidth: 62,
    textAlign: 'right' as const,
  },
  rowTimeBest: {
    fontFamily: theme.fonts.monoSemi,
    color: theme.palette.gold,
  },
  rowDelta: {
    fontFamily: theme.fonts.mono,
    fontSize: 10, // colonne d'écart compacte (maquette 10px)
    color: theme.palette.eyebrow,
    minWidth: 52,
    textAlign: 'right' as const,
  },
  rowDeltaBest: {
    fontFamily: theme.fonts.monoSemi,
    color: theme.palette.gold,
  },
  rowDetails: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
    paddingLeft: 30 + theme.spacing.md, // aligné sur la colonne de la barre
  },
  toggle: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    textDecorationLine: 'underline' as const,
  },
  // Cible tactile confortable pour le lien-toggle (texte seul).
  toggleHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  detail: {
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
  },
  detailLabel: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.creamMute,
  },
  detailValue: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.creamSoft,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  // Cible tactile confortable pour le lien « Retour » (texte seul).
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
