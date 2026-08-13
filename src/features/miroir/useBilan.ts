/**
 * useBilan — orchestration données de l'écran Bilan de séance (V2-L1, 2/3).
 *
 * Services EXISTANTS uniquement (règle du lot : aucun service créé) :
 * sessions/laps (sessionsService), analyse+debrief (analysesService), QDI
 * (qdiService — branches persistées dans app_session_analyses.qdi), segments
 * (segmentAnalysesService), moments-clés (keyMomentsLogic, pur), annotations
 * coach (coachAnnotationsService), fil présentiel (useCoachThread +
 * coachMessagesService), médias (sessionMediaService), centerline
 * (circuitsService), biométrie GATÉE (featureFlagsService + consentService +
 * biometryService — fail-closed), flag vidéo (video_overlay).
 *
 * Promise.allSettled : chaque section dégrade seule (null/[]), seul l'échec
 * de la SESSION met l'écran en erreur. Toutes les décisions vivent dans
 * bilanLogic (pur, testé) — ce hook ne fait qu'orchestrer.
 *
 * Record : fetchAllSessions est appelé en STRICT — une liste rejetée (ou
 * vide alors que la séance existe) rend le record INDÉTERMINÉ : jamais un
 * record fabriqué sur panne partielle, jamais de garde posée à tort.
 *
 * Garde RecordFlash une-seule-fois PAR SÉANCE, tous écrans confondus :
 * module partagé ./recordCelebration (contrat V2-L1 accueil/bilan) — un
 * record célébré à l'accueil ne se re-célèbre pas ici, et inversement.
 */

import { useCallback, useEffect, useState } from 'react';

import type { LatLon } from '@/circuit/circuitGenerator';
import { useCoachThread } from '@/hooks/useCoachThread';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { nombresDeSeance } from '@/lib/numeriquesPostgrest';
import { supabase } from '@/lib/supabase';
import { getAnalysisForSession } from '@/services/analysesService';
import { fetchSessionCircuitCenterlineExact } from '@/services/circuitsService';
import { listVisibleAnnotationsForCorner } from '@/services/coachAnnotationsService';
import {
  listMyThreads,
  markThreadRead,
  sendMessage,
  type CoachMessage,
  type MessageThread,
} from '@/services/coachMessagesService';
import { loadBiometryConsents } from '@/services/consentService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { computeKeyMoments, type KeyMoment } from '@/services/keyMomentsLogic';
import { QDI_ALGO_VERSION } from '@/services/qdiLogic';
import { getOrComputeQdiForSession } from '@/services/qdiService';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { listSessionMedia, type SessionMediaItem } from '@/services/sessionMediaService';
import { fetchAllSessions, fetchSessionLaps } from '@/services/sessionsService';
import { getSessionBiometry } from '@/services/v2/biometryService';
import { useAuthStore } from '@/store/useAuthStore';
import type { Lap, TelemetrySession } from '@/types/telemetry';

import {
  bestLapMsOf,
  biometryQualityOf,
  biometrySourceOf,
  biometryVisible,
  buildCoachNotes,
  buildTraceMarkers,
  debriefModel,
  isPersonalRecord,
  mapPillars,
  sessionMetaLine,
  toBiometrySamples,
  validLapsOf,
  type BilanDebrief,
  type BilanPillar,
  type BilanTraceMarker,
  type CoachNoteModel,
} from './bilanLogic';
import { hasCelebrated, markCelebrated } from './recordCelebration';

export type BilanStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface BilanBiometry {
  samples: { ts: number; hr: number }[];
  source: 'montre' | 'ceinture';
  quality?: 'haute' | 'moyenne' | 'basse';
}

export interface BilanData {
  session: TelemetrySession;
  laps: Lap[];
  validLapCount: number;
  /** Meilleur tour en MILLISECONDES (contrat ChronoHero), null si rien de mesuré. */
  bestLapMs: number | null;
  /**
   * Record personnel (soi contre soi, toutes séances closes). false AUSSI
   * quand la liste des séances n'a pas pu être établie (record indéterminé
   * sur panne partielle — jamais fabriqué).
   */
  isRecord: boolean;
  /** Vrai UNE seule fois par séance, tous écrans confondus (recordCelebration). */
  celebrate: boolean;
  /** « 22 tours · 87 km », null si rien de mesuré. */
  metaLine: string | null;
  pillars: BilanPillar[];
  keyMoments: KeyMoment[];
  /**
   * Centerline STRICTE du circuit RÉEL de la séance — null si la séance n'a
   * pas de circuit rattaché ou si la géométrie manque (carte tracé masquée,
   * jamais la silhouette du circuit par défaut).
   */
  centerline: LatLon[] | null;
  traceMarkers: BilanTraceMarker[];
  /** Notes du coach visibles — [] = bande ABSENTE. */
  coachNotes: CoachNoteModel[];
  media: SessionMediaItem[];
  /** null = section ABSENTE (flag/consentement/données — fail-closed). */
  biometry: BilanBiometry | null;
  debrief: BilanDebrief;
  /** Flag `video_overlay` (OFF aujourd'hui → cellule vidéo absente). */
  videoOverlayEnabled: boolean;
  /**
   * Binôme le plus récent où l'utilisateur courant est le PILOTE (votre
   * coach), null sans binôme — jamais un fil côté coach sous son propre bilan.
   */
  thread: MessageThread | null;
}

