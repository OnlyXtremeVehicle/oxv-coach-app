/**
 * Orchestration de l'analyse post-session.
 *
 * Sem 13 J1 — câble le pipeline complet entre la fin d'un roulage et la
 * disponibilité du bilan :
 *
 *   samples (UBX local OU telemetry_frames DB)
 *     → trackviz.analyzeTrackVizSession
 *     → upsertSegmentAnalyses (14 lignes app_segment_analyses)
 *     → laps (fetchSessionLaps DB) → computeMargin
 *     → upsertAnalysis (1 ligne app_session_analyses, marge globale)
 *
 * Cette fonction est appelée depuis l'écran #11 « Données en sécurité »
 * pendant la phase de préservation, avant la transition vers #12 « Bilan
 * prêt ». L'erreur n'est jamais bloquante côté UI — si l'analyse échoue,
 * on passe quand même au bilan, qui affichera le fallback approprié.
 *
 * Trois sources de samples possibles, dans cet ordre de priorité :
 *
 *   1. `localUbxUri` fourni en option → on parse le fichier UBX local
 *      (la session vient juste de se terminer, on a tout en mémoire flash)
 *   2. `telemetry_frames` en DB → fallback rapide pour les sessions
 *      historiques ou si pas de .ubx local
 *   3. Storage `.ubx` distant → V1.1, pas câblé V1
 *
 * Tout est best-effort : si rien ne marche, on persiste juste la marge
 * globale calculée depuis les laps (déjà câblé sem 5), sans segment-level.
 */

import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';
import { UbxFrameBuffer, parseRaceBoxDataMessage } from '@/ubx/parser';
import { analyzeTrackVizSession } from '@/trackviz/analysis';
import { virageACreuser } from '@/features/miroir/margeLogic';
import { pisteDepuisBase } from '@/trackviz/pisteDepuisBase';
import {
  fetchSessionCircuitCenterlineExact,
  fetchSessionCircuitCorners,
} from '@/services/circuitsService';
import type { TrackVizRecordingSample } from '@/trackviz/types';
import type { Lap, RaceBoxData, TelemetrySession } from '@/types/telemetry';

import { OxvEvent } from './analyticsEvents';
import { computeMargin, isMarginResolved } from './marginCalculator';
import { upsertAnalysis } from './analysesService';
import { generateSafeDebrief } from './debriefGenerator';
import { computeAndPersistQdi } from './qdiService';
import { scheduleDebriefNotification } from './pushNotificationsService';
import { listSegmentAnalysesForSession, upsertSegmentAnalyses } from './segmentAnalysesService';
import { fetchSessionLaps } from './sessionsService';

export type AnalyzeSourceKind = 'ubx_local' | 'telemetry_frames' | 'none';

/**
 * Le nom du circuit d'une seance, ou `null`.
 *
 * Lecture minimale et tolerante : une panne de lecture rend `null`, ce qui
 * FERME la segmentation plutot que de l'ouvrir. Le defaut sur est de ne rien
 * ecrire, pas d'ecrire les segments d'un autre circuit.
 */
async function lireNomCircuit(sessionId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('telemetry_sessions') as any;
  const { data, error } = await table.select('circuit_name').eq('id', sessionId).maybeSingle();
  if (error) return null;
  return (data?.circuit_name as string | null) ?? null;
}

export interface AnalyzeSessionInput {
  telemetrySessionId: string;
  userId: string;
  /** Si fourni, le .ubx local est parsé en priorité. */
  localUbxUri?: string;
}

export interface AnalyzeSessionResult {
  ok: boolean;
  source: AnalyzeSourceKind;
  /** Nombre de samples passés à `analyzeTrackVizSession`. 0 si fallback laps-only. */
  sampleCount: number;
  /** Nombre de segments persistés (max 14). */
  segmentsPersisted: number;
  /** Marge globale calculée, 0..100, ou null si rien à calculer. */
  marginGlobal: number | null;
  /** Détail libre pour log / debug. */
  notes: string[];
}

