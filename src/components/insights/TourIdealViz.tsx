/**
 * TourIdealViz — Potentiel démontré (lecture N3.2, fiche M10 du cahier de veille).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N3-2_tour_ideal.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §3.2.
 *
 * DONNÉES : alimenté par le bloc `ideal_lap` (IdealLap) de session_insights.
 * Aucune valeur figée. Si `ideal` est absent (ou chronos non calculés), un état
 * vide sobre s'affiche — jamais de chiffre inventé.
 *
 * ---
 *
 * CE QUE CET ÉCRAN DISAIT, ET CE QUE LA CHAÎNE FAIT — audit M10 du 26/08/2026.
 *
 * L'en-tête de ce fichier annonçait : « assemble le meilleur micro-secteur de
 * chaque tour en un tour théorique ». La barre de statut l'écrivait au pilote,
 * en capitales : « MICRO-SECTEURS ».
 *
 * Aucun des deux moteurs qui remplissent ce bloc ne fait cela.
 *   • `supabase/functions/compute-session-insights-v3` écrit le meilleur tour
 *     RÉEL de la journée, avec `gap_s: 0` et `sector_sources: []`.
 *   • `src/services/sessionInsightsEngine.ts` fait de même, et le dit.
 * La seule fonction du dépôt qui assemble vraiment des micro-secteurs —
 * `idealLapTime` (src/telemetry/delta.ts) — n'a aucun appelant de production.
 *
 * Le mot promettait donc une composition que personne n'exécute. Il est retiré.
 *
 * Le cahier de veille (§03 « Tour optimal réaliste », fiche M10) demande par
 * ailleurs l'inverse de cet assemblage : des BLOCS COMPLETS entrée–virage–sortie
 * dont la continuité vitesse / position / accélération est vérifiée à chaque
 * jonction. Cette vérification est hors de portée d'ici : `IdealLap` ne porte
 * ni la source de chaque morceau ni l'état des jonctions. Tant que la donnée
 * n'existe pas, cet écran ne prétend rien sur les jonctions.
 *
 * NOTE : la barre de provenance des micro-secteurs (maquette N3-2) exigeait la
 * source (n° de tour) de chaque secteur, absente d'IdealLap. Elle est retirée
 * plutôt que fabriquée (doctrine « données réelles câblées »).
 *
 * Doctrine : constate où le temps se loge. Ne dit jamais d'y travailler. L'or est
 * réservé au chrono/record (nombre héros) ; le secteur qui concentre la perte est
 * en crème (donnée neutre). Aucune couleur heritage.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { ProvenanceTag } from '@/ui/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';
import type { IdealLap } from '@/circuit/sessionInsights';
import { useReduceMotion } from '@/components/motion/useReduceMotion';
import { virgule } from '@/utils/format';

const C = theme.dataColors;

/**
 * Écart minimal, en secondes, sous lequel aucun gain n'est ANNONCÉ — à valider
 * sur piste.
 *
 * Les deux moteurs en service écrivent `gap_s: 0` : le potentiel qu'ils
 * publient EST le meilleur tour réel. Rendu tel quel, l'écran affichait
 * « TOUR IDÉAL · −0,0 s SOUS VOTRE MEILLEUR RÉEL » — un gain fabriqué à partir
 * d'un zéro, exactement la forme que la doctrine refuse.
 *
 * Le seuil couvre aussi l'arrondi de chronométrage : sous quelques centièmes,
 * l'écart n'est pas distinguable du bruit de mesure.
 */
const GAIN_MIN_S = 0.05;
// Secteur qui concentre la perte : donnée principale en crème (neutre V3).
// L'or reste réservé au chrono/record (nombre héros).
const HOT = theme.palette.cream;

export interface TourIdealVizProps {
  /** Bloc `ideal_lap` de la séance, ou null s'il n'a pas été calculé. */
  ideal: IdealLap | null;
}

/** Chrono au format m:ss.mmm depuis un total de secondes. */
function fmtChrono(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return virgule(`${m}:${s.toFixed(3).padStart(6, '0')}`);
}

/** Nombre en écriture française (virgule décimale). */
function fmtFr(n: number, decimals: number): string {
  return n.toFixed(decimals).replace('.', ',');
}

