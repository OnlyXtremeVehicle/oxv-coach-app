/**
 * Ce qu'une séance contient réellement — jalon 4, phase 4septies.
 *
 * ---
 *
 * ON COMPTE, ON NE TÉLÉCHARGE PAS
 *
 * Les cinq niveaux s'ouvrent sur des COMPTES : combien de trames portent une
 * vitesse de lacet, combien portent les deux accélérations. Rien n'oblige à
 * rapatrier les trames pour cela.
 *
 * L'écran de séance atteint déjà `loadSessionFrames` — lecture paginée jusqu'à
 * soixante mille lignes, sans cache — **cinq fois par ouverture**. Une sixième
 * pour compter serait indéfendable.
 *
 * D'où trois requêtes `head: true` : Postgres compte, rien ne transite.
 *
 * ---
 *
 * ON NE LIT PAS `total_frames`
 *
 * La colonne dénormalisée se trompe dans les deux sens sur la base
 * d'aujourd'hui — dix séances annoncent des trames qu'elles n'ont pas, et la
 * seule qui en porte cinquante-trois affiche zéro. Voir `docs/DETTE.md`, D-13.
 *
 * Un portillon posé dessus ouvrirait un niveau vide, ou fermerait un niveau qui
 * a de quoi s'ouvrir.
 */

import { supabase } from '@/lib/supabase';
import { etatDepuisSeance, type EtatSeance, type TourComptable } from '@/telemetry/niveaux';

/** Un état où rien n'est mesuré. Sert de repli honnête en cas de panne. */
export const ETAT_SEANCE_VIDE: EtatSeance = {
  toursChronometres: 0,
  toursComparables: 0,
  tramesAvecLacet: 0,
  tramesAvecAcceleration: 0,
};

/** Compte des lignes sans en rapatrier aucune. `null` si la requête échoue. */
async function compte(
  sessionId: string,
  affine: (q: ReturnType<typeof requeteBase>) => ReturnType<typeof requeteBase>
): Promise<number | null> {
  const { count, error } = await affine(requeteBase(sessionId));
  if (error) {
    console.warn('[OXV][niveaux] compte :', error.message);
    return null;
  }
  return count ?? 0;
}

function requeteBase(sessionId: string) {
  return supabase
    .from('telemetry_frames')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);
}

/**
 * L'état d'une séance, tel que les cinq niveaux le consomment.
 *
 * Les tours viennent de `laps`, avec leurs drapeaux de stand : un tour de
 * sortie n'est pas un tour chronométré, et le compter ouvrirait le chrono sur
 * une valeur qui n'en est pas une.
 *
 * `distance_meters` sert de longueur pour décider quels tours sont comparables.
 * Une distance nulle ou absente écarte le tour — `compteToursComparables`
 * n'accepte que des longueurs strictement positives.
 *
 * **Ne lève jamais.** Une panne devient un compte à zéro, donc un niveau fermé
 * qui dit son absence — jamais un écran en erreur, jamais une valeur inventée.
 */
export async function loadEtatSeance(sessionId: string): Promise<EtatSeance> {
  const [lacet, accel, tours] = await Promise.all([
    compte(sessionId, (q) => q.not('rotation_z', 'is', null)),
    compte(sessionId, (q) => q.not('g_force_x', 'is', null).not('g_force_y', 'is', null)),
    chargeTours(sessionId),
  ]);

  return etatDepuisSeance(tours, {
    tramesAvecLacet: lacet ?? 0,
    tramesAvecAcceleration: accel ?? 0,
  });
}

async function chargeTours(sessionId: string): Promise<TourComptable[]> {
  const { data, error } = await supabase
    .from('laps')
    .select('is_outlap, is_inlap, distance_meters')
    .eq('session_id', sessionId)
    .order('lap_number', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[OXV][niveaux] tours :', error.message);
    return [];
  }

  return data.map((l) => ({
    longueurM: l.distance_meters !== null ? Number(l.distance_meters) : null,
    estOutlap: l.is_outlap === true,
    estInlap: l.is_inlap === true,
  }));
}
