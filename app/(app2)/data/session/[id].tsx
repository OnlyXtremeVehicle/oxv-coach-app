/**
 * SÉANCE — l'écran pivot de la zone DATA (V2-L3). Route
 * `/(app2)/data/session/[id]` : la lecture DÉTAILLÉE d'UNE séance du pilote
 * courant, section par section, dans un seul scroll ancré.
 *
 * DOCTRINE (non négociable) :
 *  - UNE SEULE SÉANCE, UN SEUL PILOTE. L'écran n'a jamais montré deux pilotes à
 *    la fois et ne le fera pas. Il était STRICTEMENT self jusqu'au 29/07/2026 ;
 *    depuis le lot J5 (décision fondateur « ancre partagée dans la séance du
 *    pilote »), un coach peut ouvrir la séance d'un de ses pilotes — la RLS
 *    arbitre l'accès, jamais ce fichier.
 *
 *    LA RÈGLE QUI EN DÉCOULE : dès que le lecteur n'est pas le pilote,
 *    l'identité de référence bascule sur le PROPRIÉTAIRE de la séance
 *    (`data.pilotId`). Tout calcul qui compare à un historique — superposition
 *    des passages, corrélation météo — prend cette identité. Prendre celle du
 *    lecteur produirait le défaut D-20, où le bilan V2 marquait « record » la
 *    séance d'un pilote après l'avoir comparée aux séances du coach.
 *
 *    Le RÔLE ne décide que d'une ACTION — « Annoter ce virage » — jamais d'une
 *    lecture. Le pilote voit le même écran, sans cette commande.
 *  - DONNÉES RÉELLES : une donnée absente devient « — » ou un StateView vide —
 *    JAMAIS un chiffre fabriqué. La prod n'a presque aucune trame (1 séance /
 *    1 tour) : chaque section doit se dégrader proprement en vide honnête.
 *  - PAS DE FABRICATION : `telemetry_frames` ne porte NI fréquence cardiaque NI
 *    température de piste. La section « Cœur » rend donc un vide honnête (jamais
 *    de FC inventée) ; « Conditions » ne lit que l'air réel (temp + humidité,
 *    nullable → « — »).
 *  - 6 LECTURES = DÉMO : les visualisations Insight sont montées telles quelles
 *    (composants zéro-prop autonomes) sous le bandeau DÉMO — non recâblées.
 *  - COMPARATEUR SANS GAGNANT ; couleurs QDI = données seulement ; or Heritage
 *    réservé au record/certifié ; UN accent rouge par zone ; vouvoiement ; zéro
 *    emoji.
 *
 * Le hook `useSeance(id)` charge les sections indépendantes via
 * `Promise.allSettled` : l'échec d'une section n'abat pas les autres (vide ou
 * erreur honnête, jamais un zéro trompeur). Les sous-données lourdes
 * (télémétrie, trames de tour, tracé) sont chargées PARESSEUSEMENT dans leur
 * propre section — le montage reste léger.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  ChronoHero,
  Chip,
  CondensingHeaderBar,
  Field,
  ListRow,
  PressScale,
  SectionHeader,
  Sheet,
  StatCell,
  StateView,
  TraceCircuit,
  clamp,
  colors,
  condensedProgress,
  haptic,
  lerp,
  radius,
  space,
  tabBarSpace,
  typo,
  useFirstViewport,
  useReduceMotion,
} from '@/ui/v2';
import { fontSize } from '@/theme/v2';
import { couleurTexteSure } from '@/ui/v2/couleurTexte';
import { domaineGradue, domaineSymetrique, graduations } from '@/ui/v2/courbeCanalLogic';
import { raisonsResume } from '@/features/data/raisonAbsence';
import { formatDeltaMs } from '@/features/data/comparerLogic';
import {
  decouperZones,
  evaluerConfianceTour,
  VERSION_CONFIANCE_ZONE,
  type ConfianceTour,
  type NiveauConfiance,
  type TrameQualite,
} from '@/features/data/confianceLogic';
import { longueurDerivee, versTramesQualite } from '@/features/data/confianceSource';
import { construireIndex, portion } from '@/telemetry/projectionCurviligne';
import {
  SEUIL_ECART_PEINT_S,
  carteOpportunites,
  type CarteOpportunites,
  type PortionEcart,
} from '@/features/data/carteOpportunitesLogic';
import { POLES_DELTA } from '@/ui/v2/grammaireViz';
import { calculeTendanceSession } from '@/features/data/progressionLogic';
import {
  evaluerTours,
  type ClassementTour,
  type TourEvalue,
  type TourMesure,
} from '@/features/data/validationToursLogic';
import {
  LIBELLE_GENRE_MARQUE,
  composerLecturesTours,
  type LectureTour,
} from '@/features/data/marquesTourLogic';
import {
  listerMarquesSeance,
  poserMarque,
  retirerMarque,
  type GenreMarqueTour,
  type MarqueTourPosee,
} from '@/services/lapMarksService';
import {
  lireChevauchement,
  lireRotation,
  type EchantillonRotation,
  type EchantillonVirage,
  type ResultatChevauchement,
  type ResultatRotation,
} from '@/features/data/virageFinLogic';
import { DEG_VERS_RAD } from '@/services/sessionTelemetryMapping';
import { polylineToPathD } from '@/components/motion/pathMath';
import { AnatomieViz } from '@/components/insights/AnatomieViz';
import { DispersionViz } from '@/components/insights/DispersionViz';
import { FlowViz } from '@/components/insights/FlowViz';
import { GGViz, type GGPoint } from '@/components/insights/GGViz';
import { TourIdealViz } from '@/components/insights/TourIdealViz';
import { TransfertViz } from '@/components/insights/TransfertViz';
import { READINGS, type ReadingKey } from '@/components/insights/catalogue';
import { etatLecture, sectionAffichable } from '@/components/insights/disponibilite';
import { BarresG } from '@/components/telemetry/BarresG';
import { NiveauxRestitution } from '@/components/telemetry/NiveauxRestitution';
import { SectionBande } from '@/components/telemetry/SectionBande';
import { SectionDelta, type LectureTraceDelta } from '@/components/telemetry/SectionDelta';
import { StripMap } from '@/components/telemetry/StripMap';
import { TraceVirage } from '@/components/telemetry/TraceVirage';
import { getCornerDuCircuit } from '@/lib/circuitTopology';
import { trancheVirage } from '@/telemetry/virage';
import { ETAT_SEANCE_VIDE, loadEtatSeance } from '@/services/etatSeanceService';
import type { EtatSeance } from '@/telemetry/niveaux';
import { fetchSessionInsights } from '@/services/sessionInsightsService';
import type { SessionInsights } from '@/circuit/sessionInsights';
import { loadSessionFlow } from '@/services/flowService';
import type { FlowPoint } from '@/services/flowLogic';
import { supabase } from '@/lib/supabase';
import { fetchAllSessions, fetchSessionById, fetchSessionLaps } from '@/services/sessionsService';
import { loadCornerEvolution } from '@/services/cornerEvolutionService';
import type { CornerEvolution } from '@/services/cornerEvolutionService';
import {
  listSegmentAnalysesForSession,
  type SegmentAnalysisRow,
} from '@/services/segmentAnalysesService';
import {
  loadGGPoints,
  loadLapFrames,
  loadSessionTrajectory,
  loadSpeedTracePoints,
  loadThrottleBrakePoints,
  loadTramesQualiteTour,
} from '@/services/sessionTelemetryService';
import type { SessionFrame } from '@/services/sessionTelemetryMapping';
import { loadWeatherCorrelation } from '@/services/weatherCorrelationService';
import type { WeatherBucket, WeatherCorrelation } from '@/services/weatherCorrelationService';
import { hauteursBarres, libelleEffectif, noteMethode } from '@/services/weatherEchelleLogic';
import { useAuthStore } from '@/store/useAuthStore';
import type { MarginZone } from '@/types/domain';
import type { Lap, TelemetrySession } from '@/types/telemetry';
import type { TrajectoryFramePoint } from '@/services/trajectoryLogic';
import { formatChronoMs } from '@/utils/time';
import { formatDateShort, virgule } from '@/utils/format';

// ═══════════════════════════════════════════════════════════════════════════
// Ancres — le rail horizontal collant sous le header condensé.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Les huit ancres de la séance, dans l'ordre de lecture.
 *
 * Le delta suit immédiatement les tours, parce qu'il en compare deux et n'a de
 * sens qu'une fois qu'on sait lesquels — c'est aussi la séquence du dossier de
 * conception, qui décrit le coach ouvrant le delta EN PREMIER pour localiser
 * où le temps se fait, avant toute autre lecture.
 */
const ANCHORS = [
  { key: 'resume', label: 'Résumé' },
  { key: 'tours', label: 'Tours' },
  { key: 'delta', label: 'Delta' },
  { key: 'trace', label: 'Tracé' },
  { key: 'telemetrie', label: 'Télémétrie' },
  { key: 'constats', label: 'Constats' },
  { key: 'coeur', label: 'Cœur' },
  { key: 'conditions', label: 'Conditions' },
] as const;

const HEADER_BASE = 48;
const RAIL_HEIGHT = 44;

// ═══════════════════════════════════════════════════════════════════════════
// Hook de données — sections indépendantes (Promise.allSettled).
// ═══════════════════════════════════════════════════════════════════════════

/** Météo de la séance : temp + humidité RÉELLES, nullable (« — » si absent). */
interface SeanceWeather {
  temperatureC: number | null;
  humidityPct: number | null;
  label: string | null;
}

/** État chargé du hook `useSeance`. */
interface SeanceData {
  session: TelemetrySession;
  laps: Lap[];
  segments: SegmentAnalysisRow[];
  weather: SeanceWeather | null;
  correlation: WeatherCorrelation | null;
  /**
   * Identité du PILOTE de la séance — pas celle du lecteur.
   *
   * Les deux coïncident dans le cas courant. Elles divergent quand un coach
   * ouvre la séance d'un de ses pilotes : tout ce qui compare à un historique
   * doit alors prendre CETTE identité, jamais celle du lecteur. C'est le
   * défaut D-20, où le bilan V2 marquait « record » la séance d'un pilote après
   * l'avoir comparée aux séances du coach.
   */
  pilotId: string;
  /** Vrai quand le lecteur n'est pas le pilote (lecture coach). */
  lectureDAutrui: boolean;
  /** Séances du MÊME circuit et du MÊME pilote, pour la superposition B4. */
  circuitSessionIds: string[];
  /** Tour retenu par séance pour la superposition (best_lap_number, sinon 1). */
  lapNumberBySession: Record<string, number>;
  /** Lectures Insight RÉELLES (session_insights) — null tant que non calculées. */
  insights: SessionInsights | null;
  /** Nuage g-g RÉEL (loadGGPoints) — vide si trames insuffisantes. */
  ggPoints: GGPoint[];
  /** Jerk résiduel RÉEL (loadSessionFlow) — vide si trames insuffisantes. */
  flowPoints: FlowPoint[];
  /** Ce que la séance contient — ouvre ou ferme les cinq niveaux de lecture. */
  etatSeance: EtatSeance;
  /** Sections dont le chargement a ÉCHOUÉ (erreur DB) — distinct de « vide ». */
  failed: Record<string, boolean>;
}

type SeanceStatus = 'loading' | 'ready' | 'notfound' | 'error';

/**
 * Lecture météo d'UNE séance — SELECT-only, self-only (RLS restreint aux
 * séances du pilote). `temperature_c` / `humidity_pct` sont NULLABLE en base :
 * on préserve le null (rendu « — »), on n'invente jamais un zéro (donnée
 * réelle, doctrine L3). Une panne DB REMONTE (erreur → retry), jamais masquée.
 */
async function loadSeanceWeather(sessionId: string): Promise<SeanceWeather | null> {
  const { data, error } = await supabase
    .from('weather_snapshots')
    .select('temperature_c, humidity_pct, weather_label, captured_at')
    .eq('session_id', sessionId)
    .order('captured_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    temperature_c: number | null;
    humidity_pct: number | null;
    weather_label: string | null;
  };
  return {
    temperatureC: row.temperature_c !== null ? Number(row.temperature_c) : null,
    humidityPct: row.humidity_pct !== null ? Number(row.humidity_pct) : null,
    label: row.weather_label,
  };
}

/**
 * Charge la séance pivot + ses sections. La séance elle-même est le socle :
 * son absence rend `notfound`, une panne de la liste rend `error`. Les autres
 * sections passent par `Promise.allSettled` — chacune tombe en vide honnête
 * (ou en erreur de section) sans abattre les voisines.
 */
function useSeance(id: string | undefined) {
  const userId = useAuthStore((s) => s.profile?.id ?? s.user?.id ?? null);
  const [status, setStatus] = useState<SeanceStatus>('loading');
  const [data, setData] = useState<SeanceData | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!id || !userId) return;
    let cancelled = false;
    setStatus('loading');

    (async () => {
      // Socle : la séance. `strict` distingue panne (error) de vide.
      let sessions: TelemetrySession[];
      try {
        sessions = await fetchAllSessions(userId, { strict: true });
      } catch {
        if (!cancelled) setStatus('error');
        return;
      }

      let session = sessions.find((s) => s.id === id) ?? null;
      let pilotId = userId;

      // LECTURE D'AUTRUI (coach ouvrant la séance de son pilote, lot J5).
      //
      // L'écran était strictement self : une séance absente de MA liste rendait
      // « introuvable », et le coach n'avait donc aucun chemin vers un virage à
      // annoter. Le repli lit la séance par son id — la RLS arbitre l'accès, ce
      // n'est pas ce code qui autorise quoi que ce soit.
      //
      // Une fois la séance obtenue, l'identité de référence bascule sur son
      // PROPRIÉTAIRE. Sans ce basculement, la superposition des passages
      // comparerait la séance du pilote aux séances du coach : le défaut D-20,
      // reproduit ici.
      if (!session) {
        try {
          session = await fetchSessionById(id);
        } catch {
          if (!cancelled) setStatus('error');
          return;
        }
        if (!session) {
          if (!cancelled) setStatus('notfound');
          return;
        }
        pilotId = session.user_id;
        try {
          sessions = await fetchAllSessions(pilotId, { strict: true });
        } catch {
          // L'historique du pilote reste hors de portée : on lit la séance
          // seule. La superposition se réduira honnêtement à ce passage-ci.
          sessions = [session];
        }
      }

      const circuitSessions = session.circuit_id
        ? sessions.filter((s) => s.circuit_id === session.circuit_id)
        : [session];
      const circuitSessionIds = circuitSessions.map((s) => s.id);
      const lapNumberBySession: Record<string, number> = {};
      for (const s of circuitSessions) {
        lapNumberBySession[s.id] = s.best_lap_number ?? 1;
      }

      // Sections indépendantes — l'échec de l'une n'entache pas les autres.
      const [lapsR, segmentsR, weatherR, correlationR, insightsR, ggR, flowR, niveauxR] =
        await Promise.allSettled([
          fetchSessionLaps(id, { strict: true }),
          listSegmentAnalysesForSession(id),
          loadSeanceWeather(id),
          // `pilotId`, pas `userId` : la corrélation météo se lit sur
          // l'historique de CELUI QUI A ROULÉ (voir D-20).
          loadWeatherCorrelation(pilotId, session.circuit_id ?? undefined),
          fetchSessionInsights(id),
          loadGGPoints(id),
          loadSessionFlow(id),
          // Trois COMPTES côté base (head: true) : rien ne transite. C'est ce
          // qui autorise à l'ajouter ici sans alourdir l'ouverture d'écran.
          loadEtatSeance(id),
        ]);
      if (cancelled) return;

      const failed: Record<string, boolean> = {};
      let laps: Lap[] = [];
      if (lapsR.status === 'fulfilled') laps = lapsR.value;
      else failed.tours = true;

      let segments: SegmentAnalysisRow[] = [];
      if (segmentsR.status === 'fulfilled') segments = segmentsR.value;
      else failed.trace = true;

      let weather: SeanceWeather | null = null;
      if (weatherR.status === 'fulfilled') weather = weatherR.value;
      else failed.weather = true;

      let correlation: WeatherCorrelation | null = null;
      if (correlationR.status === 'fulfilled') correlation = correlationR.value;
      else failed.conditions = true;

      // Insights RÉELS : absence honnête (null) tant que le moteur n'a pas tourné
      // sur des trames denses. Panne DB → section Constats en erreur, jamais un
      // rendu démo passé pour réel.
      let insights: SessionInsights | null = null;
      if (insightsR.status === 'fulfilled') insights = insightsR.value;
      else failed.constats = true;

      let ggPoints: GGPoint[] = [];
      if (ggR.status === 'fulfilled') ggPoints = ggR.value;

      // Flux RÉEL (jerk résiduel, A-FLOW-1). Liste vide = pas de trames assez
      // denses : la lecture le dira elle-même, elle n'inventera rien.
      let flowPoints: FlowPoint[] = [];
      if (flowR.status === 'fulfilled') flowPoints = flowR.value;

      // Une panne de compte devient un état vide, donc des niveaux fermés qui
      // disent leur absence — jamais un niveau ouvert sur rien.
      let etatSeance: EtatSeance = ETAT_SEANCE_VIDE;
      if (niveauxR.status === 'fulfilled') etatSeance = niveauxR.value;

      setData({
        session,
        pilotId,
        lectureDAutrui: pilotId !== userId,
        laps,
        segments,
        weather,
        correlation,
        circuitSessionIds,
        lapNumberBySession,
        insights,
        ggPoints,
        flowPoints,
        etatSeance,
        failed,
      });
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
    };
  }, [id, userId, nonce]);

  return { status, data, reload };
}

// ═══════════════════════════════════════════════════════════════════════════
// Petits utilitaires purs de rendu (couleur, mise à l'échelle).
// ═══════════════════════════════════════════════════════════════════════════

/** Couleur d'une zone de marge — donnée (jamais du chrome). Rouge = l'accent. */
function marginZoneColor(zone: MarginZone | null): string {
  switch (zone) {
    case 'green':
      return colors.qdi.acceleration;
    case 'yellow':
      return colors.qdi.fluidite;
    case 'red':
      return colors.accent;
    default:
      return colors.text.low;
  }
}

/** Interpole deux couleurs #RRGGBB — sert la rampe froid→chaud (sans rouge). */
function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const k = clamp(t, 0, 1);
  const r = Math.round(lerp(ar, br, k));
  const g = Math.round(lerp(ag, bg, k));
  const bl = Math.round(lerp(ab, bb, k));
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Rampe vitesse froid→chaud : bleu (lent) → ambre (rapide). Aucun rouge. */
function speedColor(t: number): string {
  return lerpHex(colors.qdi.trajectoire, colors.qdi.fluidite, t);
}

/** Point projeté d'une trajectoire, avec sa vitesse alignée 1:1. */
interface FittedPoint {
  x: number;
  y: number;
  speed: number | null;
}