const FRAMES_PAGE_SIZE = 1000;
/**
 * SOUS-ÉCHANTILLONNAGE AVANT L'ANALYSE — relevé de 600 à 3 000 le 01/09/2026.
 *
 * Six cents valait pour SEPT segments : quatre-vingt-cinq points chacun, de
 * quoi lire une entrée, une corde et une sortie. Bouteville en compte douze, le
 * Bugatti neuf, et une séance porte trois tours : six cents points y donnaient
 * seize échantillons par virage et par tour — une vitesse d'apex tirée de
 * quelques trames, sur un virage qui en compte six cents.
 *
 * Trois mille reste bon marché. Le recalage coûte `samples × points du tracé` :
 * trois mille contre les cinq cent quatre-vingt-neuf points du Bugatti font 1,8
 * million de distances, quelques dizaines de millisecondes.
 *
 * Ce n'est PAS un seuil de mesure : il ne change aucun chiffre, il change la
 * finesse avec laquelle on les lit. À revoir le jour où un circuit portera
 * beaucoup plus de virages.
 */
const TRACKVIZ_DOWNSAMPLE_MAX = 3000;

/**
 * Une session n'est analysable qu'une fois CLOSE.
 *
 * `completed` est le seul statut où les agrégats de séance sont écrits et les
 * tours remontés : en `recording` la clôture n'est pas encore drainée (elle
 * passe par la file de synchro, donc potentiellement plusieurs minutes après
 * l'arrêt), `aborted`/`processing` n'ont pas d'agrégats fiables. Analyser
 * avant, c'est mesurer une séance qui n'a pas fini d'arriver.
 */
export function isAnalyzableSession(session: Pick<TelemetrySession, 'status'>): boolean {
  return session.status === 'completed';
}

// ============================================================================
// PIPELINE PRINCIPAL
// ============================================================================

/**
 * Analyse complète d'une session de roulage + persistance.
 *
 * Ne lève jamais : toute erreur est rattrapée et reflétée dans `result.notes`.
 * L'appelant peut donc faire confiance au résultat pour piloter la navigation.
 */
