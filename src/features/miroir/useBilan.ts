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
import {
  listSessionNotes,
  listVisibleAnnotationsForCorner,
} from '@/services/coachAnnotationsService';
import {
  listMyThreads,
  markThreadRead,
  sendMessage,
  type CoachMessage,
  type MessageThread,
} from '@/services/coachMessagesService';
import { loadBiometryConsents } from '@/services/consentService';
import { getIntentionForSession, type SessionIntention } from '@/services/intentionsService';
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
  /**
   * Le bilan du coach sur la séance entière — `null` = bande ABSENTE.
   *
   * Distinct des notes de virage : celles-ci désignent un endroit, celui-là
   * porte sur l'ensemble. Il vient de `coach_annotations` sans virage ni
   * instant, écrit par l'écran `rapport` du coach.
   */
  coachSessionNote: {
    id: string;
    body: string;
    /** Nom du coach — la voix est ATTRIBUÉE, jamais anonyme. */
    coachName: string | null;
    updatedAt: string;
    /**
     * Chemin de l'objet dans le bucket `coach-audio` (= id de l'annotation), ou
     * `null` si le coach n'a rien dit à la voix. Ce n'est PAS une URL jouable :
     * le bucket est privé, il faut une URL signée — cf. `getAnnotationAudioUrl`.
     */
    audioUrl: string | null;
  } | null;
  media: SessionMediaItem[];
  /**
   * CE QUE LE PILOTE S'ÉTAIT DIT AVANT DE ROULER — `null` = section ABSENTE.
   *
   * Elle est JUXTAPOSÉE, jamais évaluée : l'application ne dit pas si
   * l'intention a été tenue. Le pilote relit ce qu'il avait posé, il voit ce
   * qui s'est passé, il conclut. C'est la doctrine du miroir prise au mot.
   */
  intention: SessionIntention | null;
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
        noteSeanceR,
        intentionR,
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
        // LA NOTE DE SÉANCE — le bilan que le coach écrit sur la séance
        // ENTIÈRE, depuis le 14/08/2026. Elle ne passe pas par la requête
        // ci-dessus : celle-ci interroge virage par virage, et une note de
        // séance n'a pas de virage. La RLS filtre déjà sur `shared`.
        listSessionNotes(userId, sessionId),
        // L'INTENTION POSÉE AVANT LA SÉANCE.
        //
        // `traceNarrativeService` la charge depuis le 18/07 et la rend à son
        // appelant en la commentant « à juxtaposer (le pilote conclut) ».
        // `useMiroirHome` ne gardait que `trace.narrative` et la jetait ligne
        // suivante ; le bilan ne la demandait pas. La chaîne entière — écriture
        // dans `rec/fin`, rattachement à la séance, relecture au carnet —
        // existait sans sa moitié qui lui donne son sens.
        getIntentionForSession(sessionId),
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

      /**
       * LE BILAN DU COACH SUR LA SÉANCE — voix ATTRIBUÉE, jamais celle de l'app.
       *
       * On garde la plus récente : un coach n'en écrit qu'une par séance
       * (`upsertSessionNote` remplace la sienne), mais un pilote peut avoir eu
       * deux coachs. La plus récente est celle qui a le dernier mot, et le nom
       * l'accompagne toujours — une phrase sans auteur se lirait comme une
       * phrase de l'application.
       *
       * `null` quand il n'y en a pas : la bande est ABSENTE, pas vide.
       */
      const notesSeance = settled(noteSeanceR, []);
      const nomParCoach = new Map(threads.map((t) => [t.coachId, t.otherName]));
      const premiere = notesSeance[0];
      const coachSessionNote =
        premiere && premiere.body.trim().length > 0
          ? {
              id: premiere.id,
              body: premiere.body,
              coachName: nomParCoach.get(premiere.coachId) ?? null,
              updatedAt: premiere.updatedAt,
              audioUrl: premiere.audioUrl,
            }
          : null;
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
        coachSessionNote,
        // `settled(..., null)` : une intention illisible masque la section,
        // elle ne casse pas le bilan.
        intention: settled(intentionR, null),
        media,
        biometry,
        // marginGlobalMeasured (jamais le `?? 0` historique) : une marge
        // absente ne fabrique pas un récit d'intensité.
        debrief: debriefModel(
          analysis
            ? {
                debriefText: analysis.debriefText,
                marginGlobal: analysis.marginGlobalMeasured,
                marginBase: analysis.marginBase,
              }
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
