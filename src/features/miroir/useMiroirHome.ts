/**
 * useMiroirHome — chargement de l'accueil Miroir (lot V2-L1, écran 1/3).
 *
 * Services EXISTANTS uniquement (règle du lot : aucun service créé) ; les
 * quelques lectures directes Supabase reproduisent le patron du Paddock v1
 * (app/(app)/index.tsx — référence de câblage réel) et de getQdiAccessLevel.
 *
 * Deux vagues Promise.allSettled (best-effort, une source en panne ne prive
 * pas l'écran des autres) :
 *   1. dernière séance · stats · prochaine journée · flag app_payments ·
 *      garage (véhicules + covers) · inscriptions (tier Heritage) · pack
 *      Heritage (compteur réel) · avatar ;
 *   2. dépendantes de la séance : laps · QDI (version courante) · narrative ·
 *      médias.
 * Puis la météo ACTUELLE du circuit de la prochaine journée (≤ 7 j, nom
 * EXACT — pas de météo d'un autre circuit ; l'écran le dit : « météo
 * actuelle », jamais présentée comme une prévision du jour J).
 *
 * CANAL D'ERREUR (règle « données réelles câblées ») : les trois sources
 * PRIMAIRES (dernière séance, stats, prochaine journée) sont lues en mode
 * strict — une erreur DB REJETTE au lieu de se déguiser en vide. Les trois
 * rejetées ensemble = panne totale → status 'error' (StateView + retry),
 * jamais un écran calme qui affirme « aucune journée » ou « 0 km » à tort.
 * Une panne PARTIELLE laisse l'écran rendre les sources vivantes ; les
 * absentes s'affichent « — » / section masquée (stats: null → « — »).
 *
 * Toutes les décisions vivent dans miroirHomeLogic (pur, testé). Données
 * absentes → null / objets vides — l'écran masque ou affiche « — ».
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { storage } from '@/lib/mmkv';
import { supabase } from '@/lib/supabase';
import { fetchCircuits } from '@/services/circuitsService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { listMyVehicles } from '@/services/garageService';
import { getMyNextTrackDay, type NextTrackDay } from '@/services/nextTrackDayService';
import { getMyVehicleCovers } from '@/services/pilotMediaService';
import { QDI_ALGO_VERSION } from '@/services/qdiLogic';
import { getOrComputeQdiForSession, getQdiForSession, type QdiRecord } from '@/services/qdiService';
import { listSessionMedia } from '@/services/sessionMediaService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { loadPilotStats, type PilotStats } from '@/services/statsService';
import { loadTraceOfDay } from '@/services/traceNarrativeService';
import { fetchCurrentWeather } from '@/services/weatherService';

import {
  activeHeritagePack,
  bestLapMs,
  daysUntil,
  decideHomeMode,
  heritageOf,
  isPersonalRecord,
  pickSessionPhotoUrl,
  pickVehicleCover,
  qdiToRadarValues,
  ritualBannerKey,
  seasonFact,
  weatherEligible,
  type HeritagePackCounter,
  type HeritagePackRef,
  type HeritageTier,
  type HomeMode,
  type QdiKey,
  type RegistrationRef,
} from './miroirHomeLogic';
import { hasCelebrated, markCelebrated } from './recordCelebration';

// ---------------------------------------------------------------------------
// Types exposés à l'écran
// ---------------------------------------------------------------------------

export interface MiroirLastSession {
  id: string;
  circuitName: string | null;
  /** ISO — started_at de la séance. */
  startedAt: string;
  /** Meilleur tour en MILLISECONDES (contrat ChronoHero), ou null. */
  bestMs: number | null;
  /** La séance porte le record personnel all-time. */
  isRecord: boolean;
}

export interface MiroirFact {
  text: string;
  kind: 'narrative' | 'saison';
}

export interface MiroirWeather {
  temperatureC: number;
  label: string;
}

