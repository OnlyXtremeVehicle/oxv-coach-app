/**
 * useVousHub — chargement de la porte VOUS (lot V2-L4, écran 1/8, Mission A).
 *
 * Services EXISTANTS + services BE-1 uniquement (le lot ne CRÉE aucun service) :
 *   - loadPassport (stats cumulées : records par circuit, km) ;
 *   - identité (users : first_name, last_name, public_handle, avatar_url) —
 *     lecture directe, patron useMiroirHome.fetchAvatarUrl ;
 *   - registrations (palier + tier Heritage, patron heritageOf) ;
 *   - garage + covers (photo du véhicule principal, patron useMiroirHome) ;
 *   - flag 'founders' (fail-closed) + founderService (candidature, compteur) ;
 *   - referralService (mon code, mon écurie).
 *
 * CANAL D'ERREUR (règle « données réelles câblées ») : l'IDENTITÉ est la source
 * primaire (le héros ne peut mentir un nom/handle) — son échec bascule l'écran
 * en 'error' (StateView + Réessayer). Tout le reste est best-effort : une
 * source en panne rend une section masquée / « — », jamais un chiffre fabriqué.
 * Les flags et la candidature échouent FERMÉS (carte fondateur absente).
 *
 * Toutes les décisions vivent dans vousHubLogic (pur, testé).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { listMyVehicles } from '@/services/garageService';
import { loadPassport, type Passport } from '@/services/passportService';
import { getMyVehicleCovers } from '@/services/pilotMediaService';
import {
  getFoundersCount,
  getMyApplication,
  type MyFounderApplication,
} from '@/services/v2/founderService';
import { getMyCode, getMyCrew } from '@/services/v2/referralService';

import { pickVehicleCover } from '@/features/miroir/miroirHomeLogic';

import {
  crewRowLabel,
  currentOfferLabel,
  foundersGauge,
  founderCardState,
  handleLabel,
  heritageOf,
  pilotDisplayName,
  recordsCount,
  statsLine,
  type CrewRowLabel,
  type FounderCardState,
  type FoundersGauge,
  type HeritageTier,
  type RegistrationRef,
} from './vousHubLogic';

// ---------------------------------------------------------------------------
// Types exposés à l'écran
// ---------------------------------------------------------------------------

export interface VousFounder {
  /** Flag 'founders' (fail-closed). OFF → carte absente. */
  flagOn: boolean;
  /** État de la carte (absent = non rendue). */
  state: FounderCardState;
  /** Compteur x/30 réel (founders_count), ou null si inconnu → jauge masquée. */
  gauge: FoundersGauge | null;
}

export interface VousReferral {
  /** Code de parrainage réel, ou null si indisponible (section masquée). */
  code: string | null;
  /** Ligne « mon groupe » réelle, ou null si je n'ai pas d'écurie. */
  crew: CrewRowLabel | null;
}

export interface VousHubState {
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  /** Nom affiché (repli « Pilote »). */
  name: string;
  /** « @handle » réel, ou null. */
  handle: string | null;
  /** URL avatar signée/publique, ou null (repli casque). */
  avatarUrl: string | null;
  /** Photo du véhicule principal, ou null (repli insigne). */
  vehiclePhotoUrl: string | null;
  /** Tier Heritage (eyebrow + bord avatar or). */
  heritage: HeritageTier;
  /** Ligne d'identité mono « {palier} · {n} records · {km} km », ou null. */
  statsLine: string | null;
  founder: VousFounder;
  referral: VousReferral;
}

export interface VousHub extends VousHubState {
  /** Rechargement complet (bouton Réessayer). */
  refresh: () => void;
}

const INITIAL: VousHubState = {
  status: 'loading',
  refreshing: false,
  name: 'Pilote',
  handle: null,
  avatarUrl: null,
  vehiclePhotoUrl: null,
  heritage: { isHeritage: false },
  statsLine: null,
  founder: { flagOn: false, state: 'absent', gauge: null },
  referral: { code: null, crew: null },
};

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

// ---------------------------------------------------------------------------
// Lectures I/O (le hook fait le réseau ; la décision vit dans vousHubLogic)
// ---------------------------------------------------------------------------

interface IdentityRow {
  firstName: string | null;
  lastName: string | null;
  handle: string | null;
  avatarUrl: string | null;
}