/**
 * Projette une trajectoire lat/lon dans une boîte px (ratio d'aspect préservé,
 * latitude vers le haut). La vitesse reste alignée point à point — jamais
 * ré-échantillonnée. < 2 points GPS → tableau vide (rien d'inventé).
 */
function fitTrajectory(
  traj: readonly TrajectoryFramePoint[],
  width: number,
  height: number,
  pad: number
): FittedPoint[] {
  if (traj.length < 2 || width <= 0 || height <= 0) return [];
  const lats = traj.map((p) => p.lat);
  const lons = traj.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const minLon = Math.min(...lons);
  const spanLat = Math.max(...lats) - minLat;
  const spanLon = Math.max(...lons) - minLon;
  const maxSpan = Math.max(spanLat, spanLon);
  if (!Number.isFinite(maxSpan) || maxSpan <= 0) return [];
  const scale = Math.min((width - 2 * pad) / maxSpan, (height - 2 * pad) / maxSpan);
  return traj.map((p) => ({
    x: pad + (p.lon - minLon) * scale,
    y: height - pad - (p.lat - minLat) * scale,
    speed: p.speed,
  }));
}

/** Durée d'un tour en ms (les tours stockent des secondes). */
function lapMs(lap: Lap): number {
  return Math.round(lap.duration_seconds * 1000);
}

/**
 * Les tours de la séance au contrat du module M05 (`validationToursLogic`).
 *
 * DEUX MESURES MANQUENT, ET ELLES VALENT `null` — jamais zéro. La table `laps`
 * ne porte ni vitesse minimale du tour ni durée cumulée des trous de mesure :
 * `lapDetection` ne produit aujourd'hui que des franchissements et des durées.
 * Un `trousMesureMs: 0` AFFIRMERAIT une mesure continue ; `null` dit « on ne
 * sait pas ». Le module s'en accommode et n'émet alors ni marque d'arrêt ni
 * marque de trou — il fonctionne dégradé sans mentir.
 *
 * `valide: true` parce que rien en base ne signale un tour inexploitable : les
 * trois booléens de `laps` sont `is_outlap`, `is_inlap`, `is_best_lap`. Les
 * deux premiers deviennent les tags que la détection amont expose déjà.
 *
 * AUCUNE MARQUE MANUELLE N'EST LUE NI ÉCRITE. Le tour que le pilote déclare
 * gêné, ou choisit comme représentatif, n'a à ce jour aucune place en base —
 * `laps` n'a ni colonne de motif ni colonne d'auteur, et le critère « chaque
 * inclusion/exclusion conserve un motif audité » ne peut donc pas être tenu.
 * L'écran reste en LECTURE automatique tant qu'une décision de schéma n'a pas
 * été prise (table `lap_marks` dédiée, ou colonne `laps.marques`).
 */
function versToursMesure(laps: Lap[]): TourMesure[] {
  return laps.map((l) => ({
    index: l.lap_number,
    tempsMs: l.duration_seconds > 0 ? lapMs(l) : null,
    valide: true,
    tags: [...(l.is_outlap ? ['outlap'] : []), ...(l.is_inlap ? ['inlap'] : [])],
    vitesseMiniKmh: null,
    trousMesureMs: null,
  }));
}

/** Libellés d'écran des trois classements du module M05. */
const LIBELLE_CLASSEMENT: Record<ClassementTour, string> = {
  propre: 'propre',
  suspect: 'suspect',
  hors_chrono: 'hors chronométrage',
};

/**
 * La ligne de marques d'un tour : son classement, puis les FAITS qui l'ont
 * produit. `null` pour un tour propre sans marque — il n'y a rien à dire, et
 * l'écran ne remplit pas le silence.
 */
function ligneMarques(tour: TourEvalue | undefined): string | null {
  if (tour === undefined || tour.marques.length === 0) return null;
  const faits = tour.marques.map((m) => m.fait).join(' ; ');
  return `Tour ${tour.index} · ${LIBELLE_CLASSEMENT[tour.classement]} — ${faits}`;
}

/**
 * Les six déclarations proposées, DÉRIVÉES de la table de libellés — jamais
 * recopiées. `LIBELLE_GENRE_MARQUE` est un `Record` sur l'énumération complète :
 * ses clés SONT l'énumération, dans l'ordre de la base. Une septième valeur
 * ajoutée un jour au type apparaîtra donc ici d'elle-même, tandis qu'une liste
 * écrite à la main l'aurait tue.
 *
 * Longueur maximale du motif libre. La base n'en impose aucune — elle exige
 * seulement que la chaîne ne soit pas vide. Ce plafond est une commodité
 * d'écran : au-delà, le mot cesse d'être un mot et la ligne devient illisible
 * partout où elle se relit.
 */
const GENRES_MARQUE = Object.keys(LIBELLE_GENRE_MARQUE) as GenreMarqueTour[];
const MOTIF_MAX = 160;

// ═══════════════════════════════════════════════════════════════════════════
// Écran.
// ═══════════════════════════════════════════════════════════════════════════