export interface UseBilanResult {
  status: BilanStatus;
  data: BilanData | null;
  errorMessage: string | null;
  reload: () => void;
  /** Fil présentiel complet (temps réel) — l'écran tronque aux 3 dernières. */
  messages: CoachMessage[];
  /** Envoi d'une réponse sur le fil (session attachée). false si échec. */
  sendReply: (body: string) => Promise<boolean>;
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

/** Session par id — même chemin que le bilan v1 (RLS arbitre l'accès). */
async function fetchSessionById(sessionId: string): Promise<TelemetrySession | null> {
  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  /**
   * SANS CETTE CONVERSION, `best_lap_seconds` ARRIVE EN CHAÎNE.
   *
   * `bestLapMsOf` teste `typeof sessionBestSeconds === 'number'` pour son repli
   * d'agrégat — celui prévu exactement pour le cas « les lignes `laps` sont
   * encore dans la file de synchro », c'est-à-dire une capture hors-ligne au
   * retour du circuit. Le repli ne s'activait jamais, et le héros du bilan
   * affichait « — » sur un chrono parfaitement présent en base.
   */
  return nombresDeSeance(data as TelemetrySession);
}

export function useBilan(sessionId: string | undefined): UseBilanResult {
  // Sélecteurs PRIMITIFS (pas l'objet profile) : un refresh de session
  // Supabase remplace l'objet sans changer l'id — l'écran ne doit pas
  // retomber au skeleton pour autant (deps stables).
  const userId = useAuthStore((s) => s.profile?.id ?? null);
  const firstName = useAuthStore((s) => s.profile?.first_name ?? null);

  const [status, setStatus] = useState<BilanStatus>('loading');
  const [data, setData] = useState<BilanData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fil présentiel temps réel — le binôme est résolu par le chargement.
  const { messages } = useCoachThread(data?.thread?.coachPilotId ?? null);

  useEffect(() => {
    if (!userId || !sessionId) {
      setStatus(userId ? 'empty' : 'loading');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    (async () => {
      const [
        allSessionsR,
        lapsR,
        analysisR,
        qdiR,
        segmentsR,
        mediaR,
        centerlineR,
        threadsR,
        annotationsR,
        videoFlagR,
        biometryFlagR,
        consentsR,
      ] = await Promise.allSettled([
        // STRICT : une erreur DB rejette (au lieu d'un [] trompeur) — le
        // record devient alors INDÉTERMINÉ, jamais fabriqué (voir plus bas).
        fetchAllSessions(userId, { strict: true }),
        fetchSessionLaps(sessionId),
        getAnalysisForSession(sessionId),
        // Même chemin que l'accueil : recalcul paresseux des QDI 1.0.x
        // (axes G inversés) — jamais un calcul invalide présenté en mesure.
        getOrComputeQdiForSession(sessionId),
        listSegmentAnalysesForSession(sessionId),
        listSessionMedia(sessionId),
        // Centerline STRICTE du circuit RÉEL de la séance — aucun repli sur
        // le circuit par défaut : circuit inconnu → carte tracé masquée.
        fetchSessionCircuitCenterlineExact(sessionId),
        listMyThreads(userId),
        // Annotations visibles (RLS : shared, non supprimées) — le service
        // existant est par virage : on interroge la topologie réelle (7).
        Promise.all(
          BELTOISE_CORNERS.map((c) => listVisibleAnnotationsForCorner(userId, c.index, sessionId))
        ).then((lists) => lists.flat()),
        isFlagEnabled('video_overlay'),
        isFlagEnabled('biometry'),
        loadBiometryConsents(userId),
      ]);
      if (cancelled) return;

      const allSessions = settled(allSessionsR, []);

      // La session est le socle : introuvable → empty, échec réseau → error.
      let session = allSessions.find((s) => s.id === sessionId) ?? null;
      if (!session) {
        try {
          session = await fetchSessionById(sessionId);
        } catch (err) {
          if (cancelled) return;
          setErrorMessage(err instanceof Error ? err.message : String(err));
          setStatus('error');
          return;
        }
      }
      if (cancelled) return;
      if (!session) {
        setStatus('empty');
        return;
      }

      const laps = settled(lapsR, []);
      const analysis = settled(analysisR, null);
      const qdi = settled(qdiR, null);
      const segments = settled(segmentsR, []);
      const media = settled(mediaR, []);
      const centerline = settled(centerlineR, null);
      const threads = settled(threadsR, []);
      const annotations = settled(annotationsR, []);
      const videoOverlayEnabled = settled(videoFlagR, false);
      const biometryFlag = settled(biometryFlagR, false);
      const consents = settled(consentsR, { capture: false, coachShare: false });

      // Biométrie : la LECTURE elle-même est gatée (donnée de santé) — on ne
      // va chercher les échantillons que flag + consentement posés. Échec ou
      // vide → section absente, jamais un teasing (fail-closed, testé).
      let biometry: BilanBiometry | null = null;
      if (biometryFlag && consents.capture) {
        try {
          const rows = await getSessionBiometry(sessionId);
          if (cancelled) return;
          const samples = toBiometrySamples(rows);
          const source = biometrySourceOf(rows);
          if (
            biometryVisible({
              flagEnabled: biometryFlag,
              captureConsent: consents.capture,
              sampleCount: samples.length,
            }) &&
            source !== null
          ) {
            biometry = { samples, source, quality: biometryQualityOf(rows) };
          }
        } catch {
          biometry = null;
        }
      }

      const validLaps = validLapsOf(laps);
      const bestLapMs = bestLapMsOf(laps, session.best_lap_seconds);

      // Record JAMAIS fabriqué sur panne partielle : la liste stricte a
      // rejeté, OU elle est vide alors que la séance existe (incohérence) →
      // record INDÉTERMINÉ (false), pas de célébration, garde NON posée —
      // la vraie célébration reste jouable quand les données reviennent.
      const recordDeterminable = allSessionsR.status === 'fulfilled' && allSessions.length > 0;
      const isRecord = recordDeterminable && isPersonalRecord(bestLapMs, session.id, allSessions);

      // Célébration UNE seule fois par séance, TOUS écrans confondus :
      // garde partagée accueil/bilan (recordCelebration), posée AU MOMENT
      // où la célébration est accordée sur un record ÉTABLI.
      const celebrate = isRecord && !hasCelebrated(session.id);
      if (celebrate) markCelebrated(session.id);

      const keyMoments = computeKeyMoments({
        laps: laps.map((l) => ({
          lapNumber: l.lap_number,
          durationSeconds: l.duration_seconds,
          isOutlap: l.is_outlap,
          isInlap: l.is_inlap,
        })),
        segments: segments.map((sg) => ({
          segmentIndex: sg.segmentIndex,
          segmentName: sg.segmentName,
          maxGLateral: sg.maxGLateral,
        })),
      });

      const coachNotes = buildCoachNotes(annotations, threads);
      const traceMarkers = buildTraceMarkers({
        segments,
        annotatedCornerIndexes: coachNotes.map((n) => n.cornerIndex),
        centerline,
      });

      // Fil du bilan = VOTRE coach : seuls les binômes où l'utilisateur
      // courant est le PILOTE comptent ici. Un coach qui roule (compte
      // coach, séances propres) ne voit pas ses fils côté coach sous SON
      // bilan — la parole y serait attribuée à contresens.
      const thread =
        threads
          .filter((t) => t.pilotId === userId)
          .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))[0] ?? null;

      setData({
        session,
        laps,
        validLapCount: validLaps.length,
        bestLapMs,
        isRecord,
        celebrate,
        metaLine: sessionMetaLine(validLaps.length, session.distance_km),
        // QDI d'une version antérieure (1.0.x — axes G inversés, documenté
        // invalide dans qdiLogic) : si le recalcul paresseux n'a pas pu
        // produire la version courante, piliers « — », jamais la fausse mesure.
        pillars: mapPillars(qdi && qdi.algoVersion === QDI_ALGO_VERSION ? qdi : null),
        keyMoments,
        centerline,
        traceMarkers,
        coachNotes,
        media,
        biometry,
        // marginGlobalMeasured (jamais le `?? 0` historique) : une marge
        // absente ne fabrique pas un récit d'intensité.
        debrief: debriefModel(
          analysis
            ? { debriefText: analysis.debriefText, marginGlobal: analysis.marginGlobalMeasured }
            : null,
          firstName
        ),
        videoOverlayEnabled,
        thread,
      });
      setStatus('ready');
    })().catch((err) => {
      if (cancelled) return;
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('error');
    });

    return () => {
      cancelled = true;
    };
  }, [userId, firstName, sessionId, reloadKey]);

  // Les non-lus du fil tombent à l'ouverture et à chaque bulle reçue.
  useEffect(() => {
    const coachPilotId = data?.thread?.coachPilotId;
    if (coachPilotId && userId) markThreadRead(coachPilotId, userId);
  }, [data?.thread?.coachPilotId, userId, messages.length]);

  const sendReply = useCallback(
    async (body: string): Promise<boolean> => {
      const thread = data?.thread;
      if (!thread || !userId || !sessionId) return false;
      const res = await sendMessage({
        coachPilotId: thread.coachPilotId,
        coachId: thread.coachId,
        pilotId: thread.pilotId,
        senderId: userId,
        body,
        sessionId,
      });
      return res.ok;
    },
    [data?.thread, userId, sessionId]
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { status, data, errorMessage, reload, messages, sendReply };
}