/**
 * Identité du pilote (users, RLS own). STRICT : une erreur DB REJETTE — c'est
 * la source PRIMAIRE du héros, son échec doit basculer l'écran en 'error',
 * jamais afficher « Pilote » sans savoir. Ligne absente (jamais insérée) →
 * identité vide (repli « Pilote »), ce qui n'est PAS une erreur.
 */
async function fetchIdentity(userId: string): Promise<IdentityRow> {
  const { data, error } = await supabase
    .from('users')
    .select('first_name, last_name, public_handle, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`fetchIdentity : ${error.message}`);
  const row = (data ?? {}) as {
    first_name?: string | null;
    last_name?: string | null;
    public_handle?: string | null;
    avatar_url?: string | null;
  };
  return {
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    handle: row.public_handle ?? null,
    avatarUrl: row.avatar_url ?? null,
  };
}

/** Inscriptions récentes — même lecture que heritageOf / passeport (tri DESC). */
async function fetchRegistrations(userId: string): Promise<RegistrationRef[]> {
  const { data } = await supabase
    .from('registrations')
    .select('offer_type, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  return (data ?? []) as RegistrationRef[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVousHub(userId: string | null): VousHub {
  const [state, setState] = useState<VousHubState>(INITIAL);
  const alive = useRef(true);

  const load = useCallback(
    async (refreshing: boolean) => {
      if (userId === null) {
        if (alive.current) setState({ ...INITIAL, status: 'ready' });
        return;
      }
      if (refreshing && alive.current) setState((s) => ({ ...s, refreshing: true }));

      const [
        identityR,
        passportR,
        regsR,
        vehiclesR,
        coversR,
        flagR,
        applicationR,
        foundersCountR,
        codeR,
        crewR,
      ] = await Promise.allSettled([
        fetchIdentity(userId),
        loadPassport(userId),
        fetchRegistrations(userId),
        listMyVehicles(),
        getMyVehicleCovers(),
        isFlagEnabled('founders'),
        getMyApplication(),
        getFoundersCount(),
        getMyCode(),
        getMyCrew(),
      ]);

      // Source PRIMAIRE : l'identité. Son échec = 'error' (le héros ne peut pas
      // afficher un nom/handle qu'il n'a pas lu). Tout le reste best-effort.
      if (identityR.status === 'rejected') {
        if (alive.current) setState({ ...INITIAL, status: 'error' });
        return;
      }

      const identity = identityR.value;
      const passport = settled<Passport | null>(passportR, null); // rejet partiel → « — »
      const registrations = settled(regsR, []);
      const vehicles = settled(vehiclesR, []);
      const covers = settled(coversR, {});
      const flagOn = settled(flagR, false); // fail-closed
      const application = settled<MyFounderApplication | null>(applicationR, null);
      const foundersCountValue = settled<number | null>(foundersCountR, null);
      const code = settled<string | null>(codeR, null);
      const crew = settled(crewR, null);

      const palier = currentOfferLabel(registrations);
      const records = passport !== null ? recordsCount(passport.stats.byCircuit) : 0;
      const km = passport !== null ? passport.stats.totalDistanceKm : 0;

      if (!alive.current) return;
      setState({
        status: 'ready',
        refreshing: false,
        name: pilotDisplayName(identity.firstName, identity.lastName),
        handle: handleLabel(identity.handle),
        avatarUrl: identity.avatarUrl,
        vehiclePhotoUrl: pickVehicleCover(vehicles, covers),
        heritage: heritageOf(registrations),
        statsLine: statsLine(palier, records, km),
        founder: {
          flagOn,
          state: founderCardState(flagOn, application),
          gauge: foundersCountValue === null ? null : foundersGauge(foundersCountValue),
        },
        referral: {
          code: typeof code === 'string' && code.trim().length > 0 ? code.trim() : null,
          crew: crew !== null ? crewRowLabel(crew) : null,
        },
      });
    },
    [userId]
  );

  useEffect(() => {
    alive.current = true;
    load(false).catch(() => {
      // Exception inattendue au premier chargement : état d'erreur honnête.
      if (alive.current) setState({ ...INITIAL, status: 'error' });
    });
    return () => {
      alive.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    load(true).catch(() => {
      if (alive.current) setState((s) => ({ ...s, refreshing: false }));
    });
  }, [load]);

  return { ...state, refresh };
}
