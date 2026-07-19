/**
 * useGalerie — chargement de la Galerie (V2-L5 CLUB, Mission D, écran 6/7).
 *
 * Services EXISTANTS uniquement (le lot n'en crée pas hors heritageBookExport) ;
 * les quelques lectures directes reproduisent le patron de useMiroirHome
 * (référence de câblage réel). Deux vagues Promise.allSettled (best-effort — une
 * source en panne ne prive pas l'écran des autres) :
 *   1. tous les médias · métas de séances (en-têtes + carte-souvenir) · flag
 *      video_overlay · tier Heritage (registrations) · liens de partage ;
 *   2. tracé de la séance-record (carte-souvenir).
 *
 * Règle « données réelles » : les décisions (groupement, mosaïque, gating) vivent
 * dans galerieLogic (pur, testé). Données absentes → section masquée / « — ».
 * Panne des DEUX sources structurantes (médias ET métas) → status 'error'.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { LatLon } from '@/circuit/circuitGenerator';
import { fetchSessionCircuitCenterlineExact } from '@/services/circuitsService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { listAllPilotMedia, type SessionMediaItem } from '@/services/sessionMediaService';
import { listMyShares, type ShareLink } from '@/services/sharesService';
import { supabase } from '@/lib/supabase';
import { formatDateLong, formatLapTimeMs } from '@/utils/format';

import {
  flattenSections,
  getMediaSections,
  heritageOf,
  viewablePhotos,
  type GalleryRow,
  type GallerySection,
  type HeritageTier,
  type RegistrationRef,
  type SessionMetaRef,
  type ViewablePhoto,
} from './galerieLogic';

export interface GalerieTrophy {
  sessionId: string;
  /** Chrono du meilleur tour déjà formaté (canon v2 « M:SS.mmm »). */
  bestLapLabel: string;
  circuitName: string;
  dateLabel: string;
  subLabel: string;
  tracePoints: LatLon[] | null;
}

export interface GalerieState {
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  media: SessionMediaItem[];
  sections: GallerySection<SessionMediaItem>[];
  rows: GalleryRow<SessionMediaItem>[];
  stickyHeaderIndices: number[];
  photos: ViewablePhoto[];
  videoOverlayEnabled: boolean;
  heritage: HeritageTier;
  shares: ShareLink[];
  trophy: GalerieTrophy | null;
  year: number;
}

export interface Galerie extends GalerieState {
  reload: () => void;
  refresh: () => void;
  /** Recharge uniquement la liste des liens de partage (après create/revoke). */
  reloadShares: () => void;
}

const INITIAL: GalerieState = {
  status: 'loading',
  refreshing: false,
  media: [],
  sections: [],
  rows: [],
  stickyHeaderIndices: [],
  photos: [],
  videoOverlayEnabled: false,
  heritage: { isHeritage: false },
  shares: [],
  trophy: null,
  year: new Date().getFullYear(),
};

function settled<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === 'fulfilled' ? r.value : fallback;
}

interface SessionMetaRow {
  id: string;
  started_at: string | null;
  circuit_name: string | null;
  best_lap_seconds: number | null;
  lap_count: number | null;
}

/** Métas de toutes les séances closes — pour les en-têtes ET la carte-souvenir. */
async function fetchSessionMetas(userId: string): Promise<SessionMetaRow[]> {
  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select('id, started_at, circuit_name, best_lap_seconds, lap_count')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(`fetchSessionMetas : ${error.message}`);
  return (data ?? []) as SessionMetaRow[];
}

async function fetchRecentRegistrations(userId: string): Promise<RegistrationRef[]> {
  const { data } = await supabase
    .from('registrations')
    .select('offer_type, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  return (data ?? []) as RegistrationRef[];
}

/** Séance-record (meilleur tour, tous circuits) parmi les métas réelles. */
function pickRecordRow(rows: readonly SessionMetaRow[]): SessionMetaRow | null {
  let best: SessionMetaRow | null = null;
  let bestSeconds = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    const s = r.best_lap_seconds !== null ? Number(r.best_lap_seconds) : Number.NaN;
    if (Number.isFinite(s) && s > 0 && s < bestSeconds) {
      bestSeconds = s;
      best = r;
    }
  }
  return best;
}

