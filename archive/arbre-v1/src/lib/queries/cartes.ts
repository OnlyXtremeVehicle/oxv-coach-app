// DIVERGENCE_SCHEMA: adaptations au schéma réel de production (17/07/2026) —
//  - filtre statut : le write-path réel (captureSessionService) écrit
//    'completed' / 'aborted' / 'recording' → les cartes et le compteur ne
//    retiennent que status = 'completed' ;
//  - température PISTE : aucune colonne en base (weather_snapshots ne porte
//    que temperature_c, l'air) → seule la température d'AIR est affichée,
//    jamais de valeur inventée ;
//  - chrono : formatChronoCarte (m:ss.mmm, point) est PROPRE au lot — le
//    formatLapTime historique (apostrophe, verrouillé par tests + PDF) n'est
//    pas touché.
/**
 * Panel de cartes — requêtes Supabase (lot PROFIL_CARTES).
 *
 * Défense en profondeur (spec §4.3) : toutes les requêtes filtrent
 * explicitement sur l'utilisateur connecté MÊME si la RLS le garantit déjà.
 * Aucune donnée d'un autre pilote ne transite par ce module.
 *
 * La logique pure (référence, numérotation, filtres, formats) vit dans
 * `cartesLogic.ts` (testée sans RN) et est ré-exportée ici.
 */

import { supabase } from '@/lib/supabase';

import { avecDelaiGarde } from './attente';
import type { CarteSession } from './cartesLogic';

export * from './cartesLogic';

/** Conversion sûre des numeric Supabase (parfois des chaînes au runtime). */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Chaîne non vide ou null. */
function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

/** Ligne brute telle que renvoyée par PostgREST (jointure circuits incluse). */
interface LigneSessionBrute {
  id: string;
  started_at: string;
  best_lap_seconds: number | string | null;
  lap_count: number | string | null;
  weather: string | null;
  vehicle_label: string | null;
  vehicle_id: string | null;
  circuit_id: string | null;
  circuit_name: string | null;
  circuits:
    | {
        id: string;
        official_name: string | null;
        name: string | null;
        track_svg_path: string | null;
      }
    | {
        id: string;
        official_name: string | null;
        name: string | null;
        track_svg_path: string | null;
      }[]
    | null;
}

/** Jointure circuits normalisée (PostgREST peut renvoyer objet ou tableau). */
function circuitDeLigne(ligne: LigneSessionBrute): {
  officialName: string | null;
  name: string | null;
  trackSvgPath: string | null;
} | null {
  const c = Array.isArray(ligne.circuits) ? (ligne.circuits[0] ?? null) : ligne.circuits;
  if (!c) return null;
  return {
    officialName: texte(c.official_name),
    name: texte(c.name),
    trackSvgPath: texte(c.track_svg_path),
  };
}

/** Moment de snapshot météo préféré pour l'affichage carte. */
const ORDRE_MOMENTS = ['during', 'before', 'after'] as const;

/**
 * Températures d'air par session — weather_snapshots des SEULES sessions du
 * pilote (les ids proviennent d'une requête déjà filtrée user_id). Préférence
 * de moment : during > before > after. Absence de snapshot = pas de valeur.
 */
async function temperaturesAirParSession(sessionIds: string[]): Promise<Map<string, number>> {
  const resultat = new Map<string, number>();
  if (sessionIds.length === 0) return resultat;

  const meilleurs = new Map<string, { moment: string; temp: number }>();
  // Lots de 100 ids pour garder des URLs PostgREST raisonnables.
  for (let i = 0; i < sessionIds.length; i += 100) {
    const lot = sessionIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from('weather_snapshots')
      .select('session_id, temperature_c, moment')
      .in('session_id', lot);
    if (error) {
      // Best-effort : la météo détaillée manquante ne bloque pas le panel.
      console.warn('[OXV][cartes] weather_snapshots :', error.message);
      continue;
    }
    for (const ligne of data ?? []) {
      const temp = num(ligne.temperature_c);
      if (temp === null) continue;
      const rang = ORDRE_MOMENTS.indexOf(ligne.moment as (typeof ORDRE_MOMENTS)[number]);
      const actuel = meilleurs.get(ligne.session_id);
      const rangActuel = actuel
        ? ORDRE_MOMENTS.indexOf(actuel.moment as (typeof ORDRE_MOMENTS)[number])
        : Number.POSITIVE_INFINITY;
      if (!actuel || (rang !== -1 && rang < rangActuel)) {
        meilleurs.set(ligne.session_id, { moment: ligne.moment, temp });
      }
    }
  }
  for (const [id, { temp }] of meilleurs) resultat.set(id, temp);
  return resultat;
}

/**
 * Charge les cartes du pilote connecté : sessions télémétrie TERMINÉES
 * (status 'completed'), triées par date descendante, enrichies du circuit,
 * du libellé voiture (vehicle_label, sinon garage) et de la température d'air.
 */
export async function getCartes(): Promise<CarteSession[]> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('AUTH_REQUIRED');

  const { data, error } = await avecDelaiGarde(
    supabase
      .from('telemetry_sessions')
      .select(
        `id, started_at, best_lap_seconds, lap_count, weather,
         vehicle_label, vehicle_id, circuit_id, circuit_name, status,
         circuits ( id, official_name, name, track_svg_path )`
      )
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
  );
  if (error) throw new Error(error.message);
  const lignes = (data ?? []) as unknown as LigneSessionBrute[];

  // Libellés voiture de repli : jointure client sur MON garage (spec §4.2).
  const idsVehiculesManquants = [
    ...new Set(
      lignes
        .filter((l) => !texte(l.vehicle_label) && texte(l.vehicle_id))
        .map((l) => l.vehicle_id as string)
    ),
  ];
  const labelParVehicule = new Map<string, string>();
  if (idsVehiculesManquants.length > 0) {
    const { data: vehicules, error: erreurVehicules } = await supabase
      .from('vehicles')
      .select('id, brand, model')
      .eq('user_id', user.id)
      .in('id', idsVehiculesManquants);
    if (erreurVehicules) {
      console.warn('[OXV][cartes] vehicles :', erreurVehicules.message);
    }
    for (const v of vehicules ?? []) {
      labelParVehicule.set(v.id, `${v.brand} ${v.model}`.trim());
    }
  }

  const temperatures = await temperaturesAirParSession(lignes.map((l) => l.id));

  return lignes.map((ligne): CarteSession => {
    const circuit = circuitDeLigne(ligne);
    return {
      id: ligne.id,
      startedAt: ligne.started_at,
      bestLapSeconds: num(ligne.best_lap_seconds),
      lapCount: num(ligne.lap_count),
      weather: texte(ligne.weather),
      vehicleLabel:
        texte(ligne.vehicle_label) ??
        (ligne.vehicle_id ? (labelParVehicule.get(ligne.vehicle_id) ?? null) : null),
      circuitKey: texte(ligne.circuit_id) ?? texte(ligne.circuit_name),
      circuitLabel: circuit?.officialName ?? circuit?.name ?? texte(ligne.circuit_name) ?? null,
      trackSvgPath: circuit?.trackSvgPath ?? null,
      airTempC: temperatures.get(ligne.id) ?? null,
    };
  });
}