export async function analyzeAndPersistSession(
  input: AnalyzeSessionInput
): Promise<AnalyzeSessionResult> {
  const notes: string[] = [];
  let source: AnalyzeSourceKind = 'none';
  let samples: TrackVizRecordingSample[] = [];

  // ── Source 1 : .ubx local ────────────────────────────────────────────────
  if (input.localUbxUri) {
    try {
      samples = await parseUbxFile(input.localUbxUri);
      if (samples.length > 0) {
        source = 'ubx_local';
        notes.push(`UBX local parsé : ${samples.length} samples bruts.`);
      } else {
        notes.push('UBX local vide ou non parsable.');
      }
    } catch (e) {
      notes.push(`UBX local KO : ${errMsg(e)}`);
    }
  }

  // ── Source 2 : telemetry_frames DB ───────────────────────────────────────
  if (samples.length === 0) {
    try {
      samples = await fetchSamplesFromFrames(input.telemetrySessionId);
      if (samples.length > 0) {
        source = 'telemetry_frames';
        notes.push(`telemetry_frames lus : ${samples.length} samples.`);
      } else {
        notes.push('Aucune frame en DB pour cette session.');
      }
    } catch (e) {
      notes.push(`Lecture telemetry_frames KO : ${errMsg(e)}`);
    }
  }

  // Downsample si trop de samples (perf SVG + perf analyse)
  if (samples.length > TRACKVIZ_DOWNSAMPLE_MAX) {
    samples = downsample(samples, TRACKVIZ_DOWNSAMPLE_MAX);
    notes.push(`Downsamplé à ${samples.length} pour analyse.`);
  }

  let segmentsPersisted = 0;
  // Le virage à creuser, choisi sur les segments RÉELS de cette séance. Hissé
  // ici parce que `analysis.segments` n'existe que dans ce bloc, et que la
  // marge se persiste beaucoup plus bas.
  let nextFocusCornerIndex: number | null = null;

  // ── Analyse trackviz par segment ─────────────────────────────────────────
  //
  // LA PISTE VIENT DE LA BASE DEPUIS LE 01/09/2026.
  //
  // Elle était écrite en dur : `HAUTE_SAINTONGE_TRACK` et ses sept segments.
  // Une capture au Mans ou à Albi y écrivait donc sept segments d'un AUTRE
  // circuit, avec des écarts latéraux kilométriques qui saturent le taux
  // d'exploitation à 1 — des marges fabriquées, persistées, affichées ensuite
  // comme des mesures.
  //
  // La garde du 30/08 a arrêté cela en refusant d'analyser hors de Haute
  // Saintonge. C'était juste, et cela laissait le trou entier : plus AUCUNE
  // séance réelle n'avait de segments, donc pas d'anatomie, donc pas de
  // lectures approfondies, donc pas de ruban. Une chaîne de six écrans tenait
  // à cette constante.
  //
  // `pisteDepuisBase` la remplace par ce que la base porte déjà : la polyligne
  // du circuit et ses virages détectés. Douze à Bouteville, neuf au Bugatti,
  // huit à Albi. Le garde de recalage, lui, RESTE — dans `analysis.ts`, où il
  // refuse un écart médian trop grand quel que soit le tracé reçu.
  const [centerline, viragesCircuit] = await Promise.all([
    fetchSessionCircuitCenterlineExact(input.telemetrySessionId).catch(() => null),
    fetchSessionCircuitCorners(input.telemetrySessionId).catch(() => []),
  ]);
  const piste = pisteDepuisBase(centerline, viragesCircuit);

  if (samples.length >= 2 && piste === null) {
    const circuitDeLaSeance = await lireNomCircuit(input.telemetrySessionId);
    notes.push(
      `Segmentation impossible pour ce circuit (${circuitDeLaSeance ?? 'circuit inconnu'}) : ` +
        `${centerline === null ? 'aucun tracé en base' : `${centerline.length} points de tracé`}, ` +
        `${viragesCircuit.length} virage(s) détecté(s).`
    );
  }

  if (samples.length >= 2 && piste !== null) {
    try {
      const analysis = analyzeTrackVizSession(samples, piste);
      nextFocusCornerIndex = virageACreuser(analysis.segments);
      segmentsPersisted = await upsertSegmentAnalyses({
        telemetrySessionId: input.telemetrySessionId,
        userId: input.userId,
        segments: analysis.segments,
      });
      notes.push(`Segments persistés : ${segmentsPersisted}/${analysis.segments.length}.`);
    } catch (e) {
      notes.push(`Analyse trackviz KO : ${errMsg(e)}`);
    }
  } else {
    notes.push('Pas assez de samples pour analyse par segment.');
  }

  // ── Insights (mirror-insights-v1) ────────────────────────────────────────
  // Calculés CÔTÉ SERVEUR via l'edge function compute-session-insights : la
  // table session_insights est en écriture service_role uniquement (RLS), donc
  // l'app ne peut pas l'écrire elle-même. Best-effort, ne bloque jamais le
  // bilan ; inactif tant que l'edge function n'est pas déployée (l'invoke
  // échoue alors proprement). La logique de calcul est testée côté app dans
  // src/services/sessionInsightsEngine.ts (miroir de l'edge).

  if (segmentsPersisted > 0) {
    try {
      const { error: insightsError } = await supabase.functions.invoke('compute-session-insights', {
        body: { sessionId: input.telemetrySessionId },
      });
      notes.push(
        insightsError ? `Insights KO : ${insightsError.message}` : 'Insights calculés (serveur).'
      );
    } catch (e) {
      notes.push(`Insights KO : ${errMsg(e)}`);
    }
    // v3 (modules rb-1 : gg_envelope, throttle_brake, flow_coherence,
    // load_transfer) — les quatre visualisations de data/session/[id] la
    // consomment et étaient VIDES depuis leur écriture faute d'invocateur
    // (mesuré le 14/08/2026). Même contrat best-effort que v1.
    try {
      const { error: v3Error } = await supabase.functions.invoke('compute-session-insights-v3', {
        body: { sessionId: input.telemetrySessionId },
      });
      notes.push(v3Error ? `Insights v3 KO : ${v3Error.message}` : 'Insights v3 calculés.');
    } catch (e) {
      notes.push(`Insights v3 KO : ${errMsg(e)}`);
    }
  }

  // ── Marge globale (depuis laps + session) ────────────────────────────────
  let marginGlobal: number | null = null;
  let computedFirstName: string | null = null;
  let computedCircuitName = 'Circuit';
  let computedStartedAt = new Date().toISOString();
  let computedBestLap: number | null = null;
  let computedLapCount = 0;
  let computedVehicle: number | null = null;
  let computedPilot: number | null = null;

  try {
    const [session, laps] = await Promise.all([
      fetchSession(input.telemetrySessionId),
      fetchSessionLaps(input.telemetrySessionId),
    ]);
    // Prénom du pilote pour le debrief de fallback (sinon le récit local
    // perd le prénom). Best-effort : si la lecture échoue, on reste à null.
    const { data: userRow } = await supabase
      .from('users')
      .select('first_name')
      .eq('id', input.userId)
      .maybeSingle();
    computedFirstName = userRow?.first_name ?? null;
    if (!session) {
      notes.push('Session introuvable pour calcul de marge globale.');
    } else if (!isAnalyzableSession(session)) {
      // Verrou : la session n'est close (`completed`) qu'une fois l'op
      // `complete` drainée par la file de synchro. Avant cela ses agrégats
      // (max_g_lateral, tours) sont partiels ou absents — analyser ici
      // figerait un chiffre faux à vie (upsert `onConflict`, jamais recalculé).
      // Le bilan recalculera de lui-même une fois la synchro passée.
      notes.push(`Session non close (${session.status}) — marge globale non calculée.`);
    } else {
      const result = computeMargin({ session, laps });
      computedCircuitName = session.circuit_name ?? 'Circuit';
      computedStartedAt = session.started_at;
      computedBestLap = session.best_lap_seconds ?? null;
      computedLapCount = laps.filter((l) => !l.is_outlap && !l.is_inlap).length;
      if (isMarginResolved(result)) {
        marginGlobal = result.marginGlobal;
        computedVehicle = result.marginVehicle;
        computedPilot = result.marginPilot;
        await upsertAnalysis({
          telemetrySessionId: input.telemetrySessionId,
          userId: input.userId,
          result,
          nextFocusCornerIndex,
        });
        notes.push(`Marge globale persistée : ${result.marginGlobal.toFixed(1)} %.`);
      } else {
        // Données réelles : on ne persiste rien plutôt qu'un chiffre comblé.
        notes.push('Marge globale non calculable (données absentes) — rien persisté.');
      }
    }
  } catch (e) {
    notes.push(`Marge globale KO : ${errMsg(e)}`);
  }

  // ── QDI 5 branches (Lot M1, décision fondateur 2026-07-04) ──────────────
  // APRÈS upsertAnalysis : le QDI est un UPDATE de la ligne
  // app_session_analyses — au premier calcul d'une session, la ligne n'existe
  // qu'une fois la marge persistée (sinon 0 ligne touchée, QDI perdu).
  // Best-effort : ne bloque jamais le bilan ; une branche sans données
  // suffisantes reste null (honnêteté).
  try {
    const qdi = await computeAndPersistQdi(input.telemetrySessionId);
    notes.push(
      qdi ? `QDI calculé (${qdi.algoVersion}).` : 'QDI non calculé (données insuffisantes).'
    );
  } catch (e) {
    notes.push(`QDI KO : ${errMsg(e)}`);
  }

  // ── Debrief J+1 généré (OpenAI d'abord, fallback local sinon) ──────────
  if (marginGlobal !== null) {
    try {
      // Tentative OpenAI via Edge Function generate-debrief-ai.
      // Opt-out IA (S5) : appliqué CÔTÉ SERVEUR — si le pilote a désactivé le
      // débrief assisté par IA (users.ai_debrief_enabled = false), l'edge
      // function renvoie 403 SANS rien transmettre à OpenAI, et l'on retombe
      // automatiquement sur le générateur local descriptif ci-dessous.
      const { error: aiError } = await supabase.functions.invoke('generate-debrief-ai', {
        body: { sessionId: input.telemetrySessionId },
      });

      if (!aiError) {
        notes.push('Debrief J+1 généré via OpenAI.');
      } else {
        // Fallback local — toujours doctrinal, juste moins riche narrativement
        console.warn('[OXV] OpenAI debrief KO, fallback local :', aiError.message);
        // Le débrief se compose sans segments — il en dira moins, il ne
        // tombera pas. `listSegmentAnalysesForSession` lève depuis le 01/09.
        const segments = await listSegmentAnalysesForSession(input.telemetrySessionId).catch(
          () => []
        );
        // Garde-fou doctrinal (T-1) : aucune tournure prescriptive n'atteint
        // debrief_text. En cas de violation (ex. nom de segment piégé), le
        // débrief est dégradé proprement plutôt que publié.
        const debrief = generateSafeDebrief({
          firstName: computedFirstName,
          circuitName: computedCircuitName,
          sessionStartedAt: computedStartedAt,
          marginGlobal,
          marginZone: null,
          marginVehicle: computedVehicle,
          marginPilot: computedPilot,
          lapCount: computedLapCount,
          bestLapSeconds: computedBestLap,
          segments,
        });
        await updateDebriefText(input.telemetrySessionId, debrief.text);
        notes.push(
          debrief.safety === 'clean'
            ? 'Debrief J+1 généré (fallback local).'
            : `Debrief J+1 généré (fallback local, garde-fou doctrinal : ${debrief.safety}).`
        );
      }

      // Programmation de la notif locale J+1. Best-effort.
      const notifId = await scheduleDebriefNotification({
        userId: input.userId,
        sessionId: input.telemetrySessionId,
      });
      if (notifId) notes.push(`Notif debrief J+1 programmée (${notifId.slice(0, 8)}…).`);
    } catch (e) {
      notes.push(`Debrief KO : ${errMsg(e)}`);
    }
  }

  const ok = segmentsPersisted > 0 || marginGlobal !== null;
  // KPI session_capture_success (§27) — `source` est catégoriel (none/ubx_local/
  // telemetry_frames), aucune donnée personnelle.
  if (ok) OxvEvent.captureReussie({ source, segments: segmentsPersisted });
  else OxvEvent.captureEchouee(source);

  return {
    ok,
    source,
    sampleCount: samples.length,
    segmentsPersisted,
    marginGlobal,
    notes,
  };
}