export function useGalerie(userId: string | null): Galerie {
  const [state, setState] = useState<GalerieState>(INITIAL);
  const alive = useRef(true);

  const load = useCallback(
    async (refreshing: boolean) => {
      if (userId === null) {
        if (alive.current) setState({ ...INITIAL, status: 'ready' });
        return;
      }
      if (refreshing && alive.current) setState((s) => ({ ...s, refreshing: true }));

      const now = new Date();
      const year = now.getFullYear();

      // Vague 1 — sources indépendantes.
      const [mediaR, metasR, flagR, regsR, sharesR] = await Promise.allSettled([
        listAllPilotMedia(),
        fetchSessionMetas(userId),
        isFlagEnabled('video_overlay'),
        fetchRecentRegistrations(userId),
        listMyShares(),
      ]);

      // Panne des DEUX sources structurantes → erreur honnête.
      if (mediaR.status === 'rejected' && metasR.status === 'rejected') {
        if (alive.current) setState({ ...INITIAL, status: 'error', year });
        return;
      }

      const media = settled(mediaR, [] as SessionMediaItem[]);
      const metaRows = settled(metasR, [] as SessionMetaRow[]);
      const videoOverlayEnabled = settled(flagR, false); // fail-closed
      const heritage = heritageOf(settled(regsR, [] as RegistrationRef[]));
      const shares = settled(sharesR, [] as ShareLink[]);

      const metaById: Record<string, SessionMetaRef> = {};
      for (const r of metaRows) {
        metaById[r.id] = { startedAt: r.started_at, circuitName: r.circuit_name };
      }

      const sections = getMediaSections(media, metaById);
      const { rows, stickyHeaderIndices } = flattenSections(sections, 2);
      const photos = viewablePhotos(sections);

      // Vague 2 — carte-souvenir (séance-record) : tracé RÉEL du circuit de la
      // séance, jamais une silhouette de substitution. La carte est publique et
      // le record peut appartenir à n'importe quel circuit (« tous circuits ») :
      // on lit la variante STRICTE (null si le circuit réel n'a pas de géométrie)
      // pour ne jamais peindre le tracé d'un AUTRE circuit sous ce chrono.
      const recordRow = pickRecordRow(metaRows);
      let trophy: GalerieTrophy | null = null;
      if (recordRow !== null) {
        let tracePoints: LatLon[] | null = null;
        try {
          tracePoints = await fetchSessionCircuitCenterlineExact(recordRow.id);
        } catch {
          tracePoints = null;
        }
        const seconds = Number(recordRow.best_lap_seconds);
        const laps = recordRow.lap_count ?? 0;
        trophy = {
          sessionId: recordRow.id,
          bestLapLabel: Number.isFinite(seconds) && seconds > 0 ? formatLapTimeMs(seconds) : '—',
          // Absence honnête, cohérente avec les champs voisins (chrono/date en
          // « — ») : jamais un libellé générique substitué à un circuit absent.
          circuitName: recordRow.circuit_name ?? '—',
          dateLabel: recordRow.started_at !== null ? formatDateLong(recordRow.started_at) : '—',
          subLabel: laps > 0 ? `Tracé · ${laps} tour${laps > 1 ? 's' : ''}` : 'Tracé',
          tracePoints,
        };
      }

      if (!alive.current) return;
      setState({
        status: 'ready',
        refreshing: false,
        media,
        sections,
        rows,
        stickyHeaderIndices,
        photos,
        videoOverlayEnabled,
        heritage,
        shares,
        trophy,
        year,
      });
    },
    [userId]
  );

  useEffect(() => {
    alive.current = true;
    load(false).catch(() => {
      if (alive.current) setState({ ...INITIAL, status: 'error' });
    });
    return () => {
      alive.current = false;
    };
  }, [load]);

  const reload = useCallback(() => {
    load(false).catch(() => {
      if (alive.current) setState({ ...INITIAL, status: 'error' });
    });
  }, [load]);

  const refresh = useCallback(() => {
    load(true).catch(() => {
      if (alive.current) setState((s) => ({ ...s, refreshing: false }));
    });
  }, [load]);

  const reloadShares = useCallback(() => {
    listMyShares()
      .then((shares) => {
        if (alive.current) setState((s) => ({ ...s, shares }));
      })
      .catch(() => undefined);
  }, []);

  return { ...state, reload, refresh, reloadShares };
}