export default function SeanceScreen() {
  const params = useLocalSearchParams<{ id?: string; corner?: string }>();
  const id = params.id;

  /**
   * Ancre `?corner=` — arriver DIRECTEMENT sur un virage (lot J5, décision
   * fondateur du 29/07/2026 : « ancre partagée dans la séance du pilote »).
   *
   * L'Arbre pilote annonce « les virages et leur évolution » dans `data/session`
   * mais la table `ANCHORS` n'en portait aucune trace : on n'entrait sur un
   * virage que par un tap, jamais par un lien. Un débrief qui dit « regardez le
   * virage 4 » n'avait donc pas de chemin.
   *
   * L'index est celui de `segments[].segmentIndex`, **numéroté à partir de 1**.
   * La chaîne le prouve : `trackviz/analysis.ts` écrit `segmentIndex:
   * segment.order`, `trackviz/hauteSaintonge.ts` pose `order: corner.index`, et
   * `BELTOISE_CORNERS` commence à 1. C'est aussi ce qu'exige
   * `(coach)/annoter.tsx`, qui refuse tout `cornerIndex < 1`.
   *
   * Le premier jet de cette ancre annonçait « à zéro comme en base » et
   * acceptait 0 : le contrat écrit contredisait le code. Un lien composé
   * d'après ce commentaire aurait ouvert le virage voisin.
   *
   * Une valeur illisible ou hors liste est IGNORÉE — l'écran s'ouvre
   * normalement plutôt que d'afficher un virage arbitraire.
   */
  const cornerParam = useMemo(() => {
    if (typeof params.corner !== 'string') return null;
    const n = Number.parseInt(params.corner, 10);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }, [params.corner]);
  const insets = useSafeAreaInsets();
  const { status, data, reload } = useSeance(id);

  /**
   * Le rôle décide de l'ACTION, jamais de la lecture.
   *
   * Un coach ou un administrateur peut poser une note sur un virage ; le pilote
   * lit le même écran sans jamais voir cette commande. La combinaison avec
   * `lectureDAutrui` évite le cas absurde d'un coach s'annotant lui-même.
   *
   * Ce test ne protège RIEN : c'est la RLS qui autorise ou refuse l'écriture.
   * Il décide seulement de ce qu'il est utile de montrer.
   */
  const role = useAuthStore((s) => s.profile?.role ?? null);
  const peutAnnoter = role === 'coach' || role === 'admin';

  /**
   * Le LECTEUR — pas le pilote de la séance. Il ne sert qu'à distinguer « ma
   * déclaration » de « celle d'un tiers » sur un tour : aucune lecture, aucun
   * calcul ne s'y adosse (ce serait le défaut D-20, rappelé en tête de
   * fichier). `null` tant que le profil n'est pas chargé — rien n'est alors
   * « à moi », ce qui est le sens prudent.
   */
  const lecteurId = useAuthStore((s) => s.profile?.id ?? s.user?.id ?? null);

  const headerH = insets.top + HEADER_BASE;
  const railTop = headerH;
  const contentTop = headerH + RAIL_HEIGHT + space.md;

  // Tour sélectionné (pilote Tracé / Télémétrie / Cœur). null = tour de réf.
  const [selectedLap, setSelectedLap] = useState<number | null>(null);

  /**
   * LA LECTURE DU DELTA, PARTAGÉE ENTRE DEUX SECTIONS — lot 7b.
   *
   * La section L'ÉCART la produit (elle charge déjà les deux tours de trames) ;
   * la section TRACÉ la consomme pour peindre les écarts locaux sur la
   * polyligne. Une seule lecture, un seul calcul, deux vues qui ne peuvent pas
   * se contredire.
   *
   * `null` tant que la section L'ÉCART n'a rien pu établir — le tracé reste
   * alors nu, ce qui est le comportement voulu.
   */
  const [lectureDelta, setLectureDelta] = useState<LectureTraceDelta | null>(null);
  // Référence stable : elle est en dépendance de l'effet qui publie.
  const recevoirLectureDelta = useCallback((lecture: LectureTraceDelta | null) => {
    setLectureDelta(lecture);
  }, []);

  // Scroll partagé : header condensé + rail actif suivent le même défilement.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const sectionY = useRef<number[]>([]);
  const [activeAnchor, setActiveAnchor] = useState(0);

  const syncActive = useCallback(
    (y: number) => {
      const line = y + headerH + RAIL_HEIGHT + 12;
      let next = 0;
      for (let i = 0; i < ANCHORS.length; i++) {
        const top = sectionY.current[i];
        if (top !== undefined && top <= line) next = i;
      }
      setActiveAnchor((prev) => (prev === next ? prev : next));
    },
    [headerH]
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    runOnJS(syncActive)(event.contentOffset.y);
  });

  const goToAnchor = useCallback(
    (index: number) => {
      const top = sectionY.current[index];
      if (top === undefined) return;
      haptic('tap');
      const target = Math.max(0, top - headerH - RAIL_HEIGHT);
      runOnUI(() => {
        'worklet';
        scrollTo(scrollRef, 0, target, true);
      })();
    },
    [headerH, scrollRef]
  );

  const registerSection = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      sectionY.current[index] = event.nativeEvent.layout.y;
    },
    []
  );

  /**
   * Largeur utile du strip map, mesurée plutôt que déduite.
   *
   * Elle vaut la largeur d'écran moins les marges de section — mais la déduire
   * obligerait à recopier `space.xl` ici, et la valeur de `space.lg` a déjà
   * dérivé une fois dans ce dépôt sans que rien ne le dise. On mesure.
   */
  const [stripWidth, setStripWidth] = useState(0);

  /**
   * Ancre `?corner=` : amener aussi le DÉFILEMENT sur la section Tracé.
   *
   * La feuille du virage s'ouvre par-dessus tout ; sans ce déplacement, la
   * refermer laisserait le lecteur en haut de l'écran, loin du virage dont on
   * venait de lui parler.
   *
   * `runAfterInteractions` parce que `sectionY` se remplit aux `onLayout`, qui
   * n'ont pas encore eu lieu à l'instant où cet effet part.
   */
  const ancreDefilee = useRef(false);
  useEffect(() => {
    if (ancreDefilee.current || cornerParam === null || status !== 'ready') return;
    ancreDefilee.current = true;
    const tache = InteractionManager.runAfterInteractions(() => {
      goToAnchor(ANCHORS.findIndex((a) => a.key === 'trace'));
    });
    return () => tache.cancel();
  }, [cornerParam, status, goToAnchor]);

  // Style du header condensé (fondu entrant au-delà du seuil).
  const condensedStyle = useAnimatedStyle(() => ({
    opacity: condensedProgress(scrollY.value, 40, 24),
  }));

  const metaLine = useMemo(() => {
    if (!data) return '';
    const date = data.session.started_at ? formatDateShort(data.session.started_at) : null;
    return [date, data.session.circuit_name || null].filter(Boolean).join(' · ').toUpperCase();
  }, [data]);

  // ── États non nominaux — jamais de spinner ─────────────────────────────
  if (status !== 'ready' || !data) {
    return (
      <View style={styles.root}>
        <View style={[styles.stateWrap, { paddingTop: headerH + space.xl }]}>
          {status === 'loading' ? (
            <StateView state="loading" shape="list" />
          ) : status === 'error' ? (
            <StateView
              state="error"
              errorMessage="La séance n'a pas pu être chargée."
              onRetry={reload}
            />
          ) : (
            <StateView state="empty" emptyMessage="Cette séance est introuvable." />
          )}
        </View>
        <HeaderFixed headerH={headerH} insetsTop={insets.top} title={metaLine} />
      </View>
    );
  }

  /**
   * Tour de référence de la séance : celui que la base désigne, sinon le
   * meilleur tour chronométré lu. `null` quand rien n'est chronométré — la
   * confiance de mesure et les constats de fin de virage n'inventent alors
   * aucun tour à lire.
   */
  const tourReference = (() => {
    if (data.session.best_lap_number !== null && data.session.best_lap_number !== undefined) {
      return data.session.best_lap_number;
    }
    const valides = data.laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0);
    if (valides.length === 0) return null;
    return valides.reduce((a, b) => (lapMs(a) <= lapMs(b) ? a : b)).lap_number;
  })();

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: contentTop,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
      >
        {/* ── 1 · RÉSUMÉ ──────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(0)}>
          <ResumeSection session={data.session} laps={data.laps} />
          {/*
            Ce que la séance permet de lire, posé d'emblée : le pilote sait
            avant de descendre ce qu'il trouvera et ce qui manque. Sans ancre
            propre — c'est une orientation, pas une section.
          */}
          <View style={styles.niveaux}>
            <NiveauxRestitution seance={data.etatSeance} />
          </View>
          {/*
            La confiance de MESURE du tour de référence (module M03+) : une
            note par la pire zone, jamais sans ses motifs — la feuille les
            détaille. Elle vit sous « ce que la séance permet de lire » parce
            qu'elle en est le prolongement : à quel point la lecture est solide.
          */}
          <ConfianceMesure sessionId={data.session.id} lapNumber={tourReference} />
        </View>

        {/* ── 2 · TOURS ───────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(1)}>
          <SectionHeader eyebrow="TOURS" count={data.laps.length || undefined} />
          <ToursSection
            laps={data.laps}
            failed={data.failed.tours === true}
            selectedLap={selectedLap}
            onSelect={setSelectedLap}
            onRetry={reload}
            sessionId={data.session.id}
            lecteurId={lecteurId}
          />
          {/*
            Au-delà du seuil, les traces individuelles cessent de se distinguer :
            la bande prend le relais. En deçà, elle ne s'affiche pas du tout —
            la liste des tours dit mieux ce qu'il y a à dire.
          */}
          <SectionBande
            sessionId={data.session.id}
            debutSeanceIso={data.session.started_at}
            laps={data.laps}
          />
          {/*
            La tendance de la séance (module M06) : temps en baisse, stables ou
            en hausse — le fait, jamais la cause. Elle vient APRÈS les barres :
            on lit d'abord les tours un à un, puis ce qu'ils dessinent ensemble.
          */}
          <TendanceTours laps={data.laps} />
        </View>

        {/* ── 3 · DELTA ───────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(2)}>
          <SectionHeader eyebrow="L’ÉCART" title="Où le temps se fait" />

          {/*
            LE STRIP MAP OUVRE LA SECTION, ET CE N'EST PAS DÉCORATIF.

            « Dérouler le tracé fermé en un axe distance droit […] avec le tracé
            lui-même comme règle graduée. » La courbe de delta juste dessous
            partage exactement cet axe : le ruban dit OÙ, la courbe dit COMBIEN.
            Un axe en mètres ne permettait pas de situer — personne ne connaît
            son circuit en mètres.

            Il vit DANS la section Delta plutôt qu'en section propre : les
            positions de défilement sont enregistrées par index, et en insérer
            une aurait décalé les six suivantes.
          */}
          <View style={styles.stripMap} onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}>
            {stripWidth > 0 ? <StripMap segments={data.segments} width={stripWidth} /> : null}
          </View>

          <SectionDelta
            sessionId={data.session.id}
            tours={data.laps.map((l) => ({
              lapNumber: l.lap_number,
              durationSeconds: l.duration_seconds,
              isOutlap: l.is_outlap,
              isInlap: l.is_inlap,
            }))}
            tourSelectionne={selectedLap}
            segments={data.segments}
            onLecture={recevoirLectureDelta}
          />
        </View>

        {/* ── 4 · TRACÉ & VIRAGES ─────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(3)}>
          <SectionHeader eyebrow="TRACÉ & VIRAGES" />
          <TraceSection
            sessionId={data.session.id}
            selectedLap={selectedLap}
            segments={data.segments}
            circuitSessionIds={data.circuitSessionIds}
            lapNumberBySession={data.lapNumberBySession}
            initialCorner={cornerParam}
            pilotId={data.pilotId}
            peutAnnoter={peutAnnoter && data.lectureDAutrui}
            laps={data.laps}
            circuitName={data.session.circuit_name ?? null}
            meilleurTour={data.session.best_lap_number ?? null}
            lectureDelta={lectureDelta}
          />
        </View>

        {/* ── 5 · TÉLÉMÉTRIE ──────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(4)}>
          <SectionHeader eyebrow="LES MESURES" />
          <TelemetrieSection sessionId={data.session.id} />
        </View>

        {/* ── 6 · CONSTATS ────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(5)}>
          <SectionHeader eyebrow="CONSTATS" title="Les lectures approfondies" />
          <ConstatsSection
            insights={data.insights}
            ggPoints={data.ggPoints}
            flowPoints={data.flowPoints}
            insightsFailed={data.failed.constats === true}
            sessionId={data.session.id}
            tourReference={tourReference}
            segments={data.segments}
          />
        </View>

        {/* ── 7 · CŒUR ────────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(6)}>
          <SectionHeader eyebrow="CŒUR" />
          <CoeurSection />
        </View>

        {/* ── 8 · CONDITIONS ──────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(7)}>
          <SectionHeader eyebrow="CONDITIONS" />
          <ConditionsSection
            weather={data.weather}
            correlation={data.correlation}
            failed={data.failed.conditions === true || data.failed.weather === true}
            onRetry={reload}
          />
        </View>

        {/* ── Pied — comparer / bilan ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.footerAccent}>
            <ListRow
              icon="data"
              label="Comparer cette séance"
              sublabel="Choisir une autre séance en regard"
              divider={false}
              onPress={() => router.navigate('/(app2)/data' as never)}
              accessibilityLabel="Comparer cette séance à une autre"
            />
          </View>
          {/*
            PAS DE SORTIE VERS LE BILAN — le plan de montage l'écrit dans les
            deux sens : « Le Bilan […] une seule sortie : la Séance » et « La
            Séance […] aucune sortie vers le Bilan ».

            La circulation voulue est à sens unique : on entre par le Bilan, lu
            debout au paddock, et on descend vers la Séance, lue assise. Un lien
            de retour refermerait la boucle et effacerait cette intention. Le
            geste arrière suffit.
          */}
        </View>
      </Animated.ScrollView>

      {/* Barre condensée (fond blur) + rail d'ancres collant dessous. */}
      <CondensingHeaderBar condensedStyle={condensedStyle} height={headerH} />
      <HeaderFixed headerH={headerH} insetsTop={insets.top} title={metaLine} />
      <View style={[styles.rail, { top: railTop }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railContent}
        >
          {ANCHORS.map((a, i) => (
            <Chip
              key={a.key}
              label={a.label}
              active={activeAnchor === i}
              onPress={() => goToAnchor(i)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Header fixe — retour + méta mono, toujours tappable.
// ═══════════════════════════════════════════════════════════════════════════

function HeaderFixed({
  headerH,
  insetsTop,
  title,
}: {
  headerH: number;
  insetsTop: number;
  title: string;
}) {
  return (
    <View style={[styles.headerFixed, { height: headerH, paddingTop: insetsTop }]}>
      <PressScale
        onPress={() => router.back()}
        accessibilityLabel="Retour"
        // Glyphe de 20 pt : hitSlop 12 pour atteindre la cible de 44 pt.
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <SvgPath
            d="M15 5 L8.5 12 L15 19"
            stroke={colors.text.hi}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </PressScale>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title || 'SÉANCE'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · RÉSUMÉ — ChronoHero + stats hairline.
// ═══════════════════════════════════════════════════════════════════════════

function ResumeSection({ session, laps }: { session: TelemetrySession; laps: Lap[] }) {
  // Chrono de référence : best_lap_seconds si présent, sinon le meilleur tour lu.
  const bestFromLaps = useMemo(() => {
    const valid = laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0);
    if (valid.length === 0) return null;
    return Math.min(...valid.map(lapMs));
  }, [laps]);
  const bestMs =
    session.best_lap_seconds !== null ? Math.round(session.best_lap_seconds * 1000) : bestFromLaps;

  const tours = laps.length > 0 ? laps.length : session.lap_count;
  // distance_km arrive en STRING depuis PostgREST (colonne numeric) : Number()
  // avant toFixed, sinon .toFixed n'existe pas sur une string → crash au rendu.
  const distance =
    session.distance_km !== null
      ? `${Number(session.distance_km).toFixed(1).replace('.', ',')} km`
      : '—';
  const vmax = session.max_speed_kmh !== null ? `${Math.round(session.max_speed_kmh)} km/h` : '—';

  /**
   * POURQUOI CES CHIFFRES SONT ABSENTS.
   *
   * Ces quatre nombres imprimaient « — » sans un mot. Ce sont pourtant les
   * premiers que le pilote regarde en rouvrant sa séance, et les seuls qu'il
   * verra si la capture a mal tourné.
   *
   * Le mécanisme existait pour les LECTURES (`disponibilite.ts`, six raisons
   * nommées, rendues à l'écran) et s'arrêtait là. Chaque phrase est adossée à
   * un champ réel — `total_frames`, `lap_count`, `status` — et vaut `null`
   * quand aucune règle ne s'applique : on ne fabrique pas une raison.
   */
  const raisons = raisonsResume(session, laps.length, {
    chrono: bestMs !== null,
    tours: tours > 0,
    distance: distance !== '—',
    vmax: vmax !== '—',
  });

  /**
   * LA RÉSERVE SUR LA RÉFÉRENCE (module M05) — la « décision permise ».
   *
   * Le chrono affiché au-dessus est le meilleur temps de la séance. Quand ce
   * meilleur temps BRUT porte une réserve — une sortie de stands, un écart net,
   * une mesure trouée —, le module la dit en un fait chiffré. C'est le pilote
   * qui décide ensuite si ce chrono le représente : choisir une référence
   * pertinente n'est pas choisir la plus rapide.
   *
   * Rien n'est masqué et rien n'est corrigé : le chiffre reste, la réserve se
   * pose à côté.
   */
  const reserve = useMemo(
    () => evaluerTours(versToursMesure(laps)).reference?.reserve ?? null,
    [laps]
  );

  return (
    <View style={styles.resumeCard}>
      <Text style={styles.resumeEyebrow}>TOUR DE RÉFÉRENCE</Text>
      {bestMs !== null ? (
        <ChronoHero chronoMs={bestMs} size="l" />
      ) : (
        <>
          <Text style={styles.resumeNoChrono}>—</Text>
          {raisons.chrono ? <Text style={styles.resumeRaison}>{raisons.chrono}</Text> : null}
        </>
      )}
      {reserve !== null ? <Text style={styles.resumeReserve}>{reserve}</Text> : null}
      <View style={styles.hairlineRow}>
        <StatCell
          label="Tours"
          value={tours > 0 ? String(tours) : '—'}
          raison={raisons.tours ?? undefined}
          style={styles.hairlineCell}
        />
        <StatCell
          label="Distance"
          value={distance}
          raison={raisons.distance ?? undefined}
          style={styles.hairlineCell}
        />
        <StatCell
          label="Vitesse maxi"
          value={vmax}
          raison={raisons.vmax ?? undefined}
          style={styles.hairlineCell}
        />
      </View>
    </View>
  );
}

/** Libellés UI des niveaux de confiance — vocabulaire unique de l'écran. */
const LIBELLE_CONFIANCE: Record<NiveauConfiance, string> = {
  haute: 'Confiance haute',
  moyenne: 'Confiance moyenne',
  faible: 'Confiance faible',
};

/**
 * Confiance de MESURE du tour de référence (module M03+, `confianceLogic`).
 *
 * Une ligne : la note (la PIRE zone mesurée, jamais une moyenne) et sa
 * couverture — et une feuille qui donne les MOTIFS, zone par zone. Jamais une
 * note seule : un score opaque n'apprend rien et ne se conteste pas.
 *
 * La position curviligne des trames est DÉRIVÉE (∫ v dt, `confianceSource`) ;
 * une trame sans vitesse est « non située », comptée, jamais placée.
 */
function ConfianceMesure({
  sessionId,
  lapNumber,
}: {
  sessionId: string;
  /** Tour de référence. null = rien de chronométré, rien à noter. */
  lapNumber: number | null;
}) {
  const [etat, setEtat] = useState<'charge' | 'pret' | 'erreur'>('charge');
  const [confiance, setConfiance] = useState<ConfianceTour | null>(null);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (lapNumber === null) return;
    let annule = false;
    setEtat('charge');
    loadTramesQualiteTour(sessionId, lapNumber)
      .then((lignes) => {
        if (annule) return;
        const trames = versTramesQualite(lignes);
        const longueur = longueurDerivee(trames);
        // Sans trame située, il n'y a rien à découper ni à noter : l'absence
        // se dit en clair, elle ne devient pas une « confiance faible ».
        setConfiance(
          trames.length > 0 && longueur !== null
            ? evaluerConfianceTour(trames, decouperZones(longueur))
            : null
        );
        setEtat('pret');
      })
      .catch(() => {
        if (!annule) setEtat('erreur');
      });
    return () => {
      annule = true;
    };
  }, [sessionId, lapNumber]);

  // Pas de tour de référence : le Résumé dit déjà pourquoi. Rien à noter ici.
  if (lapNumber === null) return null;
  // Pas de spinner (doctrine) : la ligne apparaît quand elle sait.
  if (etat === 'charge') return null;

  if (etat === 'erreur' || confiance === null) {
    return (
      <Text style={styles.confianceAbsence}>
        {etat === 'erreur'
          ? 'Confiance de mesure non évaluée — les trames n’ont pas pu être lues.'
          : `Confiance de mesure non évaluée — aucune trame exploitable sur le tour ${lapNumber}.`}
      </Text>
    );
  }

  const libelle = LIBELLE_CONFIANCE[confiance.confiance];
  // Les zones qui expliquent la note : celles en confiance réduite ou sans
  // trame. Les zones hautes n'ont rien à dire — leur silence est la norme.
  const zonesReduites = confiance.zones.filter((z) => z.niveau !== 'haute');

  return (
    <View style={styles.confianceBloc}>
      <ListRow
        label="Confiance de mesure"
        sublabel={`Tour ${lapNumber} · couverture ${Math.round(confiance.couverturePct)} %`}
        value={libelle}
        divider={false}
        onPress={() => {
          haptic('tap');
          setOuvert(true);
        }}
        accessibilityLabel={`Confiance de mesure du tour ${lapNumber} : ${libelle.toLowerCase()}. Voir les motifs.`}
      />
      <Sheet visible={ouvert} onClose={() => setOuvert(false)} snapHeight={520}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SectionHeader eyebrow="CONFIANCE DE MESURE" title={libelle} />
          <Text style={styles.sheetNote}>
            {`Tour ${lapNumber} · couverture ${Math.round(
              confiance.couverturePct
            )} %. La note du tour est celle de sa zone la plus fragile — jamais une moyenne.`}
          </Text>
          {confiance.motifs.length > 0 ? (
            confiance.motifs.map((m) => (
              <Text key={m} style={styles.confianceMotif}>{`— ${m}`}</Text>
            ))
          ) : (
            <Text style={styles.confianceMotif}>
              Aucun motif de réserve sur les zones mesurées.
            </Text>
          )}
          {zonesReduites.length > 0 ? (
            <>
              <SectionHeader eyebrow="ZONE PAR ZONE" />
              {zonesReduites.map((z) => (
                <View key={z.zone.nom} style={styles.confianceZone}>
                  <Text style={styles.confianceZoneTitre}>
                    {`${z.zone.nom} · ${
                      z.niveau !== null ? LIBELLE_CONFIANCE[z.niveau] : 'non mesurée'
                    }`}
                  </Text>
                  {z.motifs.map((m) => (
                    <Text key={m} style={styles.confianceMotif}>{`— ${m}`}</Text>
                  ))}
                </View>
              ))}
            </>
          ) : null}
          <Text style={styles.sheetNote}>
            {`Note calculée sur les canaux de qualité du boîtier (précision GPS, géométrie satellitaire, satellites, trous de liaison), le tour étant découpé en zones de distance. Seuils v${VERSION_CONFIANCE_ZONE}, à valider sur piste.`}
          </Text>
        </ScrollView>
      </Sheet>
    </View>
  );
}

/** Motifs d'écart du module M06, rendus en français accentué à l'écran. */
const LIBELLE_MOTIF_ECARTE: Record<string, string> = {
  'non chronometre': 'non chronométré',
  invalide: 'invalide',
  'tour de stand': 'tour de stand',
  chauffe: 'chauffe',
};

/**
 * Tendance de la séance (module M06, `progressionLogic`) : le libellé factuel
 * du module, l'amplitude estimée et le compte des tours retenus — et ce qui a
 * été écarté, avec ses motifs. Le fait, jamais la cause.
 */
function TendanceTours({ laps }: { laps: Lap[] }) {
  const tendance = useMemo(
    () =>
      calculeTendanceSession(
        laps.map((l) => ({
          index: l.lap_number,
          tempsMs: l.duration_seconds > 0 ? lapMs(l) : null,
          valide: true,
          tags: [...(l.is_outlap ? ['outlap'] : []), ...(l.is_inlap ? ['inlap'] : [])],
        }))
      ),
    [laps]
  );

  // Aucun tour : la section Tours affiche déjà son vide honnête.
  if (laps.length === 0) return null;

  const amplitude =
    tendance.amplitudeMs !== null
      ? `amplitude ${tendance.amplitudeMs >= 0 ? '+' : ''}${Math.round(tendance.amplitudeMs)} ms`
      : null;
  const retenus = `${tendance.toursRetenus} ${
    tendance.toursRetenus > 1 ? 'tours retenus' : 'tour retenu'
  }`;
  const motifsEcartes = [...new Set(tendance.toursEcartes.map((t) => t.motif))]
    .map((m) => LIBELLE_MOTIF_ECARTE[m] ?? m)
    .join(', ');
  const ecartes =
    tendance.toursEcartes.length > 0
      ? `${tendance.toursEcartes.length} écarté${
          tendance.toursEcartes.length > 1 ? 's' : ''
        } (${motifsEcartes})`
      : null;

  return (
    <View style={styles.tendanceBloc}>
      <Text style={styles.legendMono}>TENDANCE DE LA SÉANCE</Text>
      <Text style={styles.tendanceLibelle}>{tendance.libelle}</Text>
      <Text style={styles.tendanceDetail}>
        {[amplitude, retenus, ecartes].filter(Boolean).join(' · ')}
      </Text>
      <Text style={styles.tendanceNote}>
        Tendance estimée sur les temps au tour retenus (médiane des pentes de paires) ; les tours de
        stand et de chauffe n’entrent pas dans le calcul.
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · TOURS — histogramme Skia (une barre par tour, hauteur = temps).
// ═══════════════════════════════════════════════════════════════════════════

const BARS_HEIGHT = 150;

function ToursSection({
  laps,
  failed,
  selectedLap,
  onSelect,
  onRetry,
  sessionId,
  lecteurId,
}: {
  laps: Lap[];
  failed: boolean;
  selectedLap: number | null;
  onSelect: (n: number | null) => void;
  onRetry: () => void;
  sessionId: string;
  /** L'utilisateur courant, ou `null` : il distingue MA marque de celle d'un tiers. */
  lecteurId: string | null;
}) {
  const [width, setWidth] = useState(0);

  /**
   * Le verdict par tour (module M05) — un classement et, s'il y a lieu, les
   * FAITS qui l'ont produit. La machine ne déclare pas une cause : elle dit
   * « 8,4 s au-dessus de la médiane des tours propres », pas « trafic ».
   *
   * Il est calculé sur TOUS les tours, y compris ceux sans temps exploitable —
   * l'histogramme n'en montre qu'une partie, mais un tour non chronométré reste
   * un fait de la séance. La correspondance se fait par `lap_number`.
   */
  const validation = useMemo(() => evaluerTours(versToursMesure(laps)), [laps]);
  const verdictParTour = useMemo(
    () => new Map(validation.tours.map((t) => [t.index, t])),
    [validation]
  );

  /**
   * LA DEUXIÈME VOIX — ce que le pilote ou son coach a DÉCLARÉ sur un tour
   * (`lap_marks`, migration du 25/08/2026).
   *
   * Elle ne corrige pas la première. Un tour peut porter à la fois « 8,4 s
   * au-dessus de la médiane » (la machine doute) et « Gêné par le trafic »
   * (l'humain nomme) : ce sont deux informations, pas deux versions d'une
   * seule. `marquesTourLogic` les assemble sans jamais qu'une efface l'autre.
   *
   * Un échec de lecture rend une liste vide : l'écran montre alors les faits de
   * la machine seuls — ce qui reste vrai — plutôt que de tomber en panne.
   */
  const [marques, setMarques] = useState<MarqueTourPosee[]>([]);
  const [declarationOuverte, setDeclarationOuverte] = useState(false);
  const [genreChoisi, setGenreChoisi] = useState<GenreMarqueTour | null>(null);
  const [motifSaisi, setMotifSaisi] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [refusDeclaration, setRefusDeclaration] = useState<string | null>(null);

  /**
   * Le registre se relit après chaque écriture. Un compteur plutôt qu'un appel
   * direct : la relecture passe par l'effet, qui porte déjà le garde-fou de
   * démontage — un écran quitté pendant la requête ne réveille pas un état mort.
   */
  const [relecture, setRelecture] = useState(0);
  const rechargerMarques = useCallback(() => setRelecture((n) => n + 1), []);

  useEffect(() => {
    let vivant = true;
    void listerMarquesSeance(sessionId).then((m) => {
      if (vivant) setMarques(m);
    });
    return () => {
      vivant = false;
    };
  }, [sessionId, relecture]);

  /**
   * La correspondance numéro de tour ↔ ligne en base. M05 raisonne en
   * `lap_number`, `lap_marks` pointe un `lap_id` : sans cette table, aucune
   * marque ne retrouve son tour.
   */
  const lectures = useMemo(
    () =>
      composerLecturesTours({
        tours: validation.tours,
        identites: laps.map((l) => ({ index: l.lap_number, lapId: l.id })),
        marques,
        lecteurId,
      }),
    [validation, laps, marques, lecteurId]
  );
  const lectureParTour = useMemo(
    () => new Map<number, LectureTour>(lectures.tours.map((t) => [t.index, t])),
    [lectures]
  );

  const bars = useMemo(() => {
    const valid = laps.filter((l) => l.duration_seconds > 0);
    return valid.map((l) => ({ lapNumber: l.lap_number, ms: lapMs(l), isBest: l.is_best_lap }));
  }, [laps]);

  const bestMs = useMemo(() => {
    if (bars.length === 0) return null;
    return Math.min(...bars.map((b) => b.ms));
  }, [bars]);

  const selected = useMemo(
    () => bars.find((b) => b.lapNumber === selectedLap) ?? null,
    [bars, selectedLap]
  );

  if (failed) {
    return (
      <StateView state="error" errorMessage="Les tours n'ont pas pu être lus." onRetry={onRetry} />
    );
  }
  if (bars.length === 0) {
    return <StateView state="empty" emptyMessage="Aucun tour complet capté pour cette séance." />;
  }

  // Échelle : on étale l'écart min→max pour rendre les différences lisibles.
  const minMs = Math.min(...bars.map((b) => b.ms));
  const maxMs = Math.max(...bars.map((b) => b.ms));
  const range = Math.max(1, maxMs - minMs);
  const slot = width > 0 ? width / bars.length : 0;
  const barW = slot > 0 ? Math.max(3, slot * 0.62) : 0;

  /** Un tour dont le module a quelque chose à dire : il s'atténue dans les barres. */
  const estAttenue = (lapNumber: number): boolean => {
    const c = verdictParTour.get(lapNumber)?.classement;
    return c === 'suspect' || c === 'hors_chrono';
  };
  const verdictSelection = selectedLap !== null ? verdictParTour.get(selectedLap) : undefined;
  const marquesSelection = ligneMarques(verdictSelection);
  const desToursMarques = bars.some((b) => estAttenue(b.lapNumber));

  /**
   * La lecture humaine du tour isolé. Elle s'affiche SOUS la ligne de la
   * machine, jamais à sa place : les deux voix se lisent ensemble.
   */
  const lectureSelection = selectedLap !== null ? lectureParTour.get(selectedLap) : undefined;
  const declarationsSelection = lectureSelection?.ligneDeclarations ?? null;
  const lapIdSelection = lectureSelection?.lapId ?? null;

  /**
   * Ouvrir, c'est repartir d'une feuille blanche. Un brouillon conservé d'une
   * ouverture à l'autre finirait posé sur un AUTRE tour que celui pour lequel
   * il a été écrit — le genre d'erreur qu'on ne voit qu'une fois enregistrée.
   */
  const ouvrirDeclaration = () => {
    setGenreChoisi(null);
    setMotifSaisi('');
    setRefusDeclaration(null);
    setDeclarationOuverte(true);
  };

  /**
   * Poser : un genre choisi, un mot facultatif, un geste explicite. Le genre ne
   * s'envoie pas au simple toucher de sa ligne — une déclaration se relit six
   * mois plus tard, elle ne doit pas partir d'un doigt qui défile.
   *
   * Le refus vient du serveur et se lit tel quel : marque déjà posée, séance
   * d'autrui, tour disparu. L'écran n'en devine aucun — la RLS arbitre, et le
   * seul geste qu'on ne propose jamais est celui qu'on SAIT refusé (le retrait
   * de la déclaration d'un tiers).
   */
  const poser = () => {
    if (genreChoisi === null || lapIdSelection === null || enCours) return;
    const motif = motifSaisi.trim();
    setEnCours(true);
    setRefusDeclaration(null);
    void poserMarque({
      lapId: lapIdSelection,
      sessionId,
      genre: genreChoisi,
      motif: motif.length > 0 ? motif : null,
    }).then((r) => {
      setEnCours(false);
      if (!r.ok) {
        setRefusDeclaration(r.erreur ?? 'La déclaration n’a pas pu être posée.');
        return;
      }
      haptic('tap');
      setGenreChoisi(null);
      setMotifSaisi('');
      rechargerMarques();
    });
  };

  /**
   * RETIRER, JAMAIS MODIFIER. La table n'a aucune politique UPDATE : une
   * déclaration ne se corrige pas, elle se retire et se repose. La commande
   * n'est offerte que sur ses propres marques — la RLS n'en autorise pas
   * d'autres, et proposer le geste serait promettre un refus.
   */
  const retirer = (marqueId: string) => {
    if (enCours) return;
    setEnCours(true);
    setRefusDeclaration(null);
    void retirerMarque(marqueId).then((r) => {
      setEnCours(false);
      if (!r.ok) {
        setRefusDeclaration(r.erreur ?? 'La déclaration n’a pas pu être retirée.');
        return;
      }
      haptic('tap');
      rechargerMarques();
    });
  };

  const onTapX = (x: number) => {
    if (slot <= 0) return;
    const idx = clamp(Math.floor(x / slot), 0, bars.length - 1);
    const lap = bars[idx].lapNumber;
    haptic('tap');
    onSelect(selectedLap === lap ? null : lap);
  };
  const tap = Gesture.Tap().onEnd((e) => {
    runOnJS(onTapX)(e.x);
  });

  return (
    <View>
      {/* Ligne de tête : le tour sélectionné, son chrono, son écart au réf. */}
      <View style={styles.toursHead}>
        {selected && bestMs !== null ? (
          <Text style={styles.toursHeadText}>
            {`Tour ${selected.lapNumber} · ${formatChronoMs(selected.ms)}`}
            {selected.ms > bestMs ? (
              <Text style={styles.toursDelta}>{`  ${formatDeltaMs(selected.ms - bestMs)}`}</Text>
            ) : (
              <Text style={styles.toursRef}> référence</Text>
            )}
          </Text>
        ) : (
          <Text style={styles.toursHint}>Touchez une barre pour isoler un tour.</Text>
        )}
        {/*
          Ce que le module a relevé SUR CE TOUR — le fait, jamais la cause. Un
          tour propre sans marque n'ajoute rien : le silence est sa réponse.
        */}
        {marquesSelection !== null ? (
          <Text style={styles.toursMarques}>{marquesSelection}</Text>
        ) : null}
        {/*
          LA DEUXIÈME VOIX, SOUS LA PREMIÈRE — jamais à sa place. Ce que la
          machine a relevé reste au-dessus, mot pour mot, même quand un humain
          a nommé la cause : la déclaration s'ajoute, elle ne corrige pas.
        */}
        {declarationsSelection !== null ? (
          <Text style={styles.toursDeclarations}>{declarationsSelection}</Text>
        ) : null}
        {/*
          UNE LIGNE, PAS UN BOUTON. Déclarer n'est pas l'action de l'écran —
          l'écran sert à LIRE la séance. La commande se tient à hauteur de la
          lecture, discrète, et n'appelle personne : celui qui n'a rien à dire
          d'un tour n'a rien à faire ici.
        */}
        {selectedLap !== null && lapIdSelection !== null ? (
          <ListRow
            label="Déclarer"
            sublabel="Ce que vous, vous en dites"
            divider={false}
            disabled={enCours}
            onPress={ouvrirDeclaration}
            accessibilityLabel={`Déclarer sur le tour ${selectedLap}`}
            style={styles.toursDeclarerLigne}
          />
        ) : null}
      </View>

      <GestureDetector gesture={tap}>
        {/* Le Canvas Skia n'est atteignable qu'au doigt : sans alternative, un
            lecteur d'écran ne peut JAMAIS isoler un tour — alors que ce choix
            pilote le Tracé et la Télémétrie. `adjustable` + increment/decrement
            passent par `onSelect`, la voie existante : aucun calcul changé. */}
        <View
          style={{ height: BARS_HEIGHT }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Tours de la séance"
          accessibilityValue={{
            text: selected
              ? [
                  `Tour ${selected.lapNumber}, ${formatChronoMs(selected.ms)}`,
                  // Les faits du module, sans répéter le numéro du tour.
                  verdictSelection !== undefined && verdictSelection.marques.length > 0
                    ? `${LIBELLE_CLASSEMENT[verdictSelection.classement]} — ${verdictSelection.marques
                        .map((m) => m.fait)
                        .join(' ; ')}`
                    : null,
                ]
                  .filter(Boolean)
                  .join('. ')
              : 'Aucun tour isolé',
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const i = bars.findIndex((b) => b.lapNumber === selectedLap);
            const next = e.nativeEvent.actionName === 'increment' ? i + 1 : i - 1;
            if (next >= 0 && next < bars.length) onSelect(bars[next].lapNumber);
          }}
        >
          {width > 0 ? (
            <Canvas style={{ width, height: BARS_HEIGHT }}>
              {bars.map((b, i) => {
                // Barre courte = tour rapide : hauteur inversée sur l'écart.
                const t = (b.ms - minMs) / range;
                const h = lerp(BARS_HEIGHT * 0.9, BARS_HEIGHT * 0.28, t);
                const x = i * slot + (slot - barW) / 2;
                const y = BARS_HEIGHT - h;
                const isSelected = b.lapNumber === selectedLap;
                const fill = isSelected
                  ? colors.accent
                  : b.isBest
                    ? colors.bg.card2
                    : colors.border.strong;
                /*
                  MESURE DOUTEUSE = BARRE ATTÉNUÉE, PAS UNE COULEUR DE PLUS.
                  Le tour suspect ou hors chronométrage recule d'un demi-ton :
                  il reste lisible, il n'est ni effacé ni disqualifié. Aucune
                  teinte n'est introduite — le rouge demeure la SÉLECTION, l'or
                  demeure la référence, et la sélection l'emporte toujours sur
                  l'atténuation : un tour qu'on isole se voit en plein.
                */
                const opacite = !isSelected && estAttenue(b.lapNumber) ? 0.38 : 1;
                return (
                  <Group key={b.lapNumber}>
                    <Rect x={x} y={y} width={barW} height={h} color={fill} opacity={opacite} />
                    {b.isBest ? (
                      // Tour de référence : liseré or Heritage (record de séance).
                      <Rect
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        color={colors.heritage.gold}
                        style="stroke"
                        strokeWidth={1.5}
                        opacity={opacite}
                      />
                    ) : null}
                  </Group>
                );
              })}
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
      <Text style={styles.legendMono}>
        Barre courte = tour rapide. Liseré or = tour de référence.
      </Text>
      {/*
        La ligne n'apparaît QUE si des barres sont effectivement atténuées :
        une légende qui décrit ce qui n'est pas à l'écran apprend à ne plus la
        lire.
      */}
      {desToursMarques ? (
        <Text style={styles.legendMono}>
          Tour atténué : mesure douteuse — le détail au toucher.
        </Text>
      ) : null}
      {/*
        Les déclarations qu'aucun tour affiché ne réclame. Elles existent en
        base — un tour non chargé, une détection rejouée — et les taire les
        rendrait introuvables. On dit qu'il y en a, sans prétendre les situer.
      */}
      {lectures.orphelines.length > 0 ? (
        <Text style={styles.legendMono}>
          {`${lectures.orphelines.length} déclaration(s) rattachée(s) à un tour absent de cette lecture.`}
        </Text>
      ) : null}

      <Sheet
        visible={declarationOuverte}
        onClose={() => setDeclarationOuverte(false)}
        snapHeight={560}
      >
        {/* DÉFILEMENT OBLIGATOIRE — la `Sheet` rend ses enfants dans une hauteur
            fixe, et le clavier du champ de motif mange la moitié de l'écran.
            `keyboardShouldPersistTaps` : sans lui, le premier toucher sur le
            bouton de pose ne fait que refermer le clavier. */}
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <SectionHeader
            eyebrow="DÉCLARER"
            title={selectedLap !== null ? `Tour ${selectedLap}` : 'Tour'}
          />
          {/*
            Le rappel de la règle, à l'endroit exact où on pourrait croire
            l'inverse : déclarer n'efface pas la mesure. Et juste dessous, le
            fait de la machine, mot pour mot — la cohabitation se voit AVANT
            même que la déclaration soit posée.
          */}
          <Text style={styles.sheetNote}>
            Ce que vous déclarez s’ajoute au relevé de la séance. Le fait mesuré reste affiché tel
            quel.
          </Text>
          {lectureSelection !== undefined && lectureSelection.ligneMachine !== null ? (
            <Text style={styles.toursMarques}>{lectureSelection.ligneMachine}</Text>
          ) : null}

          {/*
            Les six motifs. Un toucher CHOISIT, il ne pose pas : le second
            toucher sur la même ligne défait le choix, et rien ne part tant que
            le bouton du bas n'est pas pressé.
          */}
          {GENRES_MARQUE.map((genre) => (
            <ListRow
              key={genre}
              label={LIBELLE_GENRE_MARQUE[genre]}
              value={genreChoisi === genre ? 'choisi' : undefined}
              chevron={false}
              disabled={enCours}
              onPress={() => setGenreChoisi(genreChoisi === genre ? null : genre)}
              accessibilityLabel={`${LIBELLE_GENRE_MARQUE[genre]}${
                genreChoisi === genre ? ', choisi' : ''
              }`}
            />
          ))}

          {/*
            Le mot libre est FACULTATIF et le dit. Le champ ne pose aucune
            question, ne suggère aucune formulation : la personne écrit ce
            qu'elle veut, ou rien.
          */}
          <Field
            label="Votre mot, si vous voulez"
            optional
            value={motifSaisi}
            onChangeText={setMotifSaisi}
            multiline
            maxLength={MOTIF_MAX}
            showCounter
            editable={!enCours}
            containerStyle={styles.champMotif}
          />

          <Button
            label="Poser la déclaration"
            variant="primary"
            disabled={genreChoisi === null || lapIdSelection === null || enCours}
            onPress={poser}
          />
          {refusDeclaration !== null ? (
            <Text style={styles.toursRefus}>{refusDeclaration}</Text>
          ) : null}

          {/*
            LE REGISTRE DU TOUR — dans l'ordre où les déclarations ont été
            dites. Celles d'un tiers s'y lisent sans commande de retrait : la
            RLS n'autorise que l'auteur, et proposer le geste serait promettre
            un refus.
          */}
          <SectionHeader eyebrow="DÉJÀ DÉCLARÉ" />
          {lectureSelection !== undefined && lectureSelection.declarations.length > 0 ? (
            lectureSelection.declarations.map((d) => (
              <ListRow
                key={d.id}
                label={d.libelle}
                sublabel={d.motif !== null ? `${d.motif} — ${d.origine}` : d.origine}
                divider
                right={
                  d.retirable ? (
                    <Button
                      label="Retirer"
                      variant="ghost"
                      disabled={enCours}
                      onPress={() => retirer(d.id)}
                      accessibilityLabel={`Retirer la déclaration ${d.libelle}`}
                    />
                  ) : undefined
                }
              />
            ))
          ) : (
            <Text style={styles.sheetNote}>Aucune déclaration sur ce tour.</Text>
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · TRACÉ & VIRAGES — TraceCircuit du tour + pastilles de marge + zoom.
// ═══════════════════════════════════════════════════════════════════════════

function TraceSection({
  sessionId,
  selectedLap,
  segments,
  circuitSessionIds,
  lapNumberBySession,
  initialCorner,
  pilotId,
  peutAnnoter,
  laps,
  circuitName,
  meilleurTour,
  lectureDelta,
}: {
  sessionId: string;
  selectedLap: number | null;
  segments: SegmentAnalysisRow[];
  circuitSessionIds: string[];
  lapNumberBySession: Record<string, number>;
  /** Virage à ouvrir d'emblée (ancre `?corner=`). null = aucun. */
  initialCorner?: number | null;
  /** Propriétaire de la séance — destinataire d'une éventuelle annotation. */
  pilotId: string;
  /** Le lecteur peut-il annoter ce virage ? (coach ou admin, séance d'autrui) */
  peutAnnoter: boolean;
  /** Tours de la séance — le choix de deux passages dans l'onglet TRACÉ. */
  laps: Lap[];
  /** Nom du circuit en base — sert à retrouver la corde de référence. */
  circuitName: string | null;
  /** Meilleur tour de la séance selon la base. null si non désigné. */
  meilleurTour: number | null;
  /**
   * La lecture du delta publiée par la section L'ÉCART, ou `null`. Elle sert à
   * peindre les écarts locaux sur le tracé (lot 7b) — jamais à recalculer quoi
   * que ce soit ici.
   */
  lectureDelta: LectureTraceDelta | null;
}) {
  const [trace, setTrace] = useState<{ lat: number; lon: number }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCorner, setOpenCorner] = useState<SegmentAnalysisRow | null>(null);

  // L'ancre n'ouvre le virage QU'UNE FOIS. Sans ce garde-fou, refermer la
  // feuille la rouvrirait au rendu suivant : le virage deviendrait impossible
  // à quitter tant que le paramètre est dans l'URL.
  const ancreConsommee = useRef(false);

  useEffect(() => {
    if (ancreConsommee.current) return;
    if (initialCorner === null || initialCorner === undefined) return;
    // Les segments arrivent après le premier rendu : on attend qu'ils soient là
    // plutôt que de conclure trop tôt que le virage n'existe pas.
    if (segments.length === 0) return;
    ancreConsommee.current = true;
    const cible = segments.find((s) => s.segmentIndex === initialCorner);
    // Introuvable → on ne substitue RIEN. L'écran s'ouvre sur la séance.
    if (cible && cible.startProgress !== null && cible.endProgress !== null) {
      setOpenCorner(cible);
    }
  }, [initialCorner, segments]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Tour sélectionné → ses trames ; sinon la trajectoire entière de séance.
      const frames =
        selectedLap !== null
          ? (await loadLapFrames(sessionId, selectedLap))
              .filter((f) => f.lat !== null && f.lon !== null)
              .map((f) => ({ lat: f.lat as number, lon: f.lon as number }))
          : (await loadSessionTrajectory(sessionId)).map((p) => ({ lat: p.lat, lon: p.lon }));
      if (!cancelled) {
        setTrace(frames);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setTrace([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, selectedLap]);

  // Trames de qualité du TOUR AFFICHÉ (module M03+) — pour marquer sur le
  // tracé les zones où la confiance de mesure est réduite. Séance entière :
  // rien à marquer, les zones sont un découpage DU TOUR. Échec de lecture :
  // rien non plus — le Résumé porte déjà l'information.
  const [tramesQualite, setTramesQualite] = useState<TrameQualite[] | null>(null);

  useEffect(() => {
    if (selectedLap === null) {
      setTramesQualite(null);
      return;
    }
    let cancelled = false;
    setTramesQualite(null);
    loadTramesQualiteTour(sessionId, selectedLap)
      .then((lignes) => {
        if (!cancelled) setTramesQualite(versTramesQualite(lignes));
      })
      .catch(() => {
        if (!cancelled) setTramesQualite(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, selectedLap]);

  /**
   * Zones en confiance FAIBLE (et uniquement elles), en bornes métriques le
   * long de la polyligne affichée. Le découpage prend `index.longueurTotale`
   * — la longueur de la POLYLIGNE — comme longueur de tour : une longueur
   * dérivée par télémétrie ne coïncide pas exactement avec celle du tracé, et
   * des bornes hors tracé ne se projetteraient pas. Une portion qui ne se
   * projette pas malgré tout → rien n'est marqué.
   */
  /** L'index curviligne du tracé affiché — construit une fois, lu trois fois. */
  const indexTrace = useMemo(
    () => (trace && trace.length >= 2 ? construireIndex(trace, true) : null),
    [trace]
  );

  const zonesFaibles = useMemo(() => {
    if (selectedLap === null || tramesQualite === null || tramesQualite.length === 0) return [];
    if (indexTrace === null) return [];
    const tour = evaluerConfianceTour(tramesQualite, decouperZones(indexTrace.longueurTotale));
    return tour.zones
      .filter((z) => z.niveau === 'faible')
      .map((z) => ({ debutM: z.zone.debutM, finM: z.zone.finM }));
  }, [selectedLap, tramesQualite, indexTrace]);

  const zonesAttenuees = useMemo(() => {
    if (indexTrace === null || zonesFaibles.length === 0) return [];
    return zonesFaibles.every((b) => portion(indexTrace, b.debutM, b.finM) !== null)
      ? zonesFaibles
      : [];
  }, [indexTrace, zonesFaibles]);

  /**
   * LES ÉCARTS LOCAUX, PEINTS SUR LE TRACÉ — module M07, lot 7b.
   *
   * Trois conditions, et il les faut TOUTES :
   *
   *   — un tour est affiché (la séance entière superpose des géométries que
   *     l'écart d'un tour ne décrit pas) ;
   *   — c'est LE tour que le delta a lu comme « courant ». Peindre l'écart du
   *     tour 7 sur la géométrie du tour 4 poserait des couleurs justes au
   *     mauvais endroit — le pire des défauts possibles ici ;
   *   — les portions se projettent toutes sur ce tracé. Sinon rien n'est
   *     peint : un trou muet au milieu d'une carte de couleurs se lirait
   *     « rien à signaler ».
   *
   * Les zones en confiance de mesure faible sont retirées PAR LE MODULE — une
   * mesure fragile ne porte pas de verdict de couleur.
   */
  const carte = useMemo(() => {
    if (selectedLap === null || lectureDelta === null || indexTrace === null) return null;
    if (lectureDelta.courant !== selectedLap) return null;
    return carteOpportunites({
      segments: lectureDelta.opportunites.segments,
      longueurTourM: lectureDelta.longueurTourM,
      longueurTraceM: indexTrace.longueurTotale,
      confiance: lectureDelta.opportunites.confiance,
      zonesFaiblesM: zonesFaibles,
    });
  }, [selectedLap, lectureDelta, indexTrace, zonesFaibles]);

  const portionsEcart: readonly PortionEcart[] = useMemo(() => {
    if (carte === null || indexTrace === null || carte.portions.length === 0) return [];
    return carte.portions.every((p) => portion(indexTrace, p.debutM, p.finM) !== null)
      ? carte.portions
      : [];
  }, [carte, indexTrace]);

  // Pastilles de marge : uniquement si des virages segmentés existent (honnête).
  const cornerMarkers = useMemo(
    () =>
      segments
        .filter((s) => s.startProgress !== null && s.endProgress !== null)
        .map((s) => ({
          t: clamp(((s.startProgress as number) + (s.endProgress as number)) / 2, 0, 1),
          color: marginZoneColor(s.marginZone),
        })),
    [segments]
  );

  const tappableCorners = useMemo(
    () => segments.filter((s) => s.startProgress !== null && s.endProgress !== null),
    [segments]
  );

  if (loading && trace === null) {
    return <StateView state="loading" shape="hero" />;
  }
  if (!trace || trace.length < 2) {
    return (
      <StateView
        state="empty"
        emptyMessage="Tracé indisponible — aucune trame GPS pour cette lecture."
      />
    );
  }

  return (
    <View>
      <Text style={styles.legendMono}>
        {selectedLap !== null ? `TOUR ${selectedLap}` : 'SÉANCE ENTIÈRE'}
      </Text>
      <View style={styles.traceCard}>
        <TraceCircuit
          centerline={trace}
          height={200}
          markers={cornerMarkers}
          attenues={zonesAttenuees}
          portions={portionsEcart}
        />
        {portionsEcart.length > 0 && carte !== null && lectureDelta !== null ? (
          <LegendeEcartTrace carte={carte} lecture={lectureDelta} />
        ) : null}
        {zonesAttenuees.length > 0 ? (
          <Text style={styles.legendMono}>
            Trait atténué : mesure en confiance réduite (voir Résumé).
          </Text>
        ) : null}
      </View>

      {tappableCorners.length > 0 ? (
        <View style={styles.cornerRow}>
          {tappableCorners.map((c) => (
            <PressScale
              key={c.segmentIndex}
              onPress={() => {
                haptic('tap');
                setOpenCorner(c);
              }}
              // La pastille fait ~28 pt de haut : hitSlop pour atteindre 44.
              // La zone de marge n'est sinon portée que par la couleur du point.
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityLabel={`Virage ${c.segmentName ?? c.segmentIndex}${
                c.marginZone ? `, marge ${marginLabel(c.marginZone).toLowerCase()}` : ''
              }`}
            >
              <View style={styles.cornerPill}>
                <View
                  style={[styles.cornerDot, { backgroundColor: marginZoneColor(c.marginZone) }]}
                />
                <Text style={styles.cornerPillLabel}>
                  {/*
                    PAS de `+ 1`. `segment_index` part de 1 — la base le
                    contraint (`CHECK segment_index >= 1 AND <= 7`). Ajouter un
                    décalage faisait afficher « V2 » sur le premier virage, et
                    surtout : depuis ce lot, la même feuille mène à
                    `(coach)/annoter`, qui titre le virage avec l'index BRUT.
                    Le coach lisait « Virage 5 » puis « VIRAGE 4 » dans le même
                    parcours.
                  */}
                  {c.segmentName ?? `V${c.segmentIndex}`}
                </Text>
              </View>
            </PressScale>
          ))}
        </View>
      ) : null}

      <Sheet visible={openCorner !== null} onClose={() => setOpenCorner(null)} snapHeight={480}>
        {openCorner ? (
          <CornerZoomSheet
            corner={openCorner}
            sessionId={sessionId}
            pilotId={pilotId}
            peutAnnoter={peutAnnoter}
            circuitSessionIds={circuitSessionIds}
            lapNumberBySession={lapNumberBySession}
            laps={laps}
            circuitName={circuitName}
            meilleurTour={meilleurTour}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

/**
 * LA LÉGENDE DE LA CARTE DES ÉCARTS — elle NOMME ce qu'on voit.
 *
 * Une couleur sur un tracé ne veut rien dire tant que personne ne l'a dite.
 * Trois choses sont écrites ici, et aucune n'est un jugement :
 *
 *   — À QUOI le tour est comparé. Sans le numéro du tour de référence, un
 *     écart signé ne se rapporte à rien.
 *   — CE QUE CHAQUE PÔLE SIGNIFIE, dans les mots du dépôt : « rend du temps »
 *     / « en reprend ». Pas « perd », pas « gagne ».
 *   — POURQUOI DU TRAIT RESTE NU. C'est le point le plus important : un tracé
 *     à moitié coloré laisserait croire que le reste du tour n'a rien à dire,
 *     alors qu'une partie n'est simplement pas assez sûre pour être peinte.
 *     Les comptes viennent du module, pas d'une estimation d'écran.
 */
function LegendeEcartTrace({
  carte,
  lecture,
}: {
  carte: CarteOpportunites;
  lecture: LectureTraceDelta;
}) {
  const seuilMs = Math.round(SEUIL_ECART_PEINT_S * 1000);

  const nues: string[] = [];
  if (carte.sousSeuil > 0) {
    nues.push(`${carte.sousSeuil} sous ${seuilMs} ms`);
  }
  if (carte.ecartesConfianceZone > 0) {
    nues.push(`${carte.ecartesConfianceZone} en confiance de mesure réduite`);
  }

  return (
    <View style={styles.legendeEcart}>
      <Text style={styles.legendMono}>
        {`Trait coloré : l’écart, segment par segment, avec le tour ${lecture.reference}.`}
      </Text>
      <View style={styles.legendeEcartPoles}>
        <View style={styles.legendeEcartPole}>
          <View style={[styles.legendeEcartPastille, { backgroundColor: POLES_DELTA.perd }]} />
          <Text style={styles.legendeEcartTexte}>
            {`Le tour ${lecture.courant} y rend du temps`}
          </Text>
        </View>
        <View style={styles.legendeEcartPole}>
          <View style={[styles.legendeEcartPastille, { backgroundColor: POLES_DELTA.reprend }]} />
          <Text style={styles.legendeEcartTexte}>Il y en reprend</Text>
        </View>
      </View>
      {nues.length > 0 ? (
        <Text style={styles.legendMono}>{`Trait nu : ${nues.join(' · ')}.`}</Text>
      ) : null}
    </View>
  );
}

/**
 * Contenu du zoom virage : onglet DÉTAIL (faits factuels du virage) + onglet
 * ÉVOLUTION (superposition B4, self-only, des passages passés du pilote —
 * anciens en text.dim, courant en accent).
 */
function CornerZoomSheet({
  corner,
  sessionId,
  pilotId,
  peutAnnoter,
  circuitSessionIds,
  lapNumberBySession,
  laps,
  circuitName,
  meilleurTour,
}: {
  corner: SegmentAnalysisRow;
  sessionId: string;
  pilotId: string;
  peutAnnoter: boolean;
  circuitSessionIds: string[];
  lapNumberBySession: Record<string, number>;
  /** Tours de la séance — pour le choix de deux passages dans l'onglet TRACÉ. */
  laps: Lap[];
  /** Nom du circuit tel qu'il est en base — sert à retrouver la corde. */
  circuitName: string | null;
  /** Meilleur tour de la séance selon la base. null si non désigné. */
  meilleurTour: number | null;
}) {
  const [tab, setTab] = useState<'detail' | 'trace' | 'evolution'>('detail');
  const [evolution, setEvolution] = useState<CornerEvolution | null>(null);
  const [evoStatus, setEvoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  /**
   * LA DEMANDE DÉJÀ PARTIE EST RETENUE PAR UNE RÉFÉRENCE, ET NON PAR L'ÉTAT.
   *
   * Corrigé le 04/08/2026, même défaut que l'écran d'appairage du flux REC —
   * trouvé par la garde `effetAutoAnnule.guard.test.ts` en cherchant celui-là.
   *
   * L'effet se gardait sur `evoStatus !== 'idle'` et portait `evoStatus` dans
   * ses dépendances. Il appelait `setEvoStatus('loading')` AVANT le chargement :
   * la valeur changeait, l'effet était relancé, React exécutait d'abord le
   * nettoyage du passage précédent — `cancelled = true` —, et ce passage-là
   * portait la requête en vol. Au retour, `if (!cancelled)` était faux :
   * `'ready'` n'arrivait jamais et l'onglet Évolution tournait indéfiniment.
   *
   * La clé porte l'identité de la demande. Elle change quand le virage ou les
   * séances changent, et alors seulement le chargement repart.
   */
  const cleEvolution = `${corner.startProgress}|${corner.endProgress}|${circuitSessionIds.join(',')}`;
  const evolutionDemandee = useRef<string | null>(null);

  useEffect(() => {
    if (tab !== 'evolution') return;
    if (evolutionDemandee.current === cleEvolution) return;
    evolutionDemandee.current = cleEvolution;
    if (corner.startProgress === null || corner.endProgress === null) {
      setEvolution({ passes: [] });
      setEvoStatus('ready');
      return;
    }
    let cancelled = false;
    setEvoStatus('loading');
    loadCornerEvolution(circuitSessionIds, lapNumberBySession, {
      startProgress: corner.startProgress,
      endProgress: corner.endProgress,
    })
      .then((evo) => {
        if (!cancelled) {
          setEvolution(evo);
          setEvoStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setEvoStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [tab, cleEvolution, corner, circuitSessionIds, lapNumberBySession]);

  // Index BRUT : voir la pastille plus haut. Le titre de cette feuille et celui
  // de l'écran d'annotation doivent désigner le même virage.
  const title = corner.segmentName ?? `Virage ${corner.segmentIndex}`;
  const fact = (label: string, value: string) => (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
  const km = (v: number | null) => (v !== null ? `${Math.round(v)} km/h` : '—');
  const g = (v: number | null) => (v !== null ? virgule(`${v.toFixed(2)} g`) : '—');

  return (
    // DÉFILEMENT OBLIGATOIRE — la `Sheet` du kit V2 rend ses enfants dans un
    // `View` à hauteur fixe (`snapHeight`), sans scroll ni débordement. Le
    // contenu ajouté au lot J5 — barres de G, onglet Tracé, bouton d'annotation
    // — dépasse largement les ~400 pt utiles, et ce qui déborde sort du cadre
    // du parent : invisible sur Android, jamais tappable sur iOS.
    //
    // « Annoter ce virage » est le DERNIER enfant. Sans ce ScrollView, le coach
    // ne peut pas annoter — la capacité pour laquelle ce lot existe.
    //
    // C'est le motif déjà en place pour la feuille des lectures Insight, plus
    // bas dans ce fichier, et pour celle de `club/galerie`.
    <ScrollView showsVerticalScrollIndicator={false}>
      <SectionHeader eyebrow="VIRAGE" title={title} />
      <View style={styles.tabRow}>
        <Chip label="Détail" active={tab === 'detail'} onPress={() => setTab('detail')} />
        <Chip label="Tracé" active={tab === 'trace'} onPress={() => setTab('trace')} />
        <Chip label="Évolution" active={tab === 'evolution'} onPress={() => setTab('evolution')} />
      </View>

      {tab === 'detail' ? (
        <>
          <View style={styles.factCard}>
            {fact('Vitesse d’entrée', km(corner.entrySpeedKmh))}
            {fact('Vitesse à la corde', km(corner.minSpeedKmh ?? corner.apexSpeedKmh))}
            {fact('Vitesse de sortie', km(corner.exitSpeedKmh))}
            {fact('Appui maxi en virage', g(corner.maxGLateral))}
            {corner.marginZone ? fact('Marge', marginLabel(corner.marginZone)) : null}
          </View>

          {/*
            Les trois axes de G, portés au lot J5 (décision « porter les deux »).
            La ligne « Appui maxi en virage » ci-dessus reste : le chiffre exact se lit
            en mono, les barres donnent l'équilibre entre les axes d'un coup
            d'œil. Elles décrivent le virage sur TOUTE LA SÉANCE — la table
            `app_segment_analyses` n'a pas de colonne de tour, et c'est dit sous
            le bloc plutôt que laissé à deviner.
          */}
          <SectionHeader eyebrow="CE QUE LA VOITURE A VÉCU" />
          <BarresG
            lateralG={corner.maxGLateral}
            freinageG={corner.maxGBraking}
            accelerationG={corner.maxGAccel}
          />
          <Text style={styles.sheetNote}>
            Ces trois valeurs décrivent le virage sur l&apos;ensemble de la séance : la mesure
            n&apos;existe pas tour par tour.
          </Text>
        </>
      ) : tab === 'trace' ? (
        <TraceVirageOnglet
          corner={corner}
          sessionId={sessionId}
          laps={laps}
          circuitName={circuitName}
          meilleurTour={meilleurTour}
        />
      ) : evoStatus === 'loading' || evoStatus === 'idle' ? (
        <StateView state="loading" shape="hero" />
      ) : evoStatus === 'error' ? (
        <StateView state="error" errorMessage="Superposition indisponible." />
      ) : evolution && evolution.passes.length >= 2 ? (
        <CornerEvolutionCanvas evolution={evolution} />
      ) : (
        <StateView
          state="empty"
          emptyMessage="Pas encore assez de passages sur ce virage pour une superposition."
        />
      )}

      {/*
        L'ACTION DU COACH, DANS L'ÉCRAN DU PILOTE (lot J5, décision fondateur du
        29/07/2026 : « ancre partagée, l'action apparaissant selon le rôle »).

        C'était la seule capacité que `app/(app)/virage.tsx` détenait en propre :
        désigner LE virage sur lequel une note se pose. Une note est classée par
        virage en base ; ouvrir l'éditeur sans en désigner un ferait partir la
        note sur le premier venu.

        Le pilote ne voit rien de tout cela : il lit son virage.
      */}
      {peutAnnoter ? (
        <View style={styles.annoterAction}>
          <Button
            label="Annoter ce virage"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/(coach)/annoter',
                params: {
                  pilotId,
                  cornerIndex: String(corner.segmentIndex),
                  sessionId,
                },
              } as never)
            }
            accessibilityLabel={`Annoter ${title}`}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * Onglet TRACÉ du zoom virage — le passage dessiné, et le choix d'un second.
 *
 * Décision fondateur du 29/07/2026 : « ajouter le choix de deux tours à la
 * feuille » plutôt que porter l'écran `virage-comparer` en entier.
 *
 * Le tour A est celui de référence de la séance (`best_lap_number`), sinon le
 * premier tour chronométré. Le tour B est facultatif : sans lui, on lit un
 * passage ; avec lui, deux passages se superposent — sans vainqueur, sans
 * écart peint.
 *
 * Les tours d'entrée et de sortie de piste sont écartés du choix : ils ne
 * décrivent pas un passage en virage.
 */
function TraceVirageOnglet({
  corner,
  sessionId,
  laps,
  circuitName,
  meilleurTour,
}: {
  corner: SegmentAnalysisRow;
  sessionId: string;
  laps: Lap[];
  circuitName: string | null;
  /** Meilleur tour de la séance selon la base. null si non désigné. */
  meilleurTour: number | null;
}) {
  const chronometres = useMemo(
    () =>
      laps.filter((l) => !l.is_outlap && !l.is_inlap).sort((a, b) => a.lap_number - b.lap_number),
    [laps]
  );

  const [tourA, setTourA] = useState<number | null>(null);
  const [tourB, setTourB] = useState<number | null>(null);
  const [tramesA, setTramesA] = useState<SessionFrame[] | null>(null);
  const [tramesB, setTramesB] = useState<SessionFrame[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [echec, setEchec] = useState(false);

  // Choix initial : le MEILLEUR tour de la séance quand la base le désigne,
  // sinon le premier chronométré. On ne présente jamais un tour quelconque
  // comme une référence — c'est aussi ce qui décide de la couleur du tracé.
  useEffect(() => {
    if (tourA !== null || chronometres.length === 0) return;
    const meilleur =
      meilleurTour !== null && chronometres.some((l) => l.lap_number === meilleurTour)
        ? meilleurTour
        : chronometres[0].lap_number;
    setTourA(meilleur);
  }, [chronometres, tourA, meilleurTour]);

  useEffect(() => {
    if (tourA === null) return;
    let annule = false;
    setChargement(true);
    setEchec(false);
    Promise.all([
      loadLapFrames(sessionId, tourA),
      tourB !== null ? loadLapFrames(sessionId, tourB) : Promise.resolve<SessionFrame[]>([]),
    ])
      .then(([a, b]) => {
        if (annule) return;
        setTramesA(a);
        setTramesB(tourB !== null ? b : null);
      })
      .catch(() => {
        if (!annule) setEchec(true);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [sessionId, tourA, tourB]);

  // La corde de référence dépend du CIRCUIT réel de la séance. Circuit inconnu
  // → pas de corde, donc pas d'apex marqué : aucun point n'est placé au hasard.
  const corde = useMemo(() => {
    const topo = getCornerDuCircuit(corner.segmentIndex, circuitName);
    return topo ? { lat: topo.apexLat, lon: topo.apexLon } : null;
  }, [corner.segmentIndex, circuitName]);

  // Mémorisé : un objet recréé à chaque rendu invaliderait les deux découpes
  // ci-dessous, qui reparcourraient les trames pour rien à chaque frappe.
  const fenetre = useMemo(
    () =>
      corner.startProgress !== null && corner.endProgress !== null
        ? { start: corner.startProgress, end: corner.endProgress }
        : null,
    [corner.startProgress, corner.endProgress]
  );

  const trancheA = useMemo(
    () => (tramesA ? trancheVirage(tramesA, fenetre, corde) : null),
    [tramesA, fenetre, corde]
  );
  const trancheB = useMemo(
    () => (tramesB ? trancheVirage(tramesB, fenetre, corde) : null),
    [tramesB, fenetre, corde]
  );

  if (chronometres.length === 0) {
    return (
      <StateView
        state="empty"
        emptyMessage="Aucun tour chronométré sur cette séance : rien à dessiner."
      />
    );
  }

  return (
    <View>
      <Text style={styles.sheetNote}>Tour lu</Text>
      <View style={styles.choixTours}>
        {chronometres.map((l) => (
          <Chip
            key={`a-${l.lap_number}`}
            label={`T${l.lap_number}`}
            active={tourA === l.lap_number}
            onPress={() => {
              // Un tour ne se compare pas à lui-même : on libère l'autre côté.
              if (tourB === l.lap_number) setTourB(null);
              setTourA(l.lap_number);
            }}
          />
        ))}
      </View>

      <Text style={styles.sheetNote}>Comparer à (facultatif)</Text>
      <View style={styles.choixTours}>
        <Chip label="Aucun" active={tourB === null} onPress={() => setTourB(null)} />
        {chronometres
          .filter((l) => l.lap_number !== tourA)
          .map((l) => (
            <Chip
              key={`b-${l.lap_number}`}
              label={`T${l.lap_number}`}
              active={tourB === l.lap_number}
              onPress={() => setTourB(l.lap_number)}
            />
          ))}
      </View>

      {echec ? (
        <StateView state="error" errorMessage="Les trames de ce virage n'ont pas pu être lues." />
      ) : chargement || trancheA === null ? (
        <StateView state="loading" shape="hero" />
      ) : (
        <TraceVirage
          reference={trancheA}
          compare={trancheB}
          referenceEstMeilleurTour={tourA !== null && tourA === meilleurTour}
          labelReference={
            tourA !== null
              ? tourA === meilleurTour
                ? `Tour ${tourA} — meilleur`
                : `Tour ${tourA}`
              : 'Tour lu'
          }
          labelCompare={tourB !== null ? `Tour ${tourB}` : 'Tour comparé'}
        />
      )}
    </View>
  );
}

/** Étiquette humaine d'une zone de marge (doctrine « marge », pas « limite »). */
function marginLabel(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return 'Confortable';
    case 'yellow':
      return 'À explorer';
    case 'red':
      return 'Terrain serré';
  }
}

/** Superposition des passages d'un virage — anciens estompés, courant accentué. */
function CornerEvolutionCanvas({ evolution }: { evolution: CornerEvolution }) {
  const [width, setWidth] = useState(0);
  const H = 220;
  const PAD = 16;

  const paths = useMemo(() => {
    if (width <= 0) return [];
    return evolution.passes.map((pass) => {
      // Points normalisés [0..1] (y = latitude, vers le haut) → boîte px.
      const pts = pass.points.map((p) => ({
        x: PAD + p.x * (width - 2 * PAD),
        y: H - PAD - p.y * (H - 2 * PAD),
      }));
      return { d: polylineToPathD(pts), isCurrent: pass.isCurrent };
    });
  }, [evolution, width]);

  return (
    <View>
      <Text style={styles.legendMono}>
        {`${evolution.passes.length} passages — le plus récent en avant`}
      </Text>
      <View style={{ height: H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Canvas
            style={{ width, height: H }}
            accessible
            accessibilityLabel={`Superposition des passages, ${evolution.passes.length} tracés`}
          >
            {paths.map((p, i) =>
              p.d !== '' ? (
                <Path
                  key={i}
                  path={p.d}
                  style="stroke"
                  strokeWidth={p.isCurrent ? 3 : 1.5}
                  strokeCap="round"
                  strokeJoin="round"
                  color={p.isCurrent ? colors.accent : colors.text.dim}
                />
              ) : null
            )}
          </Canvas>
        ) : null}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · LES MESURES — onglets internes Appuis / Au fil du tour / Sur le tracé /
//     Rejouer. Les quatre portaient du jargon, dont deux mots anglais :
//     dernier verrou du jalon 5 (« QDI et vocabulaire technique »).
// ═══════════════════════════════════════════════════════════════════════════

type TeleTab = 'gg' | 'canaux' | 'heatmap' | 'replay';

function TelemetrieSection({ sessionId }: { sessionId: string }) {
  const [tab, setTab] = useState<TeleTab>('gg');
  const [gg, setGg] = useState<{ gLat: number; gLong: number; speedKmh: number | null }[] | null>(
    null
  );
  const [speed, setSpeed] = useState<{ progress: number; speedKmh: number }[] | null>(null);
  const [brake, setBrake] = useState<{ progress: number; gLong: number }[] | null>(null);
  const [traj, setTraj] = useState<TrajectoryFramePoint[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const reduceTele = useReduceMotion();
  const { ref: refTele, visible: teleVisible } = useFirstViewport(!reduceTele);

  /**
   * Chargement différé jusqu'à l'entrée dans la fenêtre.
   *
   * Le commentaire disait « chargement PARESSEUX » et l'effet partait au
   * montage : quatre requêtes lourdes, dont trois passent par
   * `loadSessionFrames` — lecture paginée jusqu'à soixante mille lignes, sans
   * cache — pour un écran dont on ne voit que le haut.
   *
   * `useFirstViewport` sert déjà à `SectionDelta`. Même motif, aucun module
   * neuf.
   */
  useEffect(() => {
    if (!teleVisible) return;
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const [ggPts, speedPts, brakePts, trajPts] = await Promise.all([
        loadGGPoints(sessionId),
        loadSpeedTracePoints(sessionId),
        loadThrottleBrakePoints(sessionId),
        loadSessionTrajectory(sessionId),
      ]);
      if (cancelled) return;
      setGg(ggPts);
      setSpeed(speedPts);
      setBrake(brakePts);
      setTraj(trajPts);
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, teleVisible]);

  const hasAny =
    (gg?.length ?? 0) > 0 ||
    (speed?.length ?? 0) > 0 ||
    (brake?.length ?? 0) > 0 ||
    (traj?.length ?? 0) > 1;

  return (
    <Animated.View ref={refTele}>
      <View style={styles.tabRow}>
        <Chip label="Appuis" active={tab === 'gg'} onPress={() => setTab('gg')} />
        <Chip label="Au fil du tour" active={tab === 'canaux'} onPress={() => setTab('canaux')} />
        <Chip label="Sur le tracé" active={tab === 'heatmap'} onPress={() => setTab('heatmap')} />
        <Chip label="Rejouer" active={tab === 'replay'} onPress={() => setTab('replay')} />
      </View>

      {status === 'loading' ? (
        <StateView state="loading" shape="hero" />
      ) : status === 'error' ? (
        <StateView state="error" errorMessage="Mesures indisponibles pour l'instant." />
      ) : !hasAny ? (
        <StateView
          state="empty"
          emptyMessage="Aucune trame du boîtier pour cette séance — les mesures s'afficheront dès la première vraie capture."
        />
      ) : tab === 'gg' ? (
        <GGScatter points={gg ?? []} />
      ) : tab === 'canaux' ? (
        <ChannelsChart speed={speed ?? []} brake={brake ?? []} />
      ) : tab === 'heatmap' ? (
        <HeatmapTrace traj={traj ?? []} />
      ) : (
        <ReplayTrace traj={traj ?? []} />
      )}
    </Animated.View>
  );
}

const GG_SIZE = 260;

/** Diagramme G-G : nuage {gLat, gLong}, couleur = vitesse (froid→chaud). */
function GGScatter({
  points,
}: {
  points: { gLat: number; gLong: number; speedKmh: number | null }[];
}) {
  if (points.length === 0) {
    return <StateView state="empty" emptyMessage="Appuis indisponibles." />;
  }
  // Sous-échantillonnage doux pour rester fluide (BASIC).
  // TODO device-tune : ajuster le pas selon la densité réelle sur appareil.
  const step = Math.max(1, Math.floor(points.length / 700));
  const sampled = points.filter((_, i) => i % step === 0);

  const speeds = sampled.map((p) => p.speedKmh ?? 0).filter((v) => v > 0);
  const minSp = speeds.length > 0 ? Math.min(...speeds) : 0;
  const maxSp = speeds.length > 0 ? Math.max(...speeds) : 1;
  const spRange = Math.max(1, maxSp - minSp);

  const R = GG_SIZE / 2;

  /**
   * L'ÉCHELLE DU DIAGRAMME — elle valait 1,5 g EN DUR, et bornait le reste.
   *
   * `clamp(g / 1.5, -1, 1)` plaquait sur le cercle tout appui au-delà de 1,5 g.
   * Sur piste, un freinage franchit ce seuil sans difficulté : le nuage se
   * tassait alors en arc le long du bord, et cet arc se lisait comme une limite
   * d'adhérence — la forme même que le pilote vient chercher dans un G-G. Une
   * mesure écrêtée y ment plus qu'ailleurs.
   *
   * C'est le même défaut que celui corrigé sur le canal des appuis le 17/08 ;
   * il vivait ici depuis le même jour, signalé et non traité.
   *
   * L'échelle se déduit désormais des DEUX axes à la fois : un diagramme G-G est
   * circulaire, ses deux dimensions partagent forcément un rayon. Les prendre
   * séparément ovaliserait le nuage et fausserait la lecture d'un appui combiné.
   */
  const ampleurG = domaineSymetrique(sampled.flatMap((p) => [p.gLat, p.gLong]));
  const GMAX = ampleurG ? Math.max(0.5, domaineGradue(ampleurG, 2).max) : 1.5;

  const toPx = (gx: number, gy: number) => ({
    // gLat → droite (x), gLong positif (accél) → haut (y écran inversé).
    // Aucun `clamp` : `GMAX` contient la mesure par construction.
    x: R + (gx / GMAX) * (R - 8),
    y: R - (gy / GMAX) * (R - 8),
  });

  return (
    <View style={styles.canvasCenter}>
      <Canvas
        style={{ width: GG_SIZE, height: GG_SIZE }}
        accessible
        accessibilityLabel={`Les appuis de la voiture, ${sampled.length} points`}
      >
        {/* Croix centrale — repère neutre, jamais un verdict. */}
        <Rect x={R - 0.5} y={0} width={1} height={GG_SIZE} color={colors.border.card} />
        <Rect x={0} y={R - 0.5} width={GG_SIZE} height={1} color={colors.border.card} />
        <Circle
          cx={R}
          cy={R}
          r={R - 8}
          color={colors.border.hairline}
          style="stroke"
          strokeWidth={1}
        />
        {sampled.map((p, i) => {
          const at = toPx(p.gLat, p.gLong);
          const t = p.speedKmh !== null ? (p.speedKmh - minSp) / spRange : 0;
          return <Circle key={i} cx={at.x} cy={at.y} r={2} color={speedColor(t)} opacity={0.6} />;
        })}
      </Canvas>
      {/* Le cercle portait un rayon sans valeur : on voyait une frontière sans
          savoir laquelle. Il est nommé, comme les graduations des canaux. */}
      <Text style={styles.legendMono}>
        {`Horizontal : appui latéral. Vertical : freinage (bas) / accélération (haut). Cercle : ${virgule(GMAX.toFixed(GMAX < 1 ? 1 : 0))} g.`}
      </Text>
    </View>
  );
}

const CHAN_H = 96;

/**
 * Ordonnée en pixels d'une vitesse, dans un canal de hauteur `CHAN_H`.
 *
 * UNE SEULE FORMULE, deux appelants : le tracé de la courbe et le placement des
 * étiquettes de graduation. Les écrire séparément est le moyen sûr de voir
 * « 150 » se poser en face de 140 le jour où l'une des deux bouge.
 *
 * Les 3 pt de garde en haut et en bas laissent respirer le trait de 2 pt sans
 * qu'il soit rogné par le bord du canal.
 */
function ordonneeVitesse(vitesse: number, haut: number): number {
  return CHAN_H - (vitesse / Math.max(1, haut)) * (CHAN_H - 6) - 3;
}

/**
 * Ordonnée en pixels d'un G longitudinal, zéro au milieu du canal.
 *
 * AUCUN ÉCRÊTAGE ICI, et c'est le point. La formule précédente bornait le
 * rapport à ±1 sur une pleine échelle figée à 1,5 g : un freinage à 1,8 g était
 * tracé à 1,5 g, et rien ne le disait. `haut` vient désormais de la mesure elle-
 * même (`domaineSymetrique` puis `domaineGradue`), donc il la contient par
 * construction — le rapport reste dans [−1, 1] sans qu'on ait à le forcer.
 *
 * Même rôle que `ordonneeVitesse` : une seule formule pour la courbe ET pour
 * les étiquettes de graduation.
 */
function ordonneeG(gLong: number, haut: number): number {
  return CHAN_H / 2 - (gLong / Math.max(0.01, haut)) * (CHAN_H / 2 - 4);
}

// A-SCRUB — Port scrubbing 60 fps : le curseur des canaux est piloté par une
// SharedValue Reanimated sur le THREAD UI (Skia la consomme directement, cf.
// GlowStroke), sans re-render React par frame pour la ligne. C'est une HYPOTHÈSE
// tant qu'elle n'est pas MESURÉE à 60 fps sur un iPhone RÉEL (le simulateur ment
// sur le frame-rate) : l'ancien chemin (curseur = état React) reste accessible en
// basculant ce drapeau à `false` — revert propre, sans autre changement.
const UI_THREAD_SCRUB = true;

/** Deux canaux empilés (vitesse + G long) avec un curseur au doigt. */
function ChannelsChart({
  speed,
  brake,
}: {
  speed: { progress: number; speedKmh: number }[];
  brake: { progress: number; gLong: number }[];
}) {
  const [width, setWidth] = useState(0);
  // `cursor` (état React) ne pilote plus que les LIBELLÉS (texte, bon marché).
  // La LIGNE de curseur suit `cursorSV` sur le THREAD UI. Les deux sont mis à
  // jour par le même geste. TOUS les hooks AVANT le retour anticipé (règles hooks).
  const [cursor, setCursor] = useState(0.5); // 0..1
  const cursorSV = useSharedValue(0.5);
  // x du curseur dérivé sur le thread UI — Skia le consomme directement (patron
  // GlowStroke : `end={progress}` accepte number | SharedValue).
  const cursorXSV = useDerivedValue(() => cursorSV.value * width - 0.5);

  /**
   * L'ÉCHELLE DU CANAL VITESSE — elle valait le maximum OBSERVÉ, et c'était le
   * défaut de ce graphe.
   *
   * Normaliser sur `max(speedKmh)` fait toucher le haut du cadre à TOUTES les
   * séances : une sortie à 90 km/h et une sortie à 210 km/h dessinaient la même
   * silhouette, et rien à l'écran ne les départageait. La forme était lisible,
   * le chiffre ne l'était pas.
   *
   * L'axe tombe désormais sur des repères ronds (`graduations`, pas 1-2-5), et
   * la courbe se normalise sur CES repères (`domaineGradue`) — les deux
   * partagent un dénominateur, faute de quoi l'étiquette « 150 » se poserait en
   * face de 140. Conséquence assumée : la courbe ne touche plus le haut du
   * cadre, et c'est précisément ce qui rend deux séances comparables.
   */
  const echelleVitesse = useMemo(() => {
    const observe = speed.length > 0 ? Math.max(...speed.map((p) => p.speedKmh)) : 1;
    const brut = { min: 0, max: Math.max(1, observe) };
    return { haut: domaineGradue(brut, 3).max, reperes: graduations(brut, 3) };
  }, [speed]);

  /**
   * L'ÉCHELLE DES APPUIS — elle était FIGÉE à ±1,5 g, et bornait ce qui dépassait.
   *
   * Sur piste, un freinage franchit 1,5 g sans difficulté. La courbe collait
   * alors au bord du canal et y restait : le pilote voyait un plateau là où il
   * avait sa meilleure décélération. Une mesure écrêtée se lit comme une limite
   * du véhicule, ce qu'elle n'est pas.
   *
   * L'échelle se déduit maintenant de la séance, et reste symétrique pour que le
   * zéro tienne le milieu du canal — c'est lui qui fait lire le signe (bas =
   * freinage, haut = accélération).
   */
  const echelleG = useMemo(() => {
    const brut = domaineSymetrique(brake.map((p) => p.gLong));
    if (brut === null) return { haut: 1, reperes: [] as number[] };
    return { haut: domaineGradue(brut, 4).max, reperes: graduations(brut, 4) };
  }, [brake]);
  // Dérivations LOURDES mémoïsées sur [speed, brake, width] : un re-render de
  // libellé (par frame, via setCursor) ne les recalcule PAS — sinon le scrubbing
  // raboterait autant que l'ancien chemin. polylineToPathD rend '' sous 2 points
  // (séance GPS-only → brake vide) : le <Path> n'est peint que si non vide.
  const { speedPath, brakePath } = useMemo(() => {
    const sp =
      width > 0
        ? speed.map((p) => ({
            x: p.progress * width,
            y: ordonneeVitesse(p.speedKmh, echelleVitesse.haut),
          }))
        : [];
    const bp =
      width > 0
        ? brake.map((p) => ({
            // 0 au centre ; l'échelle vient de la mesure, donc rien n'est borné.
            x: p.progress * width,
            y: ordonneeG(p.gLong, echelleG.haut),
          }))
        : [];
    return { speedPath: polylineToPathD(sp), brakePath: polylineToPathD(bp) };
  }, [speed, brake, width, echelleVitesse, echelleG]);

  // Geste : la ligne va sur le thread UI (cursorSV), les libellés suivent en JS
  // (runOnJS). Math.min/max inlinés (worklet-safe). A-SCRUB : port 60 fps.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          'worklet';
          if (width <= 0) return;
          const frac = Math.min(1, Math.max(0, e.x / width));
          cursorSV.value = frac;
          runOnJS(setCursor)(frac);
        })
        .onUpdate((e) => {
          'worklet';
          if (width <= 0) return;
          const frac = Math.min(1, Math.max(0, e.x / width));
          cursorSV.value = frac;
          runOnJS(setCursor)(frac);
        }),
    [width, cursorSV]
  );

  if (speed.length < 2 && brake.length < 2) {
    return <StateView state="empty" emptyMessage="Mesures indisponibles." />;
  }

  // Libellés au curseur : index le plus proche en O(1) (progress = i/(n−1), pas
  // uniforme et croissant → l'index = round(cursor·(n−1))). Pas d'interpolation.
  function nearestAt<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    return arr[Math.round(cursor * (arr.length - 1))] ?? null;
  }
  const curSpeed = nearestAt(speed);
  const curBrake = nearestAt(brake);
  // A-SCRUB : le drapeau bascule entre curseur UI-thread (SharedValue) et
  // l'ancien curseur piloté par l'état React (fallback propre — cf. entête).
  const cursorXProp = UI_THREAD_SCRUB ? cursorXSV : cursor * width - 0.5;

  // Mêmes chaînes à l'écran et à la voix — le libellé ne dit rien d'autre que
  // ce qui est affiché. « non lu » remplace le tiret cadratin, muet à l'oral.
  const speedRead = curSpeed ? `${Math.round(curSpeed.speedKmh)} km/h` : '—';
  const brakeRead = curBrake
    ? virgule(`${curBrake.gLong >= 0 ? '+' : ''}${curBrake.gLong.toFixed(2)} g`)
    : '—';
  const speedSpoken = curSpeed ? speedRead : 'non lu';
  const brakeSpoken = curBrake ? brakeRead : 'non lu';

  return (
    <View>
      {/* Deux Text séparés, sans nom de canal : regroupés, ils redeviennent UNE
          donnée (les libellés VITESSE / G LONGITUDINAL vivent loin en dessous). */}
      <View
        style={styles.chanHead}
        accessible
        accessibilityLabel={`Au curseur — vitesse ${speedSpoken}, freinage et accélération ${brakeSpoken}`}
      >
        <Text style={styles.chanValue}>{speedRead}</Text>
        <Text style={styles.chanValueAlt}>{brakeRead}</Text>
      </View>
      <GestureDetector gesture={pan}>
        {/* Le curseur ne se déplace qu'au Gesture.Pan() : sans alternative, les
            deux relevés restent figés pour un lecteur d'écran. Increment /
            decrement empruntent le même chemin que le geste (cursorSV + setCursor). */}
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          // Un conteneur `accessible` REMPLACE la lecture de ses descendants par
          // son propre libellé : les deux légendes d'axes vivent à l'intérieur et
          // deviendraient inaudibles. Or celle du canal G porte la clé de lecture
          // du signe (bas = freinage, haut = accélération) — sans elle, la valeur
          // annoncée n'a pas de sens. On la reprend donc ici.
          accessibilityLabel="Au fil du tour : la vitesse, et les appuis (bas : freinage, haut : accélération)"
          accessibilityValue={{ text: `${speedSpoken}, ${brakeSpoken}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const next = Math.min(
              1,
              Math.max(0, cursor + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))
            );
            cursorSV.value = next;
            setCursor(next);
          }}
        >
          {/* Canal vitesse */}
          <View style={{ height: CHAN_H }}>
            {width > 0 ? (
              <>
                <Canvas style={{ width, height: CHAN_H }}>
                  {speedPath ? (
                    <Path
                      path={speedPath}
                      style="stroke"
                      strokeWidth={2}
                      strokeCap="round"
                      strokeJoin="round"
                      color={colors.qdi.trajectoire}
                    />
                  ) : null}
                  <Rect x={cursorXProp} y={0} width={1} height={CHAN_H} color={colors.text.mid} />
                </Canvas>
                {/* Les repères, posés PAR-DESSUS le canal. Ils passent par
                    `ordonneeVitesse`, la MÊME fonction que la courbe : c'est ce
                    qui garantit que « 150 » se pose sur la hauteur de 150.
                    Inertes au toucher — le geste appartient au curseur. */}
                <View style={styles.chanTicks}>
                  {echelleVitesse.reperes.map((v) => (
                    <Text
                      key={v}
                      style={[
                        styles.chanTick,
                        { top: ordonneeVitesse(v, echelleVitesse.haut) - 5 },
                      ]}
                    >
                      {v}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}
          </View>
          <Text style={styles.chanLabel}>VITESSE (km/h)</Text>
          {/* Canal G longitudinal */}
          <View style={{ height: CHAN_H, marginTop: space.sm }}>
            {width > 0 ? (
              <>
                <Canvas style={{ width, height: CHAN_H }}>
                  <Rect
                    x={0}
                    y={CHAN_H / 2 - 0.5}
                    width={width}
                    height={1}
                    color={colors.border.card}
                  />
                  {brakePath ? (
                    <Path
                      path={brakePath}
                      style="stroke"
                      strokeWidth={2}
                      strokeCap="round"
                      strokeJoin="round"
                      color={colors.qdi.freinage}
                    />
                  ) : null}
                  <Rect x={cursorXProp} y={0} width={1} height={CHAN_H} color={colors.text.mid} />
                </Canvas>
                {/* Mêmes repères que la vitesse, par la même mécanique — et le
                    zéro est déjà tracé par le filet central, on ne le double pas
                    d'une étiquette « 0 » qui n'apprendrait rien. */}
                <View style={styles.chanTicks}>
                  {echelleG.reperes
                    .filter((v) => v !== 0)
                    .map((v) => (
                      <Text
                        key={v}
                        style={[styles.chanTick, { top: ordonneeG(v, echelleG.haut) - 5 }]}
                      >
                        {v > 0 ? `+${v}` : String(v)}
                      </Text>
                    ))}
                </View>
              </>
            ) : null}
          </View>
          <Text style={styles.chanLabel}>
            G LONGITUDINAL (g) — bas : freinage · haut : accélération
          </Text>
        </View>
      </GestureDetector>
    </View>
  );
}

const HEAT_H = 240;

/** Tracé chauffé par la vitesse (froid→chaud, sans rouge). */
function HeatmapTrace({ traj }: { traj: TrajectoryFramePoint[] }) {
  const [width, setWidth] = useState(0);

  const segments = useMemo(() => {
    const pts = fitTrajectory(traj, width, HEAT_H, 14);
    if (pts.length < 2) return [];
    const speeds = pts.map((p) => p.speed ?? 0).filter((v) => v > 0);
    const minSp = speeds.length > 0 ? Math.min(...speeds) : 0;
    const maxSp = speeds.length > 0 ? Math.max(...speeds) : 1;
    const range = Math.max(1, maxSp - minSp);
    // Regroupe les segments par couleur (≤ N chemins) pour rester léger.
    const BUCKETS = 6;
    const byBucket: string[] = Array.from({ length: BUCKETS }, () => '');
    for (let i = 1; i < pts.length; i++) {
      const sp = pts[i].speed;
      const t = sp !== null ? (sp - minSp) / range : 0;
      const b = clamp(Math.floor(t * BUCKETS), 0, BUCKETS - 1);
      byBucket[b] += `M ${pts[i - 1].x} ${pts[i - 1].y} L ${pts[i].x} ${pts[i].y} `;
    }
    return byBucket.map((d, b) => ({ d, color: speedColor((b + 0.5) / BUCKETS) }));
  }, [traj, width]);

  if (traj.length < 2) {
    return <StateView state="empty" emptyMessage="Trajectoire indisponible." />;
  }

  return (
    <View>
      <View style={{ height: HEAT_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Canvas
            style={{ width, height: HEAT_H }}
            accessible
            accessibilityLabel="Tracé coloré par la vitesse"
          >
            {segments.map((s, i) =>
              s.d !== '' ? (
                <Path
                  key={i}
                  path={s.d.trim()}
                  style="stroke"
                  strokeWidth={4}
                  strokeCap="round"
                  strokeJoin="round"
                  color={s.color}
                />
              ) : null
            )}
          </Canvas>
        ) : null}
      </View>
      <View style={styles.heatLegend}>
        <Text style={styles.legendMono}>Lent</Text>
        <View style={styles.heatBar}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: speedColor(i / 11) }} />
          ))}
        </View>
        <Text style={styles.legendMono}>Rapide</Text>
      </View>
    </View>
  );
}

const REPLAY_H = 240;
const REPLAY_STEP_MS = 60;

/** Point qui parcourt le tracé — version BASIC (intervalle JS isolé). */
function ReplayTrace({ traj }: { traj: TrajectoryFramePoint[] }) {
  const [width, setWidth] = useState(0);
  const [idx, setIdx] = useState(0);
  // Seule animation perpétuelle de la zone : elle doit, comme tout le kit,
  // respecter « animations réduites » — le point reste alors à l'index 0,
  // tracé complet, sans boucle.
  const reduce = useReduceMotion();

  const pts = useMemo(() => fitTrajectory(traj, width, REPLAY_H, 14), [traj, width]);

  // TODO device-tune : boucle par intervalle JS (BASIC) — porter l'animation
  // sur le thread UI (shared value + Skia) pour un défilement 60fps sans
  // re-render de section.
  useEffect(() => {
    if (reduce || pts.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % pts.length);
    }, REPLAY_STEP_MS);
    return () => clearInterval(t);
  }, [pts.length, reduce]);

  if (traj.length < 2) {
    return <StateView state="empty" emptyMessage="Lecture indisponible." />;
  }

  const head = pts.length > 0 ? pts[Math.min(idx, pts.length - 1)] : null;
  const tracePath = polylineToPathD(pts);

  return (
    <View>
      <View style={{ height: REPLAY_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && tracePath !== '' ? (
          <Canvas
            style={{ width, height: REPLAY_H }}
            accessible
            accessibilityLabel="Tracé de la séance"
          >
            <Path
              path={tracePath}
              style="stroke"
              strokeWidth={3}
              strokeCap="round"
              strokeJoin="round"
              color={colors.border.strong}
            />
            {head ? <Circle cx={head.x} cy={head.y} r={6} color={colors.accent} /> : null}
          </Canvas>
        ) : null}
      </View>
      <Text style={styles.legendMono}>Le point suit votre passage, tour après tour.</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · CONSTATS — les six lectures (DÉMO) montées dans un Sheet.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Monte la visualisation d'une lecture sur sa source RÉELLE, en état vide
 * honnête si la donnée manque.
 *
 * Plus aucune démonstration ici. Les quatre lectures d'insights ne reçoivent
 * plus que des lignes MESURÉES — `fetchSessionInsights` écarte désormais les
 * moteurs de démonstration — et `flow` est branchée sur le jerk résiduel réel
 * (A-FLOW-1). Quand rien n'a été mesuré, chaque vue le dit.
 */
function renderReadingViz(
  key: ReadingKey,
  insights: SessionInsights | null,
  ggPoints: GGPoint[],
  flowPoints: FlowPoint[]
) {
  switch (key) {
    case 'anatomie':
      return <AnatomieViz anatomy={insights?.anatomy ?? null} />;
    case 'gg':
      return <GGViz points={ggPoints} />;
    case 'dispersion':
      return <DispersionViz dispersion={insights?.dispersion ?? null} />;
    case 'tour-ideal':
      return <TourIdealViz ideal={insights?.ideal_lap ?? null} />;
    case 'flow':
      return <FlowViz points={flowPoints} />;
    case 'transfert':
      return <TransfertViz transfer={insights?.load_transfer ?? null} />;
    default:
      return null;
  }
}

function ConstatsSection({
  insights,
  ggPoints,
  flowPoints,
  insightsFailed,
  sessionId,
  tourReference,
  segments,
}: {
  insights: SessionInsights | null;
  ggPoints: GGPoint[];
  flowPoints: FlowPoint[];
  insightsFailed: boolean;
  sessionId: string;
  /** Tour de référence de la séance — le passage lu par les constats M14/M15. */
  tourReference: number | null;
  /** Découpage du tracé : les fenêtres de virages des deux constats fins. */
  segments: SegmentAnalysisRow[];
}) {
  const [open, setOpen] = useState<ReadingKey | null>(null);
  const [openVirageFin, setOpenVirageFin] = useState<'chevauchement' | 'rotation' | null>(null);
  const reading = open ? (READINGS.find((r) => r.key === open) ?? null) : null;

  /**
   * Les deux constats de FIN DE VIRAGE (M14/M15) lisent un passage : il leur
   * faut un tour de référence ET au moins un virage à fenêtre connue. Sans
   * l'un ou l'autre, la ligne reste visible, éteinte, avec sa raison — le même
   * contrat que les six lectures.
   */
  const viragesFenetres = segments.filter(
    (s) => s.startProgress !== null && s.endProgress !== null
  );
  const virageFinRaison =
    tourReference === null
      ? 'Aucun tour chronométré sur cette séance.'
      : viragesFenetres.length === 0
        ? 'Aucun virage segmenté sur cette séance.'
        : null;
  const virageFinDispo = virageFinRaison === null;

  // Panne DB de la lecture insights : erreur honnête (distincte de « vide »).
  if (insightsFailed) {
    /**
     * `errorMessage`, PAS `emptyMessage` — corrigé le 13/08/2026.
     *
     * La branche `error` de `StateView` ne lit que `errorMessage` ; le texte
     * écrit ici n'atteignait donc JAMAIS l'écran, et le pilote voyait le libellé
     * par défaut « Le chargement a échoué. » Un message rédigé, invisible.
     */
    return <StateView state="error" errorMessage="Lectures indisponibles pour le moment." />;
  }

  /**
   * LISTE BLANCHE À TROIS ÉTATS — lot 13.
   *
   * Les six lectures étaient offertes en permanence. Le pilote voyait six
   * portes, les ouvrait une à une, et trouvait six fois « Données
   * insuffisantes ». Rien n'était faux ; l'information arrivait simplement
   * après le geste au lieu de le précéder.
   *
   * Chaque lecture dit maintenant son état AVANT d'être ouverte, et seules les
   * disponibles sont pressables. La décision est dans `disponibilite.ts` — une
   * règle répartie sur six composants est une règle qu'on applique cinq fois.
   */
  const etats = READINGS.map((r) =>
    etatLecture(r.key, {
      insights,
      nbPointsGG: ggPoints.length,
      nbPointsFlow: flowPoints.length,
    })
  );

  /**
   * Conséquence assumée par le dossier : tant que rien n'est mesuré, la section
   * ne propose plus rien.
   *
   * Nuance délibérée : l'en-tête « CONSTATS » reste, porté par le parent. Le
   * retirer ferait disparaître la section sans explication — et décalerait les
   * ancres de défilement (`registerSection`). Une section qui dit pourquoi elle
   * est vide vaut mieux qu'une section qui s'évapore.
   */
  if (!sectionAffichable(etats)) {
    return (
      <StateView
        state="empty"
        emptyMessage="Aucune lecture sur cette séance. Elles apparaîtront à la première mesure."
      />
    );
  }

  return (
    <View>
      <View style={styles.constatsList}>
        {READINGS.map((r, i) => {
          const d = etats[i];
          const dispo = d.etat === 'disponible';
          return (
            <ListRow
              key={r.key}
              label={r.name}
              // Disponible → le niveau. Absente → la raison, à la place du
              // tiret : « — » seul n'apprendrait rien.
              sublabel={dispo ? r.eyebrow : d.raison}
              disabled={!dispo}
              chevron={dispo}
              onPress={
                dispo
                  ? () => {
                      haptic('tap');
                      setOpen(r.key);
                    }
                  : undefined
              }
              accessibilityLabel={
                dispo ? `${r.name} — lecture approfondie` : `${r.name} — ${d.raison}`
              }
            />
          );
        })}
        {/*
          Les deux constats de fin de virage (modules M14/M15) — même pattern
          ListRow → Sheet que les lectures ci-dessus. « (estimé) » et
          « (observé) » disent le statut de chaque lecture dès la liste.
        */}
        {(
          [
            { cle: 'chevauchement', label: 'Chevauchement décélération/rotation (estimé)' },
            { cle: 'rotation', label: 'Rotation et corrections (observé)' },
          ] as const
        ).map((entree) => (
          <ListRow
            key={entree.cle}
            label={entree.label}
            sublabel={
              virageFinDispo ? 'Fin de virage — tour de référence' : (virageFinRaison ?? undefined)
            }
            disabled={!virageFinDispo}
            chevron={virageFinDispo}
            onPress={
              virageFinDispo
                ? () => {
                    haptic('tap');
                    setOpenVirageFin(entree.cle);
                  }
                : undefined
            }
            accessibilityLabel={
              virageFinDispo
                ? `${entree.label} — lecture approfondie`
                : `${entree.label} — ${virageFinRaison}`
            }
          />
        ))}
      </View>

      <Sheet visible={open !== null} onClose={() => setOpen(null)} snapHeight={520}>
        {reading ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <SectionHeader eyebrow={reading.eyebrow} title={reading.name} />
            {open ? renderReadingViz(open, insights, ggPoints, flowPoints) : null}
          </ScrollView>
        ) : null}
      </Sheet>

      <Sheet
        visible={openVirageFin !== null}
        onClose={() => setOpenVirageFin(null)}
        snapHeight={520}
      >
        {openVirageFin !== null && tourReference !== null && viragesFenetres.length > 0 ? (
          <VirageFinSheet
            mode={openVirageFin}
            sessionId={sessionId}
            tourReference={tourReference}
            virages={viragesFenetres}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

/**
 * Découpe les trames D'UN TOUR sur la fenêtre d'un virage, par le RANG de la
 * trame (`i / (n − 1)`) — la même approximation, nommée, que `trancheVirage` :
 * les trames ne portent pas leur progression. Valable sur un tour seulement,
 * jamais sur une séance entière.
 */
function tranchePassage(
  frames: readonly SessionFrame[],
  fenetre: { start: number; end: number }
): SessionFrame[] {
  const n = frames.length;
  if (n < 2) return [];
  return frames.filter((_, i) => {
    const p = i / (n - 1);
    return p >= fenetre.start && p <= fenetre.end;
  });
}

/**
 * Trames du passage → échantillons M14. La convention est DÉJÀ alignée :
 * `SessionFrame.gLong` est négatif en décélération (le mapping inverse
 * `g_force_x` brut une fois pour toutes — ne pas reconvertir ici).
 */
function versEchantillonsVirage(passage: readonly SessionFrame[]): EchantillonVirage[] {
  const t0 = passage[0].elapsedMs;
  return passage.map((f) => ({
    tMs: f.elapsedMs - t0,
    gLong: f.gLong,
    gLat: f.gLat,
    vitesse: f.speedKmh !== null ? f.speedKmh / 3.6 : null,
  }));
}

/**
 * Trames du passage → échantillons M15. La base stocke le lacet en °/s,
 * `SessionFrame` le rend en rad/s : on revient aux degrés que M15 attend.
 */
function versEchantillonsRotation(passage: readonly SessionFrame[]): EchantillonRotation[] {
  const t0 = passage[0].elapsedMs;
  return passage.map((f) => ({
    tMs: f.elapsedMs - t0,
    lacetDegParS: f.yawRateRadS !== null ? f.yawRateRadS / DEG_VERS_RAD : null,
    gLat: f.gLat,
  }));
}

/** Une ligne de fait — même dessin que la feuille virage (factRow). */
function FaitRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

/** Instant en secondes depuis le début du passage, virgule française. */
function instantS(ms: number | null): string {
  return ms !== null ? virgule(`${(ms / 1000).toFixed(2)} s`) : '—';
}

/**
 * Feuille des deux constats de fin de virage (M14 chevauchement, M15 rotation).
 *
 * Elle lit le TOUR DE RÉFÉRENCE, virage par virage — le choix du virage se
 * fait par les mêmes pastilles que partout ailleurs. Les trames ne sont
 * chargées qu'à l'ouverture de la feuille, jamais au montage de l'écran.
 */
function VirageFinSheet({
  mode,
  sessionId,
  tourReference,
  virages,
}: {
  mode: 'chevauchement' | 'rotation';
  sessionId: string;
  tourReference: number;
  /** Virages à fenêtre connue (startProgress/endProgress non nuls). */
  virages: SegmentAnalysisRow[];
}) {
  const [virage, setVirage] = useState<SegmentAnalysisRow>(virages[0]);
  const [frames, setFrames] = useState<SessionFrame[] | null>(null);
  const [etat, setEtat] = useState<'charge' | 'pret' | 'erreur'>('charge');

  useEffect(() => {
    let annule = false;
    setEtat('charge');
    loadLapFrames(sessionId, tourReference)
      .then((f) => {
        if (annule) return;
        setFrames(f);
        setEtat('pret');
      })
      .catch(() => {
        if (!annule) setEtat('erreur');
      });
    return () => {
      annule = true;
    };
  }, [sessionId, tourReference]);

  const passage = useMemo(() => {
    if (!frames || virage.startProgress === null || virage.endProgress === null) return [];
    return tranchePassage(frames, { start: virage.startProgress, end: virage.endProgress });
  }, [frames, virage]);

  const chevauchement = useMemo(
    () =>
      mode === 'chevauchement' && passage.length > 0
        ? lireChevauchement(versEchantillonsVirage(passage))
        : null,
    [mode, passage]
  );
  const rotation = useMemo(
    () =>
      mode === 'rotation' && passage.length > 0
        ? lireRotation(versEchantillonsRotation(passage))
        : null,
    [mode, passage]
  );

  const titre =
    mode === 'chevauchement'
      ? 'Chevauchement décélération/rotation (estimé)'
      : 'Rotation et corrections (observé)';
  const nomVirage = virage.segmentName ?? `Virage ${virage.segmentIndex}`;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <SectionHeader eyebrow="FIN DE VIRAGE" title={titre} />
      <Text style={styles.sheetNote}>{`Tour ${tourReference}, un passage à la fois.`}</Text>
      <View style={styles.choixTours}>
        {virages.map((v) => (
          <Chip
            key={v.segmentIndex}
            label={v.segmentName ?? `V${v.segmentIndex}`}
            active={v.segmentIndex === virage.segmentIndex}
            onPress={() => setVirage(v)}
          />
        ))}
      </View>
      {etat === 'charge' ? (
        <StateView state="loading" shape="hero" />
      ) : etat === 'erreur' ? (
        <StateView
          state="error"
          errorMessage="Les trames du tour de référence n'ont pas pu être lues."
        />
      ) : passage.length === 0 ? (
        <StateView
          state="empty"
          emptyMessage={`Aucune trame du tour ${tourReference} ne tombe dans la fenêtre de ce virage.`}
        />
      ) : mode === 'chevauchement' && chevauchement ? (
        <ChevauchementFaits resultat={chevauchement} nomVirage={nomVirage} />
      ) : rotation ? (
        <RotationFaits resultat={rotation} nomVirage={nomVirage} />
      ) : null}
    </ScrollView>
  );
}

/** Les faits du constat M14 — chaque grandeur non mesurable reste « — ». */
function ChevauchementFaits({
  resultat,
  nomVirage,
}: {
  resultat: ResultatChevauchement;
  nomVirage: string;
}) {
  return (
    <View>
      {/* Le nom de la lecture est verrouillé par le module : rendu tel quel. */}
      <Text style={styles.vfLecture}>{resultat.libelle}</Text>
      <View style={styles.factCard}>
        <FaitRow
          label="Fenêtre de chevauchement"
          value={
            resultat.fenetre !== null
              ? `${instantS(resultat.fenetre.debutMs)} → ${instantS(resultat.fenetre.finMs)}`
              : '—'
          }
        />
        <FaitRow
          label="Durée"
          value={resultat.dureeMs !== null ? `${Math.round(resultat.dureeMs)} ms` : '—'}
        />
        <FaitRow
          label="Pente du relâché"
          value={
            resultat.penteRelacheGParS !== null
              ? virgule(
                  `${resultat.penteRelacheGParS >= 0 ? '+' : ''}${resultat.penteRelacheGParS.toFixed(2)} g/s`
                )
              : '—'
          }
        />
        <FaitRow label="Bascule (latéral > longitudinal)" value={instantS(resultat.basculeMs)} />
        <FaitRow label="Échantillons écartés" value={String(resultat.echantillonsIgnores)} />
      </View>
      {resultat.observations.map((o) => (
        <Text key={o} style={styles.sheetNote}>
          {o}
        </Text>
      ))}
      <Text
        style={styles.legendMono}
      >{`Confiance ${resultat.confiance} · ${resultat.version}`}</Text>
      <Text style={styles.sheetNote}>
        {`${nomVirage} — estimé depuis les accélérations mesurées du tour de référence, jamais depuis les commandes. Fenêtre du virage approchée par le rang des trames dans le tour.`}
      </Text>
    </View>
  );
}

/**
 * Les faits du constat M15. Quand le signal ne suffit pas, la feuille montre
 * les LECTURES POSSIBLES énoncées par le module — jamais un verdict forcé.
 */
function RotationFaits({ resultat, nomVirage }: { resultat: ResultatRotation; nomVirage: string }) {
  return (
    <View>
      <Text style={styles.vfLecture}>{resultat.lecture}</Text>
      {resultat.lecture === 'signal insuffisant' ? (
        <>
          {resultat.observations.map((o) => (
            <Text key={o} style={styles.sheetNote}>
              {o}
            </Text>
          ))}
          {resultat.alternatives.map((a) => (
            <Text key={a} style={styles.confianceMotif}>{`— ${a}`}</Text>
          ))}
        </>
      ) : (
        <>
          <View style={styles.factCard}>
            <FaitRow label="Début de rotation" value={instantS(resultat.debutMs)} />
            <FaitRow
              label="Pic de lacet"
              value={
                resultat.picDegParS !== null
                  ? virgule(`${Math.round(resultat.picDegParS)} °/s`)
                  : '—'
              }
            />
            <FaitRow label="Instant du pic" value={instantS(resultat.picMs)} />
            <FaitRow
              label="Alternances comptées"
              value={resultat.oscillations !== null ? String(resultat.oscillations) : '—'}
            />
            <FaitRow label="Stabilisation" value={instantS(resultat.stabilisationMs)} />
            <FaitRow label="Échantillons écartés" value={String(resultat.echantillonsIgnores)} />
          </View>
          {resultat.observations.map((o) => (
            <Text key={o} style={styles.sheetNote}>
              {o}
            </Text>
          ))}
        </>
      )}
      <Text
        style={styles.legendMono}
      >{`Confiance ${resultat.confiance} · ${resultat.version}`}</Text>
      <Text style={styles.sheetNote}>
        {`${nomVirage} — lecture du gyroscope (axe Z) sur le tour de référence. Fenêtre du virage approchée par le rang des trames dans le tour.`}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · CŒUR — vide HONNÊTE (aucune FC en base, jamais fabriquée).
// ═══════════════════════════════════════════════════════════════════════════

function CoeurSection() {
  // Portail flag + consentement + données : `telemetry_frames` NE PORTE PAS de
  // fréquence cardiaque. Aucune valeur n'est donc inventée — vide assumé, la
  // FC arrivera avec un capteur compatible et le consentement du pilote.
  return (
    <StateView
      state="empty"
      emptyMessage="La fréquence cardiaque n'est pas mesurée pour cette séance. Elle apparaîtra avec un capteur compatible et votre accord."
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · CONDITIONS — météo réelle (nullable → « — ») + corrélation B5.
// ═══════════════════════════════════════════════════════════════════════════

function ConditionsSection({
  weather,
  correlation,
  failed,
  onRetry,
}: {
  weather: SeanceWeather | null;
  correlation: WeatherCorrelation | null;
  failed: boolean;
  onRetry: () => void;
}) {
  const hasCorrelation =
    correlation !== null &&
    (correlation.byTemp.some((b) => b.avgLapMs !== null) ||
      correlation.byHumidity.some((b) => b.avgLapMs !== null));

  if (failed && weather === null && !hasCorrelation) {
    return <StateView state="error" errorMessage="Conditions indisponibles." onRetry={onRetry} />;
  }

  return (
    <View>
      {/* Météo capturée de la séance — temp/humidité RÉELLES, « — » si absentes. */}
      {weather ? (
        <View style={styles.condCard}>
          <View style={styles.hairlineRow}>
            <StatCell
              label="Température"
              value={weather.temperatureC !== null ? `${Math.round(weather.temperatureC)} °C` : '—'}
              style={styles.hairlineCell}
            />
            <StatCell
              label="Humidité"
              value={weather.humidityPct !== null ? `${Math.round(weather.humidityPct)} %` : '—'}
              style={styles.hairlineCell}
            />
          </View>
          {weather.label ? <Text style={styles.condLabel}>{weather.label}</Text> : null}
        </View>
      ) : (
        <StateView state="empty" emptyMessage="Aucune météo capturée pour cette séance." />
      )}

      {/* B5 — petits multiples : votre tour de référence par tranche météo. */}
      {hasCorrelation && correlation ? (
        <View style={styles.smallMultiples}>
          <Text style={styles.legendMono}>TOUR DE RÉFÉRENCE PAR CONDITIONS</Text>
          <WeatherSmallMultiple title="Température" buckets={correlation.byTemp} />
          <WeatherSmallMultiple title="Humidité" buckets={correlation.byHumidity} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Un petit multiple : le tour de référence moyen par tranche.
 *
 * DEUX CORRECTIFS DU 05/08/2026, ET LE PLAN LES AVAIT DEMANDÉS. Il pose, avant
 * de dessiner : « une jointure est un fait, une corrélation serait causale ».
 * Le calcul était honnête ; la FORME, elle, affirmait davantage.
 *
 * 1. L'échelle était normalisée entre le min et le max des seules tranches
 *    affichées. Deux tranches séparées de cent millisecondes produisaient donc
 *    l'écart visuel MAXIMAL — une barre au plafond, l'autre au plancher. Le
 *    pilote y lisait un effet là où il n'y avait que le bruit d'un tour à
 *    l'autre. `hauteursBarres` impose désormais un plancher d'amplitude.
 *
 * 2. Le nombre de séances existait dans la donnée et n'était PAS affiché. Une
 *    tranche bâtie sur une seule séance se lisait comme une tranche bâtie sur
 *    dix. C'est ce qui transforme un rangement en conclusion.
 *
 * Une corrélation ne s'écrit pas seulement avec des mots. Elle s'installe très
 * bien avec deux barres de hauteurs différentes.
 */
function WeatherSmallMultiple({ title, buckets }: { title: string; buckets: WeatherBucket[] }) {
  const withData = buckets
    .filter((b) => b.avgLapMs !== null && b.count > 0)
    .map((b) => ({ label: b.label, avgLapMs: b.avgLapMs as number, count: b.count }));
  if (withData.length === 0) return null;

  const hauteurs = hauteursBarres(withData, { min: 18, max: 52 });
  const note = noteMethode(withData);

  return (
    <View style={styles.multipleBlock}>
      <Text style={styles.multipleTitle}>{title}</Text>
      <View style={styles.multipleRow}>
        {withData.map((b, i) => (
          <View key={b.label} style={styles.multipleCol}>
            <View
              style={[
                styles.multipleBar,
                { height: hauteurs[i], backgroundColor: colors.qdi.trajectoire },
              ]}
            />
            <Text style={styles.multipleValue}>{formatChronoMs(b.avgLapMs)}</Text>
            <Text style={styles.multipleLabel} numberOfLines={1}>
              {b.label}
            </Text>
            {/* L'effectif s'affiche TOUJOURS, et surtout quand il vaut un. */}
            <Text style={styles.multipleEffectif} numberOfLines={1}>
              {libelleEffectif(b.count)}
            </Text>
          </View>
        ))}
      </View>
      {note ? <Text style={styles.multipleNote}>{note}</Text> : null}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles.
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  multipleEffectif: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.text.mid,
    marginTop: 1,
  },
  multipleNote: {
    fontFamily: typo.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.text.mid,
    marginTop: space.sm,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: space.xl,
  },
  headerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
  },
  headerTitle: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.text.mid,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 20,
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: RAIL_HEIGHT,
    zIndex: 15,
    justifyContent: 'center',
    backgroundColor: colors.bg.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  railContent: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: space.xl,
    marginTop: space.xxl,
  },
  /** Le développement linéaire, en tête de la section Delta dont il est la règle. */
  stripMap: {
    marginBottom: space.xl,
  },
  /** L'orientation de lecture, sous le résumé — dans la même section. */
  niveaux: {
    marginTop: space.lg,
  },
  // ── Résumé ──
  resumeCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.lg,
  },
  resumeEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
    marginBottom: space.sm,
  },
  resumeRaison: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.xs,
  },
  /**
   * Réserve sur la référence (M05) : un fait posé sous le chrono, pas un
   * avertissement. Ton de la raison d'absence — même famille, même retrait.
   */
  resumeReserve: {
    fontFamily: typo.body,
    fontSize: fontSize.small,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.sm,
  },
  resumeNoChrono: {
    fontFamily: typo.monoSemi,
    fontSize: 48,
    color: colors.text.low,
  },
  hairlineRow: {
    flexDirection: 'row',
    marginTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    paddingTop: space.md,
  },
  hairlineCell: {
    flex: 1,
  },
  // ── Confiance de mesure (M03+) ──
  confianceBloc: {
    marginTop: space.md,
  },
  confianceAbsence: {
    fontFamily: typo.body,
    fontSize: fontSize.small,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.md,
  },
  confianceMotif: {
    fontFamily: typo.body,
    fontSize: fontSize.small,
    lineHeight: 17,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  confianceZone: {
    marginTop: space.md,
  },
  confianceZoneTitre: {
    fontFamily: typo.mono,
    fontSize: fontSize.small,
    color: colors.text.hi,
  },
  // ── Tendance de la séance (M06) ──
  tendanceBloc: {
    marginTop: space.xl,
  },
  tendanceLibelle: {
    fontFamily: typo.body,
    fontSize: fontSize.body,
    lineHeight: 20,
    color: colors.text.hi,
    marginTop: space.sm,
  },
  tendanceDetail: {
    fontFamily: typo.mono,
    fontSize: fontSize.small,
    color: colors.text.mid,
    fontVariant: ['tabular-nums'],
    marginTop: space.xs,
  },
  tendanceNote: {
    fontFamily: typo.body,
    fontSize: fontSize.micro,
    lineHeight: 16,
    color: colors.text.low,
    marginTop: space.sm,
  },
  // ── Fin de virage (M14/M15) ──
  vfLecture: {
    fontFamily: typo.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: colors.text.hi,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  // ── Tours ──
  toursHead: {
    minHeight: 20,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  toursHeadText: {
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.hi,
  },
  toursDelta: {
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.mid,
  },
  toursRef: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.heritage.gold,
  },
  toursHint: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
  },
  /**
   * Les marques du tour isolé : mono, discret, sous la ligne de tête. Mono
   * parce que c'est un relevé — même famille que le chrono qu'il commente.
   */
  toursMarques: {
    fontFamily: typo.mono,
    fontSize: fontSize.micro,
    lineHeight: 16,
    color: colors.text.low,
    marginTop: space.xs,
  },
  /**
   * Les déclarations humaines : même rythme que les faits qu'elles
   * accompagnent, mais en corps de texte — c'est quelqu'un qui parle, pas un
   * relevé. La nuance typographique dit la cohabitation sans ajouter de
   * couleur ni de pictogramme.
   */
  toursDeclarations: {
    fontFamily: typo.body,
    fontSize: fontSize.micro,
    lineHeight: 16,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  /**
   * La ligne « Déclarer » : sans séparateur et collée à la lecture qu'elle
   * prolonge. Elle ne se présente pas comme l'action de l'écran — l'écran sert
   * à lire une séance, déclarer n'est qu'une possibilité offerte au passage.
   */
  toursDeclarerLigne: {
    marginTop: space.xs,
  },
  /** Le mot libre, détaché des six lignes de motifs qui le précèdent. */
  champMotif: {
    marginTop: space.lg,
  },
  toursRefus: {
    fontFamily: typo.body,
    fontSize: fontSize.small,
    color: colors.text.mid,
    marginTop: space.sm,
  },
  legendMono: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text.low,
    marginTop: space.sm,
  },
  /**
   * Choix des tours : il REPLIE. Une séance ordinaire compte dix à vingt tours ;
   * sur une seule rangée, les derniers sortent de l'écran et deviennent
   * intouchables — on ne pourrait plus composer la comparaison qui intéresse.
   */
  choixTours: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  /** Note de la feuille virage : dit à quelle échelle une valeur est vraie. */
  sheetNote: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.md,
  },
  // ── Tracé ──
  traceCard: {
    marginTop: space.sm,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.md,
  },
  // ── Légende de la carte des écarts (lot 7b) ──
  legendeEcart: {
    marginTop: space.sm,
    gap: space.xs,
  },
  legendeEcartPoles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  legendeEcartPole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Un trait, pas une puce : la légende doit ressembler à ce qu'elle explique.
  legendeEcartPastille: {
    width: 18,
    height: 4,
    borderRadius: 2,
  },
  legendeEcartTexte: {
    fontFamily: typo.body,
    fontSize: fontSize.small,
    color: colors.text.low,
  },
  cornerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  cornerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  cornerDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  cornerPillLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 12,
    color: colors.text.mid,
  },
  // ── Sheet virage ──
  tabRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
    marginBottom: space.md,
  },
  // L'action du coach se pose SOUS les faits, jamais au-dessus : on lit le
  // virage d'abord, on écrit ensuite.
  annoterAction: { marginTop: space.lg, marginBottom: space.md },
  factCard: {
    backgroundColor: colors.bg.card2,
    borderRadius: radius.cell,
    padding: space.md,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  factLabel: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
  },
  factValue: {
    fontFamily: typo.mono,
    fontSize: 14,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },
  // ── Télémétrie ──
  canvasCenter: {
    alignItems: 'center',
    marginTop: space.md,
  },
  chanHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  chanValue: {
    fontFamily: typo.monoSemi,
    fontSize: 18,
    color: colors.qdi.trajectoire,
  },
  chanValueAlt: {
    fontFamily: typo.monoSemi,
    fontSize: 18,
    // Le freinage mesure 4,04:1 sur une carte — sous le seuil AA. La teinte
    // reste sur les traits et les remplissages ; le chiffre passe au gris fort.
    // Calculé, pas décrété : cf. `src/ui/v2/couleurTexte.ts`.
    color: couleurTexteSure(colors.qdi.freinage),
  },
  chanLabel: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text.low,
    marginTop: space.xs,
  },
  /**
   * Calque des graduations. `pointerEvents: 'none'` n'est pas cosmétique : sans
   * lui, une étiquette intercepterait le `Gesture.Pan()` du curseur, et le
   * scrubbing se bloquerait pile aux hauteurs graduées.
   */
  chanTicks: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  /**
   * `text.dim` (3,63:1) est ici à sa place : la doctrine le réserve au texte
   * secondaire, et un repère d'axe en est la définition — il accompagne une
   * courbe qui porte l'information, il ne la remplace pas.
   */
  chanTick: {
    position: 'absolute',
    right: 0,
    fontFamily: typo.mono,
    fontSize: 9,
    color: colors.text.dim,
  },
  heatLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  heatBar: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  // ── Constats ──
  constatsList: {
    marginTop: space.md,
  },
  // ── Conditions ──
  condCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.lg,
    marginTop: space.sm,
  },
  condLabel: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
    marginTop: space.md,
  },
  smallMultiples: {
    marginTop: space.xl,
  },
  multipleBlock: {
    marginTop: space.md,
  },
  multipleTitle: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.low,
    marginBottom: space.sm,
  },
  multipleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  multipleCol: {
    flex: 1,
    alignItems: 'center',
  },
  multipleBar: {
    width: '70%',
    borderRadius: 3,
  },
  multipleValue: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.hi,
    marginTop: space.xs,
    fontVariant: ['tabular-nums'],
  },
  multipleLabel: {
    fontFamily: typo.body,
    fontSize: 10,
    color: colors.text.low,
    marginTop: 2,
  },
  // ── Pied ──
  footerAccent: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
});