export function TourIdealViz({ ideal }: TourIdealVizProps) {
  const reduceMotion = useReduceMotion();
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    // « Réduire les animations » : le point reste allumé, sans respirer. Cinq de
    // ces vues sont montées ensemble sur l'écran d'une séance — c'étaient donc
    // cinq boucles infinies simultanées chez qui a demandé l'absence de
    // mouvement. Relevé le 04/08/2026.
    if (reduceMotion) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.32, duration: 1200, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink, reduceMotion]);

  // Honnêteté : sans chronos calculés, aucun potentiel à montrer.
  if (!ideal || !Number.isFinite(ideal.ideal_time_s) || !Number.isFinite(ideal.real_best_s)) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>Données insuffisantes sur cette séance</Text>
      </View>
    );
  }

  const idealStr = fmtChrono(ideal.ideal_time_s);
  const realStr = fmtChrono(ideal.real_best_s);
  // gap_s = écart réel − idéal ; repli par soustraction si le bloc l'omet.
  const gap = Number.isFinite(ideal.gap_s) ? ideal.gap_s : ideal.real_best_s - ideal.ideal_time_s;
  const deltaStr = `−${fmtFr(gap, 1)} s`;

  /**
   * Un gain a-t-il été DÉMONTRÉ, ou le potentiel est-il le meilleur tour réel ?
   *
   * Les deux moteurs en service rendent le second cas. Le distinguer est tout
   * ce que cet écran peut honnêtement dire de la composition : il ne sait pas
   * de quels morceaux le potentiel serait fait, et encore moins si leurs
   * jonctions tiennent.
   */
  const gainDemontre = Number.isFinite(gap) && gap >= GAIN_MIN_S;

  // Répartition du temps perdu : un secteur par entrée de loss_by_sector_pct
  // (secondes = part du gap). worst_sector (index 1-based) = point chaud (crème).
  const lost = (ideal.loss_by_sector_pct ?? [])
    .map((pct, i) => {
      const sectorNum = i + 1;
      const hot = sectorNum === ideal.worst_sector;
      return {
        sector: `S${sectorNum}`,
        pct,
        label: `${fmtFr(pct, 0)} % · ${fmtFr((gap * pct) / 100, 2)} s`,
        color: hot ? HOT : C.flow,
        hot,
      };
    })
    .filter((l) => l.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  return (
    <View>
      {/* Chrono idéal en héros, réel en référence. */}
      <View style={styles.card}>
        <View style={styles.status}>
          <View style={styles.statusLeft}>
            <Animated.View style={[styles.dotLive, { opacity: blink }]} />
            <Text style={styles.statusLabel}>Potentiel démontré</Text>
          </View>
          {/*
            « MICRO-SECTEURS » se tenait ici. Rien dans la chaîne ne découpe la
            séance en micro-secteurs ; l'étiquette décrivait une méthode absente.
            Elle part, elle n'est pas remplacée : le bloc `ideal_lap` ne dit pas
            comment il a été composé, et inventer une autre mention serait le
            même défaut sous un autre mot.
          */}
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroNum}>{idealStr}</Text>
          <Text style={styles.heroLabel}>
            {gainDemontre
              ? `POTENTIEL DÉMONTRÉ · ${deltaStr} SOUS VOTRE MEILLEUR RÉEL`
              : 'POTENTIEL DÉMONTRÉ · VOTRE MEILLEUR TOUR RÉEL DE LA SÉANCE'}
          </Text>
        </View>

        {/*
          « Tour idéal, ANNONCÉ THÉORIQUE » — dossier de montage, phase 4septies.

          Le mot « théorique » ne vivait que dans l'en-tête de ce fichier. À
          l'écran, ce chrono s'affichait en chiffre héros, sans rien dire de sa
          nature : un temps que personne n'a jamais réalisé, présenté comme la
          mesure principale de la séance.

          L'étiquette vient du registre `src/telemetry/provenance.ts`, qui classe
          `delta.idealLapTime` en [I] et nomme l'hypothèse — les meilleurs
          morceaux supposés combinables dans un même tour.

          Elle ne s'affiche QUE si un gain est annoncé. Sans gain, le chrono
          montré est le meilleur tour réel : une mesure, pas une inférence.
          L'étiqueter [I] aurait fait passer un tour réellement bouclé pour une
          hypothèse — l'erreur symétrique de celle que ce lot corrige.
        */}
        {gainDemontre ? <ProvenanceTag cle="delta.idealLapTime" /> : null}

        <View style={styles.refRow}>
          <Text style={styles.refKey}>Meilleur tour réel</Text>
          <Text style={styles.refVal}>{realStr}</Text>
        </View>
      </View>

      {/* Où se loge l'écart — constat, pas consigne. Sans gain annoncé, il n'y a
          aucun écart à répartir : une barre « 0 % · 0,00 s » par secteur serait
          un zéro fabriqué. */}
      {gainDemontre && lost.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cap}>Où se loge l’écart de {fmtFr(gap, 1)} s</Text>
          {lost.map((l) => (
            <View key={l.sector} style={styles.lrow}>
              <Text style={styles.lab}>{l.sector}</Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${l.pct}%`, backgroundColor: l.color },
                    l.hot && styles.fillHot,
                  ]}
                />
              </View>
              <Text style={[styles.pct, { color: l.hot ? l.color : theme.palette.creamMute }]}>
                {l.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cockpitPanel,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  empty: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  dotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.creamMute,
  },
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  statusRight: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.palette.faint,
  },
  hero: { alignItems: 'center', marginBottom: theme.spacing.md },
  heroNum: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -0.5,
    color: theme.palette.cream,
    // Lueur crème très discrète (V3 calme) : aucun or décoratif (or = chrono).
    textShadowColor: 'rgba(245,245,247,0.12)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: theme.palette.faint,
    marginTop: 4,
    textAlign: 'center',
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.line,
    paddingTop: theme.spacing.md,
  },
  refKey: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  refVal: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 16,
    color: theme.palette.creamSoft,
  },
  cap: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  lrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  lab: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.palette.creamSoft,
    width: 28,
  },
  track: {
    flex: 1,
    height: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radius.pill,
  },
  fillHot: {
    // Lueur de donnée lisible mais sans bloom qui bave (≤ ~0.5).
    shadowColor: HOT,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  pct: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    width: 76,
    textAlign: 'right',
  },
});
