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
import { aUnCoachAffilieActif } from '@/services/pilotConsentService';
import { focusVirage, margeModel, type MargeBilan } from '@/features/miroir/margeLogic';
import { colors } from '@/ui/v2/tokens';
import { nombresDeSeance } from '@/lib/numeriquesPostgrest';
import { supabase } from '@/lib/supabase';
import { getAnalysisForSession } from '@/services/analysesService';
import { fetchSessionCircuitCenterlineExact } from '@/services/circuitsService';
import {
  listSessionNotes,
  listVisibleCornerAnnotations,
} from '@/services/coachAnnotationsService';
import {
  listMyThreads,
  markThreadRead,
  sendMessage,
  type CoachMessage,
  type MessageThread,
} from '@/services/coachMessagesService';
import { decisionCapture } from '@/features/biometrie/consentementSource';
import { sourceParId } from '@/features/biometrie/sourcesBiometrie';
import { loadBiometryConsents } from '@/services/consentService';
import { fetchSessionCircuitCorners } from '@/services/circuitsService';
import { getIntentionForSession, type SessionIntention } from '@/services/intentionsService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { computeKeyMoments, type KeyMoment } from '@/services/keyMomentsLogic';
import {
  composerPresentations,
  type Composition,
} from '@/features/presentations/compositionLogic';
import { lireEntreeComposition } from '@/features/presentations/entreeCompositionService';
import { QDI_ALGO_VERSION } from '@/services/qdiLogic';
import { getOrComputeQdiForSession } from '@/services/qdiService';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { listSessionMedia, type SessionMediaItem } from '@/services/sessionMediaService';
import {
  getForSession as listVideoOverlays,
  saveOffset as saveVideoOffset,
  type VideoOverlay,
} from '@/services/v2/videoOverlayService';
import { fetchAllSessions, fetchSessionLaps } from '@/services/sessionsService';
import { getSessionBiometry } from '@/services/v2/biometryService';
import { useAuthStore } from '@/store/useAuthStore';
import type { Lap, TelemetrySession } from '@/types/telemetry';