export interface MiroirHomeState {
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  mode: HomeMode;
  lastSession: MiroirLastSession | null;
  /** Branches QDI mesurées (0..100). Vide = pas de QDI → section masquée. */
  qdiValues: Partial<Record<QdiKey, number>>;
  fact: MiroirFact | null;
  nextDay: NextTrackDay | null;
  daysToNextDay: number | null;
  weather: MiroirWeather | null;
  stats: PilotStats | null;
  vehiclePhotoUrl: string | null;
  lastSessionPhotoUrl: string | null;
  avatarUrl: string | null;
  heritage: HeritageTier;
  /** Compteur x/y du pack Heritage ACTIF (heritage_packs, RLS own) — null = pas de pack. */
  heritagePack: HeritagePackCounter | null;
  paymentsEnabled: boolean;
  /** Vrai UNE fois par séance-record (garde MMKV UNIFIÉE accueil/bilan). */
  celebrateRecord: boolean;
  /** Bandeau rituel J-3 déjà écarté pour CETTE journée (MMKV). */
  ritualDismissed: boolean;
}

export interface MiroirHome extends MiroirHomeState {
  /** Rechargement complet (PullToRefreshDial, bouton Réessayer). */
  refresh: () => void;
  /** À appeler à la fin du RecordFlash : pose la garde une-fois (partagée bilan). */
  markRecordCelebrated: () => void;
  /** Écarte le bandeau rituel J-3 pour la journée courante (persisté MMKV). */
  dismissRitual: () => void;
}

const INITIAL: MiroirHomeState = {
  status: 'loading',
  refreshing: false,
  mode: 'entre_journees',
  lastSession: null,
  qdiValues: {},
  fact: null,
  nextDay: null,
  daysToNextDay: null,
  weather: null,
  stats: null,
  vehiclePhotoUrl: null,
  lastSessionPhotoUrl: null,
  avatarUrl: null,
  heritage: { isHeritage: false },
  heritagePack: null,
  paymentsEnabled: false,
  celebrateRecord: false,
  ritualDismissed: false,
};

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

/**
 * Garde partagée lue en best-effort : MMKV indisponible → considéré CÉLÉBRÉ
 * (au doute, on ne rejoue pas — jamais une célébration fabriquée), et une
 * panne de stockage ne fait pas basculer tout le chargement en erreur.
 */
function celebratedSafe(sessionId: string): boolean {
  try {
    return hasCelebrated(sessionId);
  } catch {
    return true;
  }
}

interface SessionRow {
  id: string;
  started_at: string;
  circuit_name: string | null;
  best_lap_seconds: number | null;
}

/**
 * Dernière séance close — même requête que le Paddock v1 (référence).
 * STRICT : une erreur DB REJETTE (canal d'erreur de l'accueil) — null est
 * réservé au vrai vide (« aucune séance »), jamais à une panne déguisée.
 */
async function fetchLastSession(userId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select('id, started_at, circuit_name, best_lap_seconds')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`fetchLastSession : ${error.message}`);
  return (data as SessionRow | null) ?? null;
}

