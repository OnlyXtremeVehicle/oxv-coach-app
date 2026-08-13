/**
 * useCarnet — chargement du Carnet à 4 onglets (V2-L4, porte VOUS, 4/8).
 *
 * Services EXISTANTS uniquement (règle du lot : aucun service créé) :
 *   - Notes      : pilotNotesService (listMyNotes, addNote, setNoteShared) ;
 *   - Intentions : intentionsService (getPendingIntention, getIntentionForSession)
 *                  croisé aux séances récentes (sessionsService.fetchAllSessions),
 *                  faute d'un endpoint « toutes mes intentions » — coût borné ;
 *   - Objectifs  : pilotGoalsService (listMyGoals) — invisibles du coach ;
 *   - Programme  : developmentCycleService (listSharedCyclesForMe) — cycles
 *                  partagés par le coach, lus tels quels.
 *
 * Météo « du jour de la note » (A-WEATHER-1) : lecture DIRECTE de
 * `weather_snapshots` (même patron de lecture directe que useMiroirHome), en
 * gardant la température NULLABLE telle qu'en base — impossible via
 * weatherService.fetchSessionWeather, qui coerce les manquantes à 0 (ce qui
 * fabriquerait un « 0° du jour »). On ne construit un résumé QUE sur un relevé
 * réel du même jour (summarizeNoteWeather, pur & testé).
 *
 * Une source en panne ne prive pas les autres (Promise.allSettled). Les services
 * avalent déjà leurs erreurs (retour []), donc l'état d'erreur global n'apparaît
 * que sur exception inattendue du chargement ; chaque onglet rend sinon son
 * propre vide (StateView par section).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { type SharedCycle, listSharedCyclesForMe } from '@/services/developmentCycleService';
import {
  type SessionIntention,
  getIntentionForSession,
  getPendingIntention,
  setIntentionShared,
} from '@/services/intentionsService';
import { type PilotGoal, listMyGoals } from '@/services/pilotGoalsService';
import {
  type PilotNote,
  addNote as addNoteService,
  listMyNotes,
  setNoteShared,
} from '@/services/pilotNotesService';
import { fetchAllSessions } from '@/services/sessionsService';

import { summarizeNoteWeather, type NoteWeather } from './carnetLogic';

/** Plafond de séances récentes inspectées pour retrouver leurs intentions. */
const INTENTION_SESSION_LIMIT = 12;

// ---------------------------------------------------------------------------
// Types exposés à l'écran
// ---------------------------------------------------------------------------

export interface CarnetNoteItem {
  note: PilotNote;
  /** Météo réelle du jour de la note, ou null (section masquée — A-WEATHER-1). */
  weather: NoteWeather | null;
}

export interface CarnetIntentionItem {
  intention: SessionIntention;
  /** Nom du circuit de la séance source (null pour l'intention en attente). */
  circuitName: string | null;
  /** started_at de la séance source (null pour l'intention en attente). */
  sessionStartedAt: string | null;
}

export interface CarnetState {
  status: 'loading' | 'ready' | 'error';
  notes: CarnetNoteItem[];
  intentions: CarnetIntentionItem[];
  goals: PilotGoal[];
  cycles: SharedCycle[];
}

export interface Carnet extends CarnetState {
  reload: () => void;
  /** Ajoute une note (le pilote écrit son texte — jamais l'app). Recharge au succès. */
  addNote: (body: string) => Promise<boolean>;
  /** Bascule le partage coach d'une note (optimiste, recharge en cas d'échec). */
  toggleNoteShared: (noteId: string, next: boolean) => Promise<void>;
  /**
   * Bascule le partage coach d'une INTENTION.
   *
   * La carte de fin de séance promet « révocable à tout moment ». Jusqu'au lot
   * J5, `setIntentionShared` n'avait AUCUN appelant dans le dépôt : la promesse
   * était écrite, la révocation n'existait pas. Le carnet est l'endroit où le
   * pilote retrouve ses intentions — c'est donc là qu'il les reprend.
   */
  toggleIntentionShared: (intentionId: string, next: boolean) => Promise<void>;
}

const INITIAL: CarnetState = {
  status: 'loading',
  notes: [],
  intentions: [],
  goals: [],
  cycles: [],
};

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

// ---------------------------------------------------------------------------
// Météo du jour de la note — lecture directe, température NULLABLE préservée
// ---------------------------------------------------------------------------

interface RawWeatherRow {
  session_id: string;
  captured_at: string;
  temperature_c: number | null;
  weather_label: string | null;
}

/**
 * Pour les séances liées aux notes, le premier relevé météo RÉEL par séance
 * (température non nulle). Lecture directe : on préserve la nullité de
 * `temperature_c` que la coercition du service masquerait (A-WEATHER-1).
 */