// ============================================================================
// SOURCE 1 — Parse d'un fichier UBX local
// ============================================================================

/**
 * Parse un fichier .ubx local et le convertit en `TrackVizRecordingSample[]`.
 *
 * Le fichier est lu en base64 (encoding contraint par expo-file-system),
 * décodé en Uint8Array, puis injecté par chunks dans `UbxFrameBuffer` pour
 * reconstruire les trames. Chaque trame valide est parsée en `RaceBoxData`
 * puis convertie en sample trackviz avec un `elapsed_ms` relatif au premier.
 */
export async function parseUbxFile(uri: string): Promise<TrackVizRecordingSample[]> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error(`Fichier introuvable : ${uri}`);
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'));

  // Injection par chunks de 4 ko pour éviter une surcharge mémoire instantanée
  const buffer = new UbxFrameBuffer();
  const chunkSize = 4096;
  const frames: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    const newFrames = buffer.push(chunk);
    frames.push(...newFrames);
  }

  const samples: TrackVizRecordingSample[] = [];
  let originMs: number | null = null;

  for (const frameBytes of frames) {
    const data = parseRaceBoxDataMessage(frameBytes);
    if (!data) continue;
    // RaceBox ne donne pas d'elapsed_ms relatif natif → on dérive depuis iTOW
    // (Time Of Week en ms). Le premier sample fixe l'origine.
    if (originMs === null) originMs = data.timestamp.iTOW;
    const elapsedMs = data.timestamp.iTOW - originMs;
    samples.push(raceBoxToTrackVizSample(data, elapsedMs));
  }

  // Tri par sécurité (UBX est déjà ordonné mais on protège)
  samples.sort((a, b) => a.elapsed_ms - b.elapsed_ms);
  return samples;
}

