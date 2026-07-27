/**
 * TrophyCard — la « carte trophée de partage » (maquette
 * docs/refonte-app/maquette_partage_refondu.html, archétype 12).
 *
 * Seul objet OXV pensé pour être vu HORS de l'app (story, post). Grammaire
 * stricte : un logotype, un chiffre dominant, un tracé, une signature. Format
 * 4:5, capturable en image (forwardRef sur le View racine → react-native-view-shot).
 *
 * Le tracé réutilise la même géométrie que le héros du bilan (centerline RÉELLE
 * du circuit de la séance) mais rendu STATIQUE en polyline SVG : un tracé animé
 * ne se capture pas. Géométrie absente → AUCUN
 * tracé (jamais la silhouette de substitution d'un autre circuit — cette carte
 * est publique et « données réelles » l'emporte sur « jamais vide »).
 *
 * Doctrine / code couleur : le meilleur tour est un FAIT (pas un classement,
 * pas de « mieux que »). gold = l'or du chrono/record — libellé, tracé ET le
 * chiffre roi (canon : l'or est réservé au chrono/record). L'or Heritage
 * (#C4A459) reste réservé aux membres Heritage — JAMAIS ici. red = la marque
 * (le X) ; cream = le texte neutre. Aucune formulation prescriptive.
 */

import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';

import { type Circuit, generateCircuit, type LatLon } from '@/circuit/circuitGenerator';
import { ExportWatermark } from '@/components/ExportWatermark';
import { theme } from '@/theme/v2';

const TRACE_VIEWBOX = 240;
const TRACE_PADDING = 20;

export interface TrophyCardProps {
  /** Chrono dominant déjà formaté, p. ex. « 1'47.60 ». */
  bestLapLabel: string;
  /** Nom du circuit (héros, sous le chiffre). */
  circuitName: string;
  /** Date de la séance, déjà formatée (eyebrow haut-droite). */
  dateLabel: string;
  /** Ligne méta du héros, p. ex. « Tracé Beltoise · 42 tours ». */
  subLabel: string;
  /** Géométrie RÉELLE du tracé (centerline lat/lon) de la séance. Absente →
   *  aucun tracé rendu ; JAMAIS la silhouette de substitution d'un autre circuit. */
  tracePoints?: LatLon[] | null;
}

/**
 * Projette la centerline d'un circuit en points SVG normalisés dans un carré
 * `TRACE_VIEWBOX`, centrés et mis à l'échelle (aspect préservé). Renvoie la
 * chaîne `points` d'une <Polyline> + le premier point (repère ligne de départ).
 */
function buildTracePolyline(circuit: Circuit): { points: string; start: [number, number] } | null {
  const cl = circuit.centerline;
  if (cl.length < 2) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of cl) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const inner = TRACE_VIEWBOX - TRACE_PADDING * 2;
  const scale = Math.min(inner / spanX, inner / spanY);
  // Centre le tracé dans le viewBox ; y inversé (SVG descend, le plan monte).
  const offsetX = (TRACE_VIEWBOX - spanX * scale) / 2;
  const offsetY = (TRACE_VIEWBOX - spanY * scale) / 2;
  const project = (p: { x: number; y: number }): [number, number] => [
    offsetX + (p.x - minX) * scale,
    TRACE_VIEWBOX - (offsetY + (p.y - minY) * scale),
  ];

  const projected = cl.map(project);
  if (circuit.closed && projected.length > 0) projected.push(projected[0]);
  const points = projected.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return { points, start: projected[0] };
}

/**
 * Fond ambré chaud de la carte : halo or centré haut-droite (#31280C → #161610),
 * peint en SVG absolu DERRIÈRE le contenu pour être capturé par
 * react-native-view-shot (maquette 36-carte-trophee : carte chaude, halo or —
 * pas d'aplat noir froid).
 */
function CardBackground() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="trophyHalo" cx="78%" cy="12%" r="95%">
          <Stop offset="0" stopColor="#31280C" stopOpacity="1" />
          <Stop offset="1" stopColor="#161610" stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#trophyHalo)" />
    </Svg>
  );
}

export const TrophyCard = forwardRef<View, TrophyCardProps>(function TrophyCard(
  { bestLapLabel, circuitName, dateLabel, subLabel, tracePoints },
  ref
) {
  // Données réelles : le tracé n'est rendu QUE si la géométrie RÉELLE du circuit
  // de la séance est fournie. Aucune silhouette de substitution — le repli Haute
  // Saintonge historique peignait le tracé d'un AUTRE circuit sous le chrono, ce
  // qui, sur l'objet le plus PUBLIC d'OXV, viole « données réelles ». Absente →
  // le tracé disparaît (la carte reste légitime : chrono, circuit et date réels).
  const trace = useMemo(() => {
    if (!tracePoints || tracePoints.length <= 3) return null;
    return buildTracePolyline(generateCircuit(tracePoints));
  }, [tracePoints]);

  return (
    <View ref={ref} style={s.card} collapsable={false}>
      <CardBackground />
      <View style={s.top}>
        <Text style={s.logo}>
          O<Text style={s.logoX}>X</Text>V
        </Text>
        <Text style={s.eyebrow}>{dateLabel.toUpperCase()}</Text>
      </View>

      <View style={s.traceWrap}>
        {trace ? (
          <Svg
            width="78%"
            height="100%"
            viewBox={`0 0 ${TRACE_VIEWBOX} ${TRACE_VIEWBOX}`}
            accessibilityLabel="Tracé du circuit"
          >
            <Polyline
              points={trace.points}
              fill="none"
              stroke={theme.palette.gold}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={trace.start[0]} cy={trace.start[1]} r={3} fill={theme.palette.cream} />
          </Svg>
        ) : null}
      </View>

      <View style={s.hero}>
        <Text style={s.heroLabel}>{`MEILLEUR TOUR · ${circuitName.toUpperCase()}`}</Text>
        <Text style={s.heroValue}>{bestLapLabel}</Text>
        <Text style={s.heroSub}>{subLabel}</Text>
      </View>

      {/* Signature + méthode, gravées dans l'image (voyagent avec le partage). */}
      <ExportWatermark />
    </View>
  );
});

const s = StyleSheet.create({
  // 4:5 — la carte partageable. Fond sombre proche du radial de la maquette,
  // filet de bordure discret.
  card: {
    aspectRatio: 4 / 5,
    width: '100%',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#242428',
    backgroundColor: '#161610',
    paddingHorizontal: 24,
    paddingVertical: 26,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 22,
    letterSpacing: -1,
    color: theme.palette.cream,
  },
  logoX: { color: theme.palette.red },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.7,
    lineHeight: 15,
    textAlign: 'right',
    color: theme.palette.faint,
    paddingTop: 4,
  },
  traceWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.sm,
  },
  hero: { alignItems: 'center' },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.9,
    color: theme.palette.gold,
    marginBottom: theme.spacing.sm,
  },
  heroValue: {
    fontFamily: theme.fonts.mono,
    fontSize: 46,
    letterSpacing: -0.5,
    lineHeight: 48,
    color: theme.palette.gold,
  },
  heroSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginTop: 3,
  },
});