import {
  bestLapMsOf,
  arbitrerBiometrie,
  biometryQualityOf,
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
import {
  decalerOffset,
  synchroniserVideo,
  type SynchroVideo,
} from '@/features/data/synchroVideoLogic';

export type BilanStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface BilanBiometry {
  samples: { ts: number; hr: number }[];
  source: 'montre' | 'ceinture';
  quality?: 'haute' | 'moyenne' | 'basse';
  /**
   * Lot 10a — POURQUOI CETTE SOURCE-LÀ, quand deux ont mesuré la séance.
   * `null` quand une seule source était en lice : il n'y a alors rien à
   * expliquer, et une phrase de remplissage serait du bruit.
   */
  motifSource: string | null;
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
  /** Marge PUBLIABLE (décision 15/08 : pilote seule tant que le véhicule
   *  n'est pas caractérisé — margeLogic dit pourquoi). */
  marge: MargeBilan;

  keyMoments: KeyMoment[];
  /**
   * Les lectures que le moteur du §00 compose pour cette séance.
   *
   * `null` = le moteur n'a pas pu tourner (panne de lecture). Une composition
   * qui rend une liste VIDE n'est pas la même chose : elle veut dire que rien
   * ne s'ouvre, et `ecartees` en porte les motifs.
   */
  composition: Composition | null;
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
   * ÉTAT DE SYNCHRONISATION DE LA VIDÉO DU TOUR — `null` quand le flag est OFF.
   *
   * M24. La cellule vidéo n'affiche JAMAIS un calage sans sa marge : soit une
   * erreur chiffrée, soit la phrase qui dit que rien n'est aligné. Aujourd'hui
   * aucune vidéo n'est rattachée en production (`video_overlays` est vide) —
   * l'état rendu est donc « décalage non mesuré », et c'est exact.
   */
  synchroVideo: SynchroVideo | null;
  /**
   * L'alignement persisté de cette séance, `null` s'il n'y en a aucun. Porte
   * le `local_asset_id` sans lequel aucun réglage ne peut être réécrit.
   */
  videoOverlay: VideoOverlay | null;
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
  /**
   * Recale la vidéo d'un pas (M24). Ne fait rien tant qu'aucun alignement
   * n'existe : sans `local_asset_id`, il n'y a pas de vidéo à recaler, et
   * offrir le geste serait promettre un média absent.
   */
  reglerDecalageVideo: (sens: 1 | -1) => Promise<boolean>;
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
        viragesR,
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
        // Annotations visibles (RLS : shared, non supprimées). UNE requête pour
        // toutes les notes qui portent un virage — la topologie ne décide plus
        // de ce qu'on va chercher, elle sert seulement à nommer et à placer.
        listVisibleCornerAnnotations(userId, sessionId),
        // Les virages du circuit RÉELLEMENT roulé. Douze à Bouteville, neuf au
        // Bugatti, huit à Albi — et plus jamais les sept de Haute Saintonge.
        fetchSessionCircuitCorners(sessionId),
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
      // Liste VIDE si le circuit n'a jamais ete passe au detecteur : les puces
      // coach disparaissent, les noms retombent sur « Virage N ». Jamais les
      // virages d'un autre circuit.
      const virages = settled(viragesR, []);
      const videoOverlayEnabled = settled(videoFlagR, false);
      const biometryFlag = settled(biometryFlagR, false);
      const consents = settled(consentsR, { capture: false, coachShare: false });

      /**
       * LES LECTURES COMPOSÉES — le moteur du §00, branché le 01/09/2026.
       *
       * Elle ne peut PAS partir avec les autres : l'entrée du moteur a besoin
       * du circuit, du début et du statut de la séance, et la ligne de séance
       * n'est résolue que quelques lignes plus haut. Un aller-retour de plus,
       * assumé — le composer sur des champs devinés serait pire.
       *
       * `null` en cas de panne : la section disparaît, elle ne se vide pas.
       */
      let composition: Composition | null = null;
      try {
        composition = composerPresentations(
          await lireEntreeComposition({
            surface: 'pilote',
            piloteId: session.user_id,
            captureId: sessionId,
            circuitId: session.circuit_id ?? null,
            debutSeance: session.started_at ?? null,
            statutSeance: session.status ?? null,
            // Non évaluée ici : la note se calcule sur les trames de qualité
            // d'UN tour, donc après un choix que le bilan ne fait pas. `null`
            // est le repli sûr — il ne retient aucune donnée mesurée.
            confiance: null,
          })
        );
      } catch (err) {
        console.warn('[OXV][bilan] composition :', err instanceof Error ? err.message : err);
      }
      if (cancelled) return;

      // Biométrie : la LECTURE elle-même est gatée (donnée de santé) — on ne
      // va chercher les échantillons que flag + consentement posés. Échec ou
      // vide → section absente, jamais un teasing (fail-closed, testé).
      let biometry: BilanBiometry | null = null;
      if (biometryFlag && consents.capture) {
        try {
          const rows = await getSessionBiometry(sessionId);
          if (cancelled) return;

          /**
           * LOT 10a — UNE SOURCE RETENUE, ET DITE.
           *
           * Deux sources peuvent avoir mesuré cette séance (clé naturelle
           * `(session_id, ts, source)`). On en retient UNE, selon une règle
           * explicite, et l'on ne trace que ses points : une courbe dont
           * chaque battement a une origine connue.
           *
           * Le consentement PAR SOURCE se lit ici. Tant que la table
           * `biometry_source_consents` n'est pas appliquée, `parSource` reste
           * vide : `decisionCapture` autorise alors sur le SOCLE seul, et le
           * dit (motif `socle_seul`). Aucun accord n'est prétendu.
           */
          // Arbitrage du 26/08/2026 : la ceinture n'est mesurable que si un
          // coach affilié accompagne. Lu à chaque bilan — une affiliation peut
          // cesser après l'accord, et la source se referme alors d'elle-même,
          // sans que l'accord soit révoqué.
          const coachAffilieActif = await aUnCoachAffilieActif();
          const etatConsentements = {
            drapeauActif: biometryFlag,
            socleCapture: consents.capture,
            partageCoach: consents.coachShare,
            coachAffilieActif,
            parSource: {},
          };
          const arbitre = arbitrerBiometrie(
            rows,
            (id) => decisionCapture(etatConsentements, sourceParId(id)).autorisee
          );
          if (arbitre !== null) {
            const lignesRetenues = rows.filter((r) => r.source === arbitre.cleSource);
            const samples = toBiometrySamples(rows, arbitre.cleSource);
            if (
              biometryVisible({
                flagEnabled: biometryFlag,
                captureConsent: consents.capture,
                sampleCount: samples.length,
              })
            ) {
              biometry = {
                samples,
                source: arbitre.badge,
                // La qualité est celle des SEULES lignes retenues : moyenner
                // deux sources donnerait un chiffre qui n'appartient à aucune
                // des deux.
                quality: biometryQualityOf(lignesRetenues),
                motifSource: arbitre.motif,
              };
            }
          }
        } catch {
          biometry = null;
        }
      }

      /**
       * M24 — L'ALIGNEMENT VIDÉO, ET SA MARGE.
       *
       * Lecture GATÉE par le flag, comme la biométrie : flag OFF, aucune
       * requête, aucune cellule. Un échec de lecture ne vaut pas « pas
       * d'alignement » : il laisse `overlay` à null, et la cellule dira que
       * rien n'est aligné — jamais un calage supposé.
       *
       * Les trames ne sont pas chargées ici (le bilan n'en tient aucune) :
       * `synchroniserVideo` reçoit donc une entrée sans repère, et rend l'état
       * honnête correspondant. Le jour où un écran vidéo lira les trames, il
       * passera les mêmes repères au même module.
       */
      let videoOverlay: VideoOverlay | null = null;
      if (videoOverlayEnabled) {
        try {
          const overlays = await listVideoOverlays(sessionId);
          if (cancelled) return;
          videoOverlay = overlays.length > 0 ? overlays[0] : null;
        } catch {
          videoOverlay = null;
        }
      }
      const synchroVideo = videoOverlayEnabled
        ? synchroniserVideo({
            trames: [],
            video: null,
            reperes: [],
            offsetManuelMs: videoOverlay?.offsetMs ?? null,
          })
        : null;

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
        // Repli quand aucun segment n'est analysé : la capture a écrit le
        // maximum de la séance entière, seule sa position manque.
        gLateralMaxSeance: session.max_g_lateral ?? null,
      });

      const coachNotes = buildCoachNotes(annotations, threads, virages);

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
        virages,
        centerline,
      });
      // Le virage à creuser — `next_focus_corner_index` était persisté à
      // chaque analyse et lu par AUCUN écran (mesuré le 14/08) : la phrase
      // sans le lieu. Bleu trajectoire : une DONNÉE, ni or ni rouge.
      const focus = focusVirage(analysis?.nextFocusCornerIndex ?? null, segments);
      if (focus) {
        traceMarkers.push({ t: focus.t, color: colors.qdi.trajectoire, kind: 'focus' });
      }

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
        marge: margeModel(analysis),

        keyMoments,
        composition,
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
        synchroVideo,
        videoOverlay,
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

  const overlay = data?.videoOverlay ?? null;
  const reglerDecalageVideo = useCallback(
    async (sens: 1 | -1): Promise<boolean> => {
      if (!sessionId || overlay === null) return false;
      const offsetMs = decalerOffset(overlay.offsetMs, sens);
      const res = await saveVideoOffset({
        sessionId,
        localAssetId: overlay.localAssetId,
        offsetMs,
        durationMs: overlay.durationMs,
      });
      if (!res.ok) return false;
      // On rejoue le MÊME module pur sur le nouvel offset : l'écran ne
      // recompose jamais une phrase de son côté.
      setData((d) =>
        d === null
          ? d
          : {
              ...d,
              videoOverlay: { ...overlay, offsetMs },
              synchroVideo: synchroniserVideo({
                trames: [],
                video: null,
                reperes: [],
                offsetManuelMs: offsetMs,
              }),
            }
      );
      return true;
    },
    [sessionId, overlay]
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { status, data, errorMessage, reload, messages, sendReply, reglerDecalageVideo };
}