// ============================================================================
// SOURCE 2 — Lecture des telemetry_frames DB
// ============================================================================

interface FrameRow {
  elapsed_ms: number;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  gps_accuracy_m: number | null;
  gps_fix: number | null;
  satellites: number | null;
  speed_kmh: number | null;
  heading: number | null;
  g_force_x: number | null;
  g_force_y: number | null;
  g_force_z: number | null;
  battery_level: number | null;
}

async function fetchSamplesFromFrames(sessionId: string): Promise<TrackVizRecordingSample[]> {
  // Pagination explicite (par défaut 1000 lignes max côté supabase-js)
  const samples: TrackVizRecordingSample[] = [];
  let offset = 0;
  // Bornes de sécurité : une session 10 min @ 5 Hz = 3000 frames. On stoppe à 50k.
  const SAFETY_LIMIT = 50_000;

  while (offset < SAFETY_LIMIT) {
    const { data, error } = await supabase
      .from('telemetry_frames')
      .select(
        'elapsed_ms, latitude, longitude, altitude_m, gps_accuracy_m, gps_fix, satellites, speed_kmh, heading, g_force_x, g_force_y, g_force_z, battery_level'
      )
      .eq('session_id', sessionId)
      .order('elapsed_ms', { ascending: true })
      .range(offset, offset + FRAMES_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as FrameRow[];
    for (const row of page) {
      if (row.latitude === null || row.longitude === null) continue;
      samples.push({
        elapsed_ms: row.elapsed_ms,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        altitude_m: row.altitude_m !== null ? Number(row.altitude_m) : null,
        speed_kmh: row.speed_kmh !== null ? Number(row.speed_kmh) : 0,
        heading_deg: row.heading !== null ? Number(row.heading) : null,
        g_force_x: row.g_force_x !== null ? Number(row.g_force_x) : 0,
        g_force_y: row.g_force_y !== null ? Number(row.g_force_y) : 0,
        g_force_z: row.g_force_z !== null ? Number(row.g_force_z) : 1,
        gps_accuracy_m: row.gps_accuracy_m !== null ? Number(row.gps_accuracy_m) : null,
        gps_fix: row.gps_fix !== null ? Number(row.gps_fix) : 0,
        satellites: row.satellites,
        battery_level: row.battery_level,
        source: 'ble',
      });
    }
    if (page.length < FRAMES_PAGE_SIZE) break;
    offset += FRAMES_PAGE_SIZE;
  }

  return samples;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Conversion `RaceBoxData` (parser UBX) → `TrackVizRecordingSample` (analyse).
 * Exporté pour les tests et pour un usage temps réel hypothétique.
 */
export function raceBoxToTrackVizSample(
  data: RaceBoxData,
  elapsedMs: number
): TrackVizRecordingSample {
  return {
    elapsed_ms: Math.max(0, elapsedMs),
    latitude: data.gps.latitude,
    longitude: data.gps.longitude,
    altitude_m: data.gps.altitude,
    speed_kmh: data.motion.speed,
    heading_deg: data.motion.headingValid ? data.motion.heading : null,
    g_force_x: data.imu.gForceX,
    g_force_y: data.imu.gForceY,
    g_force_z: data.imu.gForceZ,
    gps_accuracy_m: data.gps.accuracy,
    gps_fix: data.gps.fix,
    satellites: data.gps.satellites,
    battery_level: data.battery.level,
    source: 'ble',
  };
}

/**
 * Downsample uniforme — garde N samples répartis sur la durée totale.
 * Préserve toujours le premier et le dernier sample pour ne pas tronquer
 * artificiellement la session.
 */
function downsample<T>(samples: T[], target: number): T[] {
  if (samples.length <= target) return samples;
  const step = (samples.length - 1) / (target - 1);
  const out: T[] = [];
  for (let i = 0; i < target; i++) {
    const idx = Math.round(i * step);
    out.push(samples[idx]);
  }
  return out;
}

async function fetchSession(sessionId: string): Promise<TelemetrySession | null> {
  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as TelemetrySession;
}

async function updateDebriefText(sessionId: string, text: string): Promise<void> {
  const { error } = await supabase
    .from('app_session_analyses')
    .update({ debrief_text: text })
    .eq('telemetry_session_id', sessionId);
  if (error) throw new Error(error.message);
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// Export interne pour faciliter les tests unitaires
export const __testing = {
  downsample,
  fetchSamplesFromFrames,
  raceBoxToTrackVizSample,
};

// Lap est ré-exporté implicitement pour faciliter le typage côté appelant
// (évite à l'app/(app)/donnees-securite d'importer 2 modules)
export type { Lap };