async function fetchNoteWeatherBySession(
  sessionIds: readonly string[]
): Promise<Map<string, RawWeatherRow>> {
  const map = new Map<string, RawWeatherRow>();
  if (sessionIds.length === 0) return map;
  const { data, error } = await supabase
    .from('weather_snapshots')
    .select('session_id, captured_at, temperature_c, weather_label')
    .in('session_id', sessionIds as string[])
    .order('captured_at', { ascending: true });
  if (error || !data) return map;
  for (const raw of data as RawWeatherRow[]) {
    if (raw.temperature_c == null) continue; // jamais un 0° fabriqué
    if (!map.has(raw.session_id)) map.set(raw.session_id, raw);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCarnet(userId: string | null): Carnet {
  const [state, setState] = useState<CarnetState>(INITIAL);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (userId === null) {
      if (alive.current) setState({ ...INITIAL, status: 'ready' });
      return;
    }

    const [notesR, sessionsR, pendingR, goalsR, cyclesR] = await Promise.allSettled([
      listMyNotes(),
      fetchAllSessions(userId, { limit: INTENTION_SESSION_LIMIT }),
      getPendingIntention(),
      listMyGoals(),
      listSharedCyclesForMe(),
    ]);

    const notes = settled(notesR, [] as PilotNote[]);
    const sessions = settled(sessionsR, []);
    const pending = settled(pendingR, null);
    const goals = settled(goalsR, [] as PilotGoal[]);
    const cycles = settled(cyclesR, [] as SharedCycle[]);

    // Intentions : une par séance récente qui en porte une (own-row RLS), plus
    // l'intention en attente en tête. Faute d'endpoint « toutes mes intentions »,
    // on interroge séance par séance (coût borné à INTENTION_SESSION_LIMIT).
    const linkedResults = await Promise.allSettled(
      sessions.map((s) => getIntentionForSession(s.id))
    );
    const intentions: CarnetIntentionItem[] = [];
    if (pending !== null) {
      intentions.push({ intention: pending, circuitName: null, sessionStartedAt: null });
    }
    linkedResults.forEach((res, i) => {
      const intention = res.status === 'fulfilled' ? res.value : null;
      if (intention === null || intention.id === pending?.id) return;
      const session = sessions[i];
      intentions.push({
        intention,
        circuitName: session?.circuit_name ?? null,
        sessionStartedAt: session?.started_at ?? null,
      });
    });

    // Météo du jour, seulement pour les notes rattachées à une séance.
    const noteSessionIds = Array.from(
      new Set(notes.map((n) => n.sessionId).filter((id): id is string => id != null))
    );
    const weatherBySession = await fetchNoteWeatherBySession(noteSessionIds);
    const noteItems: CarnetNoteItem[] = notes.map((note) => {
      const snap = note.sessionId ? (weatherBySession.get(note.sessionId) ?? null) : null;
      return {
        note,
        weather: summarizeNoteWeather(
          snap
            ? {
                capturedAt: snap.captured_at,
                temperatureC: snap.temperature_c,
                weatherLabel: snap.weather_label,
              }
            : null,
          note.createdAt
        ),
      };
    });

    if (!alive.current) return;
    setState({ status: 'ready', notes: noteItems, intentions, goals, cycles });
  }, [userId]);

  useEffect(() => {
    alive.current = true;
    setState((s) => ({ ...s, status: 'loading' }));
    load().catch(() => {
      if (alive.current) setState({ ...INITIAL, status: 'error' });
    });
    return () => {
      alive.current = false;
    };
  }, [load]);

  const reload = useCallback(() => {
    load().catch(() => {
      if (alive.current) setState((s) => ({ ...s, status: 'error' }));
    });
  }, [load]);

  const addNoteCb = useCallback(
    async (body: string): Promise<boolean> => {
      const res = await addNoteService(body, null);
      if (res.ok) reload();
      return res.ok;
    },
    [reload]
  );

  const toggleNoteShared = useCallback(
    async (noteId: string, next: boolean): Promise<void> => {
      // Optimiste : reflète tout de suite, recharge en cas d'échec.
      setState((s) => ({
        ...s,
        notes: s.notes.map((it) =>
          it.note.id === noteId ? { ...it, note: { ...it.note, sharedWithCoach: next } } : it
        ),
      }));
      const res = await setNoteShared(noteId, next);
      if (!res.ok) reload();
    },
    [reload]
  );

  const toggleIntentionShared = useCallback(
    async (intentionId: string, next: boolean): Promise<void> => {
      // Même patron que les notes : optimiste, puis rechargement si le serveur
      // refuse — l'interrupteur ne reste jamais sur un état que la base ignore.
      setState((s) => ({
        ...s,
        intentions: s.intentions.map((it) =>
          it.intention.id === intentionId
            ? { ...it, intention: { ...it.intention, sharedWithCoach: next } }
            : it
        ),
      }));
      const res = await setIntentionShared(intentionId, next);
      if (!res.ok) reload();
    },
    [reload]
  );

  return { ...state, reload, addNote: addNoteCb, toggleNoteShared, toggleIntentionShared };
}