/** Inscriptions récentes — même lecture que getQdiAccessLevel (tri DESC). */
async function fetchRecentRegistrations(userId: string): Promise<RegistrationRef[]> {
  const { data } = await supabase
    .from('registrations')
    .select('offer_type, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  return (data ?? []) as RegistrationRef[];
}

async function fetchAvatarUrl(userId: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('avatar_url').eq('id', userId).maybeSingle();
  return (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
}

/**
 * Pack Heritage ACTIF du pilote (heritage_packs, RLS own) : le compteur x/y
 * vient des VRAIES colonnes sessions_used/sessions_total — la décision
 * (validité, bornes) vit dans activeHeritagePack (pur, testé).
 */
async function fetchActiveHeritagePack(
  userId: string,
  now: Date
): Promise<HeritagePackCounter | null> {
  const { data } = await supabase
    .from('heritage_packs')
    .select('sessions_used, sessions_total, status, valid_until')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('valid_until', { ascending: false })
    .limit(1)
    .maybeSingle();
  return activeHeritagePack((data as HeritagePackRef | null) ?? null, now);
}

/** Météo ACTUELLE du circuit de la journée — nom EXACT uniquement (honnête). */
async function fetchNextDayWeather(nextDay: NextTrackDay): Promise<MiroirWeather | null> {
  if (nextDay.circuitName === null) return null;
  const circuits = await fetchCircuits();
  const circuit = circuits.find((c) => c.name === nextDay.circuitName);
  if (
    !circuit ||
    !Number.isFinite(circuit.finishLineLat) ||
    !Number.isFinite(circuit.finishLineLon) ||
    (circuit.finishLineLat === 0 && circuit.finishLineLon === 0)
  ) {
    return null;
  }
  const w = await fetchCurrentWeather(circuit.finishLineLat, circuit.finishLineLon);
  if (!w) return null;
  return { temperatureC: w.temperatureC, label: w.weatherLabel };
}

// ---------------------------------------------------------------------------
// QDI de la dernière séance — version courante SEULEMENT, coût borné
// ---------------------------------------------------------------------------

/**
 * Garde une-fois-par-lancement du recalcul paresseux : si l'analyse serveur
 * n'existe pas encore, computeAndPersistQdi ne persiste RIEN (UPDATE 0 ligne)
 * et chaque focus/refresh re-payerait le travail entier (jusqu'à ~60 requêtes
 * de trames + compute). Une tentative par séance et par lancement suffit —
 * le Bilan (rendez-vous naturel) et le prochain lancement retenteront.
 */
const qdiComputeAttempted = new Set<string>();

/**
 * QDI de la dernière séance — VERSION COURANTE uniquement : un QDI persisté
 * sous 1.0.x (axes G inversés, documenté invalide dans qdiLogic) n'est JAMAIS
 * affiché. Le recalcul paresseux n'est tenté que si le QDI valide manque ET
 * que la séance est récente (< 7 j — le seul cas où l'accueil est le premier
 * lecteur), une fois par lancement ; sinon lecture persistée filtrée version,
 * absence → radar masqué (pas de valeur inventée).
 */
async function loadHomeQdi(sessionId: string, recentSession: boolean): Promise<QdiRecord | null> {
  const persisted = await getQdiForSession(sessionId);
  if (persisted !== null && persisted.algoVersion === QDI_ALGO_VERSION) return persisted;
  if (!recentSession || qdiComputeAttempted.has(sessionId)) return null;
  qdiComputeAttempted.add(sessionId);
  const computed = await getOrComputeQdiForSession(sessionId);
  return computed !== null && computed.algoVersion === QDI_ALGO_VERSION ? computed : null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMiroirHome(userId: string | null): MiroirHome {
  const [state, setState] = useState<MiroirHomeState>(INITIAL);
  const alive = useRef(true);

  const load = useCallback(
    async (refreshing: boolean) => {
      if (userId === null) {
        if (alive.current) setState({ ...INITIAL, status: 'ready' });
        return;
      }
      if (refreshing && alive.current) setState((s) => ({ ...s, refreshing: true }));

      const now = new Date();

      // Vague 1 — sources indépendantes. Les trois PRIMAIRES sont strictes
      // (rejet sur erreur DB) pour que le canal d'erreur soit réel.
      const [sessionR, statsR, nextDayR, flagR, vehiclesR, coversR, regsR, packR, avatarR] =
        await Promise.allSettled([
          fetchLastSession(userId),
          loadPilotStats(userId, { strict: true }),
          getMyNextTrackDay(userId, { strict: true }),
          isFlagEnabled('app_payments'),
          listMyVehicles(),
          getMyVehicleCovers(),
          fetchRecentRegistrations(userId),
          fetchActiveHeritagePack(userId, now),
          fetchAvatarUrl(userId),
        ]);

      // Panne TOTALE des sources primaires → état d'erreur honnête, jamais
      // un écran calme qui affirme « aucune journée » / « 0 km » à tort.
      if (
        sessionR.status === 'rejected' &&
        statsR.status === 'rejected' &&
        nextDayR.status === 'rejected'
      ) {
        if (alive.current) setState({ ...INITIAL, status: 'error' });
        return;
      }

      const sessionRow = settled(sessionR, null);
      const stats = settled(statsR, null); // rejet partiel → null → « — » à l'écran
      const nextDay = settled(nextDayR, null);
      const paymentsEnabled = settled(flagR, false); // fail-closed
      const vehicles = settled(vehiclesR, []);
      const covers = settled(coversR, {});
      const heritage = heritageOf(settled(regsR, []));
      const heritagePack = settled(packR, null);
      const avatarUrl = settled(avatarR, null);

      // Vague 2 — dépendantes de la dernière séance.
      let lastSession: MiroirLastSession | null = null;
      let qdiValues: MiroirHomeState['qdiValues'] = {};
      let narrativeText: string | null = null;
      let lastSessionPhotoUrl: string | null = null;
      if (sessionRow !== null) {
        const recent = decideHomeMode(sessionRow.started_at, now) === 'apres_seance';
        const [lapsR, qdiR, traceR, mediaR] = await Promise.allSettled([
          fetchSessionLaps(sessionRow.id),
          loadHomeQdi(sessionRow.id, recent),
          loadTraceOfDay(userId, sessionRow.id),
          listSessionMedia(sessionRow.id),
        ]);
        const bestMs = bestLapMs(settled(lapsR, []), sessionRow.best_lap_seconds);
        lastSession = {
          id: sessionRow.id,
          circuitName: sessionRow.circuit_name,
          startedAt: sessionRow.started_at,
          bestMs,
          // stats absentes (rejet partiel) → all-time inconnu → jamais un
          // record affirmé (isPersonalRecord rend false sur null).
          isRecord: isPersonalRecord(
            bestMs !== null ? bestMs / 1000 : null,
            stats?.bestLapSeconds ?? null
          ),
        };
        qdiValues = qdiToRadarValues(settled(qdiR, null));
        narrativeText = settled(traceR, null)?.trace.narrative ?? null;
        lastSessionPhotoUrl = pickSessionPhotoUrl(settled(mediaR, []));
      }

      const mode = decideHomeMode(lastSession?.startedAt ?? null, now);

      // Météo — uniquement si la journée est à 7 jours ou moins.
      let weather: MiroirWeather | null = null;
      if (nextDay !== null && weatherEligible(nextDay.date, now)) {
        try {
          weather = await fetchNextDayWeather(nextDay);
        } catch {
          weather = null;
        }
      }

      // Le fait : narrative en après-séance, fait de saison sinon (ou à défaut).
      const saison = seasonFact(stats);
      const fact: MiroirFact | null =
        mode === 'apres_seance' && narrativeText !== null
          ? { text: narrativeText, kind: 'narrative' }
          : saison !== null
            ? { text: saison, kind: 'saison' }
            : null;

      // Garde UNIFIÉE accueil/bilan (recordCelebration) : un record célébré
      // sur l'un des deux écrans ne se re-célèbre jamais sur l'autre.
      const celebrateRecord =
        lastSession !== null &&
        lastSession.isRecord &&
        lastSession.bestMs !== null &&
        !celebratedSafe(lastSession.id);

      // Bandeau rituel J-3 : dismiss persisté par JOURNÉE (best-effort MMKV).
      let ritualDismissed = false;
      if (nextDay !== null) {
        try {
          ritualDismissed = storage.getBoolean(ritualBannerKey(nextDay.date)) === true;
        } catch {
          ritualDismissed = false;
        }
      }

      if (!alive.current) return;
      setState({
        status: 'ready',
        refreshing: false,
        mode,
        lastSession,
        qdiValues,
        fact,
        nextDay,
        daysToNextDay: nextDay !== null ? daysUntil(nextDay.date, now) : null,
        weather,
        stats,
        vehiclePhotoUrl: pickVehicleCover(vehicles, covers),
        lastSessionPhotoUrl,
        avatarUrl,
        heritage,
        heritagePack,
        paymentsEnabled,
        celebrateRecord,
        ritualDismissed,
      });
    },
    [userId]
  );

  useEffect(() => {
    alive.current = true;
    load(false).catch(() => {
      // Exception inattendue au premier chargement : état d'erreur honnête
      // (jamais un écran « ready » calme sur données jamais chargées).
      if (alive.current) setState({ ...INITIAL, status: 'error' });
    });
    return () => {
      alive.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    load(true).catch(() => {
      // Rafraîchissement en échec inattendu : on garde le contenu affiché
      // (dernier état connu), on cesse simplement de tourner.
      if (alive.current) setState((s) => ({ ...s, refreshing: false }));
    });
  }, [load]);

  const markRecordCelebrated = useCallback(() => {
    setState((s) => {
      if (s.lastSession !== null) {
        try {
          markCelebrated(s.lastSession.id);
        } catch {
          // MMKV indisponible : la garde retombera au prochain chargement.
        }
      }
      return { ...s, celebrateRecord: false };
    });
  }, []);

  const dismissRitual = useCallback(() => {
    setState((s) => {
      if (s.nextDay !== null) {
        try {
          storage.set(ritualBannerKey(s.nextDay.date), true);
        } catch {
          // MMKV indisponible : le bandeau reviendra au prochain chargement.
        }
      }
      return { ...s, ritualDismissed: true };
    });
  }, []);

  return { ...state, refresh, markRecordCelebrated, dismissRitual };
}
